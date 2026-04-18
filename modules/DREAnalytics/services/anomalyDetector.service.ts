import { 
  getDREDataByPeriodo, getDREParameters, insertAnomalies, 
  getResumoMensal, getStatusCota, getComparativo, getSazonalidades 
} from './supabase.service';
import type { DREAnomaly, DREData, DREParameters, Sazonalidade } from '../types/dre.types';

/**
 * ALGORITMO DE DETECÇÃO AUTOMÁTICA DE ANOMALIAS (FIREWALL FINANCEIRO)
 * 
 * Este serviço analisa os dados do DRE buscando outliers, desvios de cota,
 * variações abruptas e inconsistências em meses sazonais.
 */

export async function detectAnomalies(
  lojaId: number,
  mesReferencia: string
): Promise<DREAnomaly[]> {
  console.log(`[anomalyDetector] Iniciando auditoria para Loja: ${lojaId}, Mês: ${mesReferencia}`);

  const anomalias: DREAnomaly[] = [];

  try {
    // 1. Buscar dados do mês atual para a loja
    const dadosMesArr = await getDREDataByPeriodo(mesReferencia, mesReferencia, [lojaId]);
    if (dadosMesArr.length === 0) return [];

    // 2. Buscar parâmetros globais e sazonalidades
    const sazonalidades = await getSazonalidades();
    const mesNum = parseInt(mesReferencia.split('-')[1]);
    const sazonal = sazonalidades.find(s => s.meses.includes(mesNum));

    // Analisar cada descrição (ALIMENTACAO, ALUGUEL, etc.)
    for (const dado of dadosMesArr) {
      if (!dado.descricao) continue;

      // Buscar parâmetros estatísticos pré-calculados
      const params = await getDREParameters(lojaId, dado.descricao);
      if (!params) continue;

      // --- REGRA 1: OUTLIERS (BASEADO EM LIMITES ESTATÍSTICOS) ---
      if (dado.valor > params.limite_superior) {
        const desvioAbsoluto = dado.valor - params.media;
        const desvioPercentual = (desvioAbsoluto / params.media) * 100;
        
        let severidade: 'media' | 'alta' | 'critica' = 'media';
        if (desvioPercentual > 100) severidade = 'critica';
        else if (desvioPercentual > 50) severidade = 'alta';

        anomalias.push({
          loja_id: lojaId,
          mes_referencia: mesReferencia,
          tipo: 'outlier_superior',
          severidade,
          descricao: `Gasto em ${dado.descricao} acima do limite estatístico.`,
          valor_real: dado.valor,
          valor_esperado: params.media,
          desvio_absoluto: desvioAbsoluto,
          desvio_percentual: desvioPercentual,
          status: 'pendente'
        });
      }

      // --- REGRA 2: VALOR ZERADO (DADOS AUSENTES OU ATIVIDADE SUSPENSA) ---
      if (dado.valor === 0 && params.media > 100) {
        anomalias.push({
          loja_id: lojaId,
          mes_referencia: mesReferencia,
          tipo: 'valor_zerado',
          severidade: 'alta',
          descricao: `${dado.descricao} reportado como zero (Média Histórica: R$ ${params.media.toFixed(2)})`,
          valor_real: 0,
          valor_esperado: params.media,
          desvio_absoluto: -params.media,
          desvio_percentual: -100,
          status: 'pendente'
        });
      }

      // --- REGRA 3: SAZONALIDADE ANORMAL (SUB-PERFORMANCE EM MÊS CLAVE) ---
      if (sazonal && sazonal.fator > 1 && dado.valor < params.media) {
          // Se é mês de Natal (2.0x) mas o valor atual é menor do que a média NORMALizada
          anomalias.push({
              loja_id: lojaId,
              mes_referencia: mesReferencia,
              tipo: 'sazonalidade_anormal',
              severidade: 'media',
              descricao: `Sub-performance em mês sazonal (${sazonal.nome}).`,
              valor_real: dado.valor,
              valor_esperado: params.media * (sazonal.fator || 1),
              desvio_absoluto: dado.valor - params.media,
              desvio_percentual: ((dado.valor / params.media) - 1) * 100,
              status: 'pendente'
          });
      }
    }

    // --- REGRA 4: ESTOURO DE COTA (VIEW_DRE_COTAS_STATUS) ---
    const statusCotaArr = await getStatusCota(mesReferencia, [lojaId]);
    const statusCota = statusCotaArr[0];

    if (statusCota && statusCota.consumo_fornecedores > statusCota.cota_total) {
      anomalias.push({
        loja_id: lojaId,
        mes_referencia: mesReferencia,
        tipo: 'estouro_cota',
        severidade: 'critica',
        descricao: `Ultrapassagem da cota mensal de fornecedores.`,
        valor_real: statusCota.consumo_fornecedores,
        valor_esperado: statusCota.cota_total,
        desvio_absoluto: statusCota.consumo_fornecedores - statusCota.cota_total,
        desvio_percentual: ((statusCota.consumo_fornecedores / statusCota.cota_total) - 1) * 100,
        status: 'pendente'
      });
    }

    // --- REGRA 5: VARIAÇÃO ABRUPTA MoM (COMPARATIVO) ---
    const comparativoArr = await getComparativo(mesReferencia, [lojaId]);
    for (const comp of comparativoArr) {
      if (Math.abs(comp.variacao_percent) > 50) {
        anomalias.push({
          loja_id: lojaId,
          mes_referencia: mesReferencia,
          tipo: 'variacao_abrupta',
          severidade: comp.variacao_percent > 100 ? 'critica' : 'alta',
          descricao: `Variação brusca em ${comp.descricao} vs mês anterior (${comp.variacao_percent.toFixed(2)}%).`,
          valor_real: comp.valor_atual,
          valor_esperado: comp.valor_anterior,
          desvio_absoluto: comp.valor_atual - comp.valor_anterior,
          desvio_percentual: comp.variacao_percent,
          status: 'pendente'
        });
      }
    }

    // Salvar anomalias detectadas no banco
    if (anomalias.length > 0) {
        console.log(`[anomalyDetector] Detectadas ${anomalias.length} anomalias. Gravando no banco...`);
        await insertAnomalies(anomalias);
    }

    return anomalias;

  } catch (error) {
    console.error(`[anomalyDetector] Erro:`, error);
    throw error;
  }
}
