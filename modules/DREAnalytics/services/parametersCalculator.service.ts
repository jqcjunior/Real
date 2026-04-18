import { getDREDataByPeriodo, upsertDREParameters, getSazonalidades } from './supabase.service';
import type { DREParameters, Sazonalidade } from '../types/dre.types';

/**
 * ENGINE DE CÁLCULO DE PARÂMETROS ESTATÍSTICOS
 * 
 * Este serviço calcula os limites de controle e parâmetros normativos
 * para detecção automatizada de anomalias no DRE.
 */

export async function calculateParameters(
  lojaId: number,
  descricao: string,
  periodoInicio: string,
  periodoFim: string,
  consideraSazonalidade: boolean = true
): Promise<DREParameters | null> {
  console.log(`[parametersCalculator] Iniciando cálculo para Loja: ${lojaId}, Descrição: ${descricao}`);

  try {
    // 1. Buscar dados do período para a loja
    const dados = await getDREDataByPeriodo(periodoInicio, periodoFim, [lojaId]);
    
    // 2. Buscar sazonalidades se necessário
    let sazonalidades: Sazonalidade[] = [];
    if (consideraSazonalidade) {
      sazonalidades = await getSazonalidades();
    }

    // 3. Filtrar pela descrição e tratar sazonalidade
    // Excluímos valores zerados (provável falta de dados)
    const valoresTratados = dados
      .filter(d => d.descricao === descricao && d.valor > 0)
      .map(d => {
        let valorFinal = d.valor;

        if (consideraSazonalidade) {
          // Determina o número do mês (format "YYYY-MM")
          const mesNum = parseInt(d.mes_referencia.split('-')[1]);
          
          // Encontra se este mês possui um fator sazonal
          const sazonal = sazonalidades.find(s => s.meses.includes(mesNum));
          
          if (sazonal && sazonal.fator > 1) {
            // Se Junho (São João) tem fator 1.8x, dividimos o valor por 1.8 
            // para normalizar a base estatística
            valorFinal = d.valor / sazonal.fator;
            console.log(`[parametersCalculator] Normalizando ${d.mes_referencia}: R$ ${d.valor} -> R$ ${valorFinal.toFixed(2)} (Fator ${sazonal.nome}: ${sazonal.fator}x)`);
          }
        }

        return valorFinal;
      });

    const n = valoresTratados.length;
    if (n === 0) {
      console.warn(`[parametersCalculator] Sem dados para ${descricao} na Loja ${lojaId}`);
      return null;
    }

    // Ordenar para cálculos de mediana e quartis
    const sortedValores = [...valoresTratados].sort((a, b) => a - b);

    // 4. Cálculos Estatísticos
    
    // Média
    const soma = sortedValores.reduce((a, b) => a + b, 0);
    const media = soma / n;

    // Mediana
    let mediana;
    const mid = Math.floor(n / 2);
    if (n % 2 !== 0) {
      mediana = sortedValores[mid];
    } else {
      mediana = (sortedValores[mid - 1] + sortedValores[mid]) / 2;
    }

    // Desvio Padrão
    const variancia = sortedValores.reduce((acc, val) => acc + Math.pow(val - media, 2), 0) / n;
    const desvioPadrao = Math.sqrt(variancia);

    // Mínimo e Máximo
    const min = sortedValores[0];
    const max = sortedValores[n - 1];

    // Quartis (Tukey's Method simplified for small datasets)
    const getQuartile = (arr: number[], quantile: number) => {
        const pos = (arr.length - 1) * quantile;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (arr[base + 1] !== undefined) {
            return arr[base] + rest * (arr[base + 1] - arr[base]);
        } else {
            return arr[base];
        }
    };
    const q1 = getQuartile(sortedValores, 0.25);
    const q3 = getQuartile(sortedValores, 0.75);

    // Limites de Controle (2 Desvios Padrões = ~95% dos dados)
    const limiteInferior = Math.max(0, media - 2 * desvioPadrao);
    const limiteSuperior = media + 2 * desvioPadrao;

    // Coeficiente de Variação (Dispersão relativa)
    const coeficienteVariacao = media !== 0 ? (desvioPadrao / media) * 100 : 0;

    // 5. Preparar objeto e salvar (Upsert)
    const parametros: DREParameters = {
      loja_id: lojaId,
      descricao,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      media,
      mediana,
      desvio_padrao: desvioPadrao,
      min,
      max,
      q1,
      q3,
      limite_inferior: limiteInferior,
      limite_superior: limiteSuperior,
      coeficiente_variacao: coeficienteVariacao,
      considera_sazonalidade: consideraSazonalidade
    };

    console.log(`[parametersCalculator] Salvando estatísticas para ${descricao}: Média=${media.toFixed(2)}, Desvio=${desvioPadrao.toFixed(2)}`);
    await upsertDREParameters(parametros);

    return parametros;

  } catch (error) {
    console.error(`[parametersCalculator] Erro no cálculo:`, error);
    throw error;
  }
}
