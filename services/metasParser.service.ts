import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

export interface MetaData {
  loja_id: number;
  qtde_vendas: number;
  qtde_itens: number;
  pa: number;
  pu: number;
  ticket_medio: number;
  meta: number;
  valor_vendido: number;
  data: string; // YYYY-MM-DD
  year: number;
  month: number;
}

/**
 * Converte valor brasileiro para número
 */
function parseValorBR(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  let str = String(value).trim();
  
  // Remover "R$", espaços
  str = str.replace(/R\$/g, '').replace(/\s/g, '');
  
  // Se tem vírgula E ponto: formato BR (1.000,50)
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '');  // Remove pontos
    str = str.replace(',', '.');    // Troca vírgula por ponto
  }
  // Se tem só vírgula: formato BR (1000,50)
  else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  // Se tem só ponto: pode ser milhar OU decimal
  else if (str.includes('.')) {
    const partes = str.split('.');
    if (partes[1] && partes[1].length === 3) {
      // É milhar: 1.000 → 1000
      str = str.replace('.', '');
    }
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Detecta tipo de arquivo e converte
 */
export async function parseMetasFile(file: File): Promise<MetaData[]> {
  const fileName = file.name.toLowerCase();
  
  // Se é HTML disfarçado de .xls
  if (fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
    console.log('🔍 Detectado: HTML (XLS falso)');
    return await parseMetasHTML(file);
  }
  
  // Se é Excel real
  console.log('🔍 Detectado: Excel (.xlsx)');
  return await parseMetasExcel(file);
}

/**
 * Parser para HTML (.xls falso)
 */
async function parseMetasHTML(file: File): Promise<MetaData[]> {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  
  const rows = doc.querySelectorAll('tr');
  const dados: MetaData[] = [];
  
  // Data atual (já que arquivo não tem)
  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0, 10);
  const year = hoje.getFullYear();
  const month = hoje.getMonth() + 1;
  
  console.log(`📅 Data detectada: ${dataStr} (${year}-${month})`);
  
  // Pular linhas de cabeçalho (encontrar linha com "Loja")
  let foundHeader = false;
  
  for (const row of rows) {
    const cells = row.querySelectorAll('td, th');
    const valores = Array.from(cells).map(c => c.textContent?.trim() || '');
    
    // Pular até achar cabeçalho
    if (!foundHeader) {
      if (valores.some(v => v === 'Loja')) {
        foundHeader = true;
        console.log('✅ Cabeçalho encontrado');
      }
      continue;
    }
    
    // Pular linhas vazias ou sem loja
    if (valores.length < 8 || !valores[0]) continue;
    
    // Tentar converter primeira coluna em número (loja)
    const lojaId = parseInt(valores[0]);
    if (isNaN(lojaId) || lojaId < 1) continue;
    
    // Parsear valores
    try {
      dados.push({
        loja_id: lojaId,
        qtde_vendas: parseValorBR(valores[1]),
        qtde_itens: parseValorBR(valores[2]),
        pa: parseValorBR(valores[3]),
        pu: parseValorBR(valores[4]),
        ticket_medio: parseValorBR(valores[5]),
        meta: parseValorBR(valores[6]),
        valor_vendido: parseValorBR(valores[7]),
        data: dataStr,
        year: year,
        month: month
      });
    } catch (err) {
      console.warn(`⚠️ Erro na linha da loja ${lojaId}:`, err);
    }
  }
  
  console.log(`✅ ${dados.length} lojas parseadas`);
  return dados;
}

/**
 * Parser para Excel real (.xlsx)
 */
async function parseMetasExcel(file: File): Promise<MetaData[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const rawData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    raw: false  // Ler como texto
  }) as any[][];
  
  const dados: MetaData[] = [];
  
  // Encontrar linha de cabeçalho
  let headerIndex = -1;
  for (let i = 0; i < rawData.length; i++) {
    if (rawData[i].some((v: any) => String(v).toLowerCase() === 'loja')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    throw new Error('Cabeçalho "Loja" não encontrado');
  }
  
  // Data da última coluna (ou data atual)
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;
  
  // Processar dados
  for (let i = headerIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length < 8) continue;
    
    const lojaId = parseInt(row[0]);
    if (isNaN(lojaId)) continue;
    
    dados.push({
      loja_id: lojaId,
      qtde_vendas: parseValorBR(row[1]),
      qtde_itens: parseValorBR(row[2]),
      pa: parseValorBR(row[3]),
      pu: parseValorBR(row[4]),
      ticket_medio: parseValorBR(row[5]),
      meta: parseValorBR(row[6]),
      valor_vendido: parseValorBR(row[7]),
      data: new Date().toISOString().slice(0, 10),
      year: year,
      month: month
    });
  }
  
  return dados;
}

/**
 * Inserir no banco (com UPSERT)
 */
export async function insertMetas(dados: MetaData[]) {
  if (dados.length === 0) return;

  const year = dados[0].year;
  const month = dados[0].month;
  
  console.log(`💾 Sincronizando ${dados.length} registros - ${month}/${year}...`);
  
  // Usar UPSERT conforme padrão do sistema
  // Mapeando para os nomes de coluna corretos conforme App.tsx
  const upsertData = dados.map(d => ({
    store_id: d.loja_id,
    year: d.year,
    month: d.month,
    revenue_target: d.meta,
    items_target: d.qtde_itens,
    pa_target: d.pa,
    pu_target: d.pu,
    ticket_target: d.ticket_medio,
    business_days: 26, // Valor padrão
    delinquency_target: 2, // Valor padrão
    trend: 'stable'
  }));

  const { error } = await supabase
    .from('monthly_goals')
    .upsert(upsertData, { onConflict: 'store_id, year, month' });
  
  if (error) {
    console.error('Erro ao inserir:', error);
    throw error;
  }
  
  console.log('✅ Importação concluída!');
}
