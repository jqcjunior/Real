import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

export interface LojaAgregada {
  store_id: string;
  store_number: string;
  qtd_vendedores: number;
  media_pa: number;
  media_ticket: number;
}

function parseValorBR(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  let str = String(value).trim().replace(/R\$/g, '').replace(/\s/g, '');
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

async function getStoreMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, number')
    .neq('status', 'inactive');
  if (error || !data) throw new Error('Não foi possível carregar as lojas do sistema.');
  const map = new Map<string, string>();
  data.forEach(s => map.set(String(s.number), s.id));
  return map;
}

/**
 * Lê o relatório semanal (todas as lojas juntas, formato "102-660 NOME"),
 * agrupa por loja e calcula MÉDIA de P.A. e Ticket Médio + conta vendedores distintos.
 */
export async function parseRelatorioSemanal(file: File): Promise<LojaAgregada[]> {
  const storeMap = await getStoreMap();
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];

  let headerIndex = -1;
  for (let i = 0; i < rawData.length; i++) {
    if (rawData[i]?.some((v: any) => String(v).toLowerCase().trim() === 'vendedor')) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) throw new Error('Cabeçalho "Vendedor" não encontrado no arquivo.');

  const headers = rawData[headerIndex].map((v: any) => String(v).toLowerCase().trim());
  const colVendedor = headers.indexOf('vendedor');
  const colPA = headers.findIndex(h => h.startsWith('p.a'));
  const colTicket = headers.findIndex(h => h.includes('ticket'));

  if (colVendedor === -1 || colPA === -1 || colTicket === -1) {
    throw new Error('Colunas obrigatórias (Vendedor, P.A., Ticket Médio) não encontradas no arquivo.');
  }

  const porLoja: Record<string, { pa: number[]; ticket: number[]; vendedores: Set<string> }> = {};

  for (let i = headerIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;
    const vendedorCell = String(row[colVendedor] || '').trim();
    if (!vendedorCell) continue;

    const hifenIdx = vendedorCell.indexOf('-');
    if (hifenIdx === -1) continue;
    const storeNumber = vendedorCell.substring(0, hifenIdx).trim();
    if (!/^\d+$/.test(storeNumber)) continue;

    const pa = parseValorBR(row[colPA]);
    const ticket = parseValorBR(row[colTicket]);

    if (!porLoja[storeNumber]) {
      porLoja[storeNumber] = { pa: [], ticket: [], vendedores: new Set() };
    }
    porLoja[storeNumber].pa.push(pa);
    porLoja[storeNumber].ticket.push(ticket);
    porLoja[storeNumber].vendedores.add(vendedorCell);
  }

  const resultado: LojaAgregada[] = [];
  const naoEncontradas: string[] = [];

  for (const [storeNumber, agg] of Object.entries(porLoja)) {
    const storeId = storeMap.get(storeNumber);
    if (!storeId) {
      naoEncontradas.push(storeNumber);
      continue;
    }
    const mediaPA = agg.pa.reduce((a, b) => a + b, 0) / agg.pa.length;
    const mediaTicket = agg.ticket.reduce((a, b) => a + b, 0) / agg.ticket.length;
    resultado.push({
      store_id: storeId,
      store_number: storeNumber,
      qtd_vendedores: agg.vendedores.size,
      media_pa: Number(mediaPA.toFixed(2)),
      media_ticket: Number(mediaTicket.toFixed(2))
    });
  }

  if (resultado.length === 0) {
    throw new Error('Nenhuma loja identificada no arquivo. Verifique se a coluna "Vendedor" está no formato "NÚMERO-CÓDIGO NOME".');
  }
  if (naoEncontradas.length > 0) {
    console.warn(`⚠️ Lojas não encontradas no sistema: ${naoEncontradas.join(', ')}`);
  }

  resultado.sort((a, b) => parseInt(a.store_number) - parseInt(b.store_number));
  return resultado;
}

/**
 * Aplica os dados agregados: 
 * - Atualiza/insere pa_inicial + ticket_minimo em Dashboard_PA_Parametros (preservando base/incremento existentes)
 * - Atualiza qtd_vendedores em monthly_goals
 */
export async function aplicarImportacaoSemanal(
  dados: LojaAgregada[],
  dataInicioSemana: string
): Promise<{ atualizados: number; criados: number; semNaSemanaEscolhida: string[] }> {

  let atualizados = 0;
  let criados = 0;
  const semNaSemanaEscolhida: string[] = [];

  for (const loja of dados) {
    // 1. Encontrar a semana desta loja com a data_inicio escolhida
    const { data: semanaLoja, error: semanaError } = await supabase
      .from('Dashboard_PA_Semanas')
      .select('id, ano_ref, mes_ref')
      .eq('store_id', loja.store_id)
      .eq('data_inicio', dataInicioSemana)
      .maybeSingle();

    if (semanaError || !semanaLoja) {
      semNaSemanaEscolhida.push(loja.store_number);
      continue;
    }

    // 2. Verificar se já existe parâmetro configurado para esta loja/semana
    const { data: paramExistente } = await supabase
      .from('Dashboard_PA_Parametros')
      .select('*')
      .eq('store_id', loja.store_id)
      .eq('semana_id', semanaLoja.id)
      .maybeSingle();

    if (paramExistente) {
      // Atualiza SOMENTE pa_inicial e ticket_minimo — preserva base/incremento já configurados
      const { error: updateError } = await supabase
        .from('Dashboard_PA_Parametros')
        .update({
          pa_inicial: loja.media_pa,
          ticket_minimo: loja.media_ticket,
          updated_at: new Date().toISOString()
        })
        .eq('store_id', loja.store_id)
        .eq('semana_id', semanaLoja.id);
      if (!updateError) atualizados++;
    } else {
      // Cria novo registro com valores padrão de base/incremento
      const { error: insertError } = await supabase
        .from('Dashboard_PA_Parametros')
        .insert({
          store_id: loja.store_id,
          semana_id: semanaLoja.id,
          pa_inicial: loja.media_pa,
          incremento_pa: 0.05,
          valor_base: 50,
          incremento_valor: 10,
          ticket_minimo: loja.media_ticket,
          ticket_incremento: 10,
          ticket_valor_base: 100,
          ticket_inc_valor: 20,
          updated_at: new Date().toISOString()
        });
      if (!insertError) criados++;
    }

    // 3. Atualizar quantidade de vendedores no Cadastro de Metas (mensal)
    await supabase
      .from('monthly_goals')
      .update({ qtd_vendedores: loja.qtd_vendedores })
      .eq('store_id', loja.store_id)
      .eq('year', semanaLoja.ano_ref)
      .eq('month', semanaLoja.mes_ref);
  }

  return { atualizados, criados, semNaSemanaEscolhida };
}
