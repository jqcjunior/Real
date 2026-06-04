import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

export interface MetaData {
  store_id: string;   // UUID da loja
  loja_numero: string; // Número visual da loja
  qtde_vendas: number;
  qtde_itens: number;
  pa: number;
  pu: number;
  ticket_medio: number;
  meta: number;
  valor_vendido: number;
  data: string;
  year: number;
  month: number;
}

function parseValorBR(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  let str = String(value).trim().replace(/R\$/g, '').replace(/\s/g, '');
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    const partes = str.split('.');
    if (partes[1] && partes[1].length === 3) str = str.replace('.', '');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Busca todas as lojas ativas e retorna mapa número → UUID
 */
async function getStoreMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, number')
    .neq('status', 'inactive');

  if (error || !data) {
    console.error('Erro ao buscar lojas:', error);
    throw new Error('Não foi possível carregar as lojas do sistema.');
  }

  const map = new Map<string, string>();
  data.forEach(s => map.set(String(s.number), s.id));
  return map;
}

/**
 * Detecta tipo de arquivo e converte
 */
export async function parseMetasFile(file: File): Promise<MetaData[]> {
  // Buscar mapa de lojas ANTES de parsear
  const storeMap = await getStoreMap();
  console.log(`🏪 ${storeMap.size} lojas encontradas no sistema`);

  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
    console.log('🔍 Detectado: HTML (XLS falso)');
    return await parseMetasHTML(file, storeMap);
  }

  console.log('🔍 Detectado: Excel (.xlsx)');
  return await parseMetasExcel(file, storeMap);
}

/**
 * Parser para HTML (.xls falso)
 */
async function parseMetasHTML(file: File, storeMap: Map<string, string>): Promise<MetaData[]> {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const rows = doc.querySelectorAll('tr');
  const dados: MetaData[] = [];
  const naoEncontradas: string[] = [];

  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0, 10);
  const year = hoje.getFullYear();
  const month = hoje.getMonth() + 1;

  let foundHeader = false;
  let totalLinhas = 0;

  for (const row of rows) {
    const cells = row.querySelectorAll('td, th');
    const valores = Array.from(cells).map(c => c.textContent?.trim() || '');

    if (!foundHeader) {
      if (valores.some(v => v === 'Loja')) foundHeader = true;
      continue;
    }

    if (valores.length < 8 || !valores[0]) continue;

    const lojaNum = String(parseInt(valores[0]));
    if (lojaNum === 'NaN' || parseInt(lojaNum) < 1) continue;

    totalLinhas++;
    const storeId = storeMap.get(lojaNum);

    if (!storeId) {
      naoEncontradas.push(lojaNum);
      console.warn(`⚠️ Loja ${lojaNum} não encontrada no sistema`);
      continue;
    }

    dados.push({
      store_id: storeId,
      loja_numero: lojaNum,
      qtde_vendas: parseValorBR(valores[1]),
      qtde_itens: parseValorBR(valores[2]),
      pa: parseValorBR(valores[3]),
      pu: parseValorBR(valores[4]),
      ticket_medio: parseValorBR(valores[5]),
      meta: parseValorBR(valores[6]),
      valor_vendido: parseValorBR(valores[7]),
      data: dataStr,
      year,
      month
    });
  }

  if (dados.length === 0 && totalLinhas > 0) {
    throw new Error(`O arquivo possui ${totalLinhas} linhas, mas nenhuma loja foi identificada. Verifique se os números das lojas nas colunas 'Loja' ou 'Filial' conferem com o sistema.`);
  }

  if (naoEncontradas.length > 0) {
    console.warn(`⚠️ Lojas não encontradas: ${naoEncontradas.join(', ')}`);
  }

  console.log(`✅ ${dados.length} lojas parseadas de ${totalLinhas} linhas`);
  return dados;
}

/**
 * Parser para Excel real (.xlsx)
 */
async function parseMetasExcel(file: File, storeMap: Map<string, string>): Promise<MetaData[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // raw: true para manter números como números (evita problemas com datas seriais)
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true
  }) as any[][];

  const dados: MetaData[] = [];
  const naoEncontradas: string[] = [];

  // Encontrar cabeçalho
  let headerIndex = -1;
  for (let i = 0; i < rawData.length; i++) {
    if (rawData[i]?.some((v: any) => String(v).toLowerCase() === 'loja')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Cabeçalho "Loja" não encontrado no arquivo.');
  }

  // Detectar mês/ano da coluna "Data" (serial Excel) ou usar mês atual
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  // Procurar coluna "Data" no cabeçalho
  const headers = rawData[headerIndex].map((v: any) => String(v).toLowerCase().trim());
  const dataColIndex = headers.indexOf('data');

  if (dataColIndex !== -1 && rawData[headerIndex + 1]) {
    const dataValue = rawData[headerIndex + 1][dataColIndex];
    if (typeof dataValue === 'number' && dataValue > 40000) {
      // Converter serial Excel → Date
      // Excel serial: dias desde 1900-01-01 (com bug do 29/02/1900)
      const excelEpoch = new Date(1900, 0, 1);
      const jsDate = new Date(excelEpoch.getTime() + (dataValue - 2) * 86400000);
      year = jsDate.getFullYear();
      month = jsDate.getMonth() + 1;
      console.log(`📅 Data detectada do Excel serial ${dataValue}: ${month}/${year}`);
    }
  }

  let totalLinhas = 0;

  for (let i = headerIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length < 8) continue;

    const lojaNum = String(parseInt(row[0]));
    if (lojaNum === 'NaN' || parseInt(lojaNum) < 1) continue;

    totalLinhas++;
    const storeId = storeMap.get(lojaNum);

    if (!storeId) {
      naoEncontradas.push(lojaNum);
      console.warn(`⚠️ Loja ${lojaNum} não encontrada no sistema`);
      continue;
    }

    dados.push({
      store_id: storeId,
      loja_numero: lojaNum,
      qtde_vendas: parseValorBR(row[1]),
      qtde_itens: parseValorBR(row[2]),
      pa: parseValorBR(row[3]),
      pu: parseValorBR(row[4]),
      ticket_medio: parseValorBR(row[5]),
      meta: parseValorBR(row[6]),
      valor_vendido: parseValorBR(row[7]),
      data: `${year}-${String(month).padStart(2, '0')}-01`,
      year,
      month
    });
  }

  if (dados.length === 0 && totalLinhas > 0) {
    throw new Error(`O arquivo possui ${totalLinhas} linhas, mas nenhuma loja foi identificada. Verifique se os números das lojas nas colunas 'Loja' ou 'Filial' conferem com o sistema.`);
  }

  if (naoEncontradas.length > 0) {
    console.warn(`⚠️ Lojas não encontradas: ${naoEncontradas.join(', ')}`);
  }

  console.log(`✅ ${dados.length} lojas parseadas de ${totalLinhas} linhas`);
  return dados;
}

/**
 * Inserir no banco (DELETE + INSERT, pois constraint única foi removida)
 */
export async function insertMetas(dados: MetaData[]) {
  if (dados.length === 0) return;

  const year = dados[0].year;
  const month = dados[0].month;
  const storeIds = dados.map(d => d.store_id);

  console.log(`💾 Sincronizando ${dados.length} registros - ${month}/${year}...`);

  // 1. Deletar registros existentes para estas lojas/mês/ano
  const { error: deleteError } = await supabase
    .from('monthly_goals')
    .delete()
    .eq('year', year)
    .eq('month', month)
    .in('store_id', storeIds);

  if (deleteError) {
    console.error('Erro ao limpar registros anteriores:', deleteError);
    throw deleteError;
  }

  // 2. Inserir novos registros
  const insertData = dados.map(d => ({
    store_id: d.store_id,
    year: d.year,
    month: d.month,
    revenue_target: d.meta,
    items_target: d.qtde_itens,
    pa_target: d.pa,
    pu_target: d.pu,
    ticket_target: d.ticket_medio,
    business_days: 26,
    delinquency_target: 2,
    trend: 'stable'
  }));

  const { error: insertError } = await supabase
    .from('monthly_goals')
    .insert(insertData);

  if (insertError) {
    console.error('Erro ao inserir metas:', insertError);
    throw insertError;
  }

  console.log('✅ Importação concluída!');
}