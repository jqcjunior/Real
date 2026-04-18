// ============================================================================
// PARSER DE EXCEL DRE - VERSÃO CORRIGIDA
// Lê o formato REAL da planilha Total_2025.xlsx
// ============================================================================

import * as XLSX from 'xlsx';
import { supabase } from '../../../services/supabaseClient';

// ============================================================================
// TIPOS
// ============================================================================

export interface DREDataParsed {
  loja_id: number;
  mes_referencia: string; // 'YYYY-MM-DD'
  grupo: string | null;
  descricao: string;
  valor: number;
}

export interface ParseResult {
  success: boolean;
  data: DREDataParsed[];
  totalLinhas: number;
  totalLojas: number;
  lojasEncontradas: number[];
  mesesEncontrados: string[];
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  // Estrutura da planilha
  HEADER_ROW: 4, // Linha 4 (índice 3 em array 0-based)
  DATA_START_ROW: 5, // Dados começam na linha 5
  
  // Colunas fixas (0-based)
  COL_GRUPO: 1, // Coluna B
  COL_DESCRICAO: 2, // Coluna C
  COL_LOJA: 3, // Coluna D (Lj)
  COL_PRIMEIRO_MES: 4, // Coluna E (primeiro mês)
  
  // Lojas esperadas
  LOJAS_ESPERADAS: [5, 8, 9, 26, 31, 34, 40, 43, 44, 45, 50, 56, 72, 88, 96, 100, 102, 109]
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Converte data do Excel para objeto Date
 */
function excelDateToJSDate(value: any): Date | null {
  if (value === null || value === undefined) return null;
  
  let date: Date | null = null;
  
  // Se já é Date
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    // Se for número pequeno (1-12), tratar como mês de 2025
    if (value >= 1 && value <= 12) {
      date = new Date(2025, value - 1, 1);
    } else if (value >= 40000) {
      // Excel conta dias desde 1900-01-01 (com ajuste de bug)
      date = new Date((value - 25569) * 86400 * 1000);
    }
  } else if (typeof value === 'string') {
    const str = value.toLowerCase().trim();
    
    // Tentar extrair apenas números da string para ver se é 1-12
    const onlyDigits = str.replace(/\D/g, '');
    const monthNum = parseInt(onlyDigits);
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 && onlyDigits.length <= 2) {
      date = new Date(2025, monthNum - 1, 1);
    } else {
      // Tentar converter jan/25, fev/25, etc
      const months: Record<string, number> = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11,
        'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
        'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
      };

      for (const [name, index] of Object.entries(months)) {
        if (str.includes(name)) {
          date = new Date(2025, index, 1);
          break;
        }
      }
    }

    if (!date) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) date = d;
    }
  }
  
  // Correção final: Se o ano for 2001, forçar para 2025 
  // (comum em erros de interpretação de formats como 01/01/25 no browser)
  // Ou se for um ano muito distante de 2025 (como 1900 ou 1970)
  if (date) {
    const year = date.getFullYear();
    if (year === 2001 || year < 2010 || year > 2030) {
      date.setFullYear(2025);
    }
    // Garantir primeiro dia do mês às 12h para evitar problemas de timezone
    date.setDate(1);
    date.setHours(12, 0, 0, 0);
  }
  
  return date;
}

/**
 * Extrai número da loja
 */
function extractLojaNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  const str = String(value).trim();
  if (!str) return null;
  
  const lowerStr = str.toLowerCase();
  
  // Se é "Tot" ou "Total" ou "Total Rede", pular (não é uma loja individual)
  if (lowerStr === 'tot' || lowerStr === 'total' || lowerStr.includes('total rede')) {
    return null;
  }
  
  // Se for número direto
  if (typeof value === 'number') return Math.floor(value);
  
  // Tentar extrair apenas números da string (ex: "Loja 01" -> 1)
  const numbers = str.match(/\d+/);
  if (numbers) {
    const parsed = parseInt(numbers[0], 10);
    // Se for 999, geralmente é um totalizador no Excel, vamos pular também para garantir
    if (parsed === 999) return null;
    return parsed;
  }
  
  return null;
}

/**
 * Converte valor para número (Formato Brasileiro)
 */
function parseValor(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  
  // Se já é número
  if (typeof value === 'number') return value;
  
  // Se é string, limpar e converter
  if (typeof value === 'string') {
    // 1. Remover R$, espaços e outros caracteres não numéricos exceto ponto e vírgula
    let cleaned = value.trim()
      .replace(/R\$/g, '')
      .replace(/\s/g, '');
    
    // 2. Remover pontos (separador de milhar no Brasil)
    cleaned = cleaned.replace(/\./g, '');
    
    // 3. Trocar vírgula por ponto (separador decimal)
    cleaned = cleaned.replace(',', '.');
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
}

// ============================================================================
// PARSER PRINCIPAL
// ============================================================================

/**
 * Parse do arquivo Excel DRE
 */
export async function parseExcelDRE(file: File): Promise<ParseResult> {
  try {
    // Ler arquivo
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellStyles: false
    });
    
    // Primeira sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Converter para array de arrays
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      defval: null
    }) as any[][];
    
    console.log('Total de linhas no Excel:', rawData.length);
    
    // ========================================================================
    // EXTRAIR DATAS DOS MESES DO CABEÇALHO
    // ========================================================================
    
    // ========================================================================
    // EXTRAIR DATAS DOS MESES DO CABEÇALHO (DINÂMICO)
    // ========================================================================
    
    // Tentar encontrar a linha de cabeçalho dinamicamente
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawData.length, 25); i++) {
      const row = rawData[i];
      if (row && row.some(cell => {
        if (typeof cell !== 'string') return false;
        const c = cell.toLowerCase().trim();
        return c === 'descrição' || c === 'descritivo' || c === 'conta' || c === 'dez' || c === 'dezembro';
      })) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      headerRowIndex = CONFIG.HEADER_ROW - 1; // Fallback
    }

    const headerRow = rawData[headerRowIndex];
    if (!headerRow) {
      return {
        success: false,
        data: [],
        totalLinhas: 0,
        totalLojas: 0,
        lojasEncontradas: [],
        mesesEncontrados: [],
        errors: ['Cabeçalho não encontrado na planilha']
      };
    }
    
    console.log(`Cabeçalho detectado na linha ${headerRowIndex + 1}`);

    // Extrair datas das colunas (procurar 12 meses consecutivos)
    const mesesDatas: Date[] = [];
    const mesesColIndices: number[] = [];
    
    // Varre a linha do cabeçalho procurando por datas
    for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
      const cellValue = headerRow[colIndex];
      if (!cellValue) continue;

      const date = excelDateToJSDate(cellValue);
      if (date) {
        // Ignorar se já temos 12 meses e esta data é de outro ano ou duplicada
        mesesDatas.push(date);
        mesesColIndices.push(colIndex);
        if (mesesDatas.length === 12) break;
      }
    }
    
    console.log('Meses detectados:', mesesDatas.map(d => d.toISOString().slice(0, 7)));
    
    if (mesesDatas.length === 0) {
      const headerPreview = headerRow.slice(0, 15).map(c => typeof c === 'string' ? c : JSON.stringify(c)).join(' | ');
      return {
        success: false,
        data: [],
        totalLinhas: 0,
        totalLojas: 0,
        lojasEncontradas: [],
        mesesEncontrados: [],
        errors: [
          'Nenhuma data de mês encontrada no cabeçalho.',
          `Conteúdo detectado na Linha ${headerRowIndex + 1}: ${headerPreview}`,
          'Certifique-se que as colunas de meses (Jan-Dez) estão na mesma linha que "Descrição".'
        ]
      };
    }

    // Atualizar DATA_START_ROW se o cabeçalho mudou
    const dataStartRowIndex = headerRowIndex + 1;

     // ========================================================================
    // PROCESSAR LINHAS DE DADOS
    // ========================================================================
    
    const parsedData: DREDataParsed[] = [];
    let currentGrupo: string | null = null;
    let currentDescricao: string | null = null;
    const lojasEncontradas = new Set<number>();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Identificar colunas fixas baseado no cabeçalho se possível
    let colGrupo = CONFIG.COL_GRUPO;
    let colDesc = CONFIG.COL_DESCRICAO;
    let colLoja = CONFIG.COL_LOJA;

    headerRow.forEach((cell, idx) => {
      if (typeof cell !== 'string' && typeof cell !== 'number') return;
      const c = String(cell).toLowerCase().trim();
      if (c.includes('grupo')) colGrupo = idx;
      if (c === 'descrição' || c === 'descritivo' || c === 'conta' || c === 'dez' || c === 'dezembro') colDesc = idx;
      if (c === 'lj' || c === 'loja' || c === 'id loja' || c === 'cod lj') colLoja = idx;
    });

    console.log(`Colunas mapeadas: Grupo=${colGrupo}, Desc=${colDesc}, Loja=${colLoja}`);

    for (let rowIndex = dataStartRowIndex; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;
      
      try {
        const grupoRaw = row[colGrupo];
        const descRaw = row[colDesc];
        const lojaRaw = row[colLoja];

        // 1. Atualizar "Sticky" Grupo e Descrição
        // Se a linha atual trouxer um novo grupo ou descrição, atualizamos a memória
        if (grupoRaw && String(grupoRaw).toLowerCase() !== 'grupo' && String(grupoRaw) !== 'null') {
            currentGrupo = String(grupoRaw).trim();
        }
        
        if (descRaw && String(descRaw).toLowerCase() !== 'descrição' && String(descRaw) !== 'null') {
            currentDescricao = String(descRaw).trim();
        }
        
        // 2. Identificar se esta linha contém dados de uma loja específica
        const lojaId = extractLojaNumber(lojaRaw);
        
        // Se não identificou número de loja ou se a coluna de loja diz "Total/Tot", 
        // apenas pulamos para a próxima linha (mas a descrição acima fica salva)
        if (lojaId === null) {
            continue;
        }

        // 3. Garantir que temos uma descrição para atribuir ao valor
        if (!currentDescricao) {
            continue;
        }

        lojasEncontradas.add(lojaId);
        
        // 4. Ler valores dos meses para esta loja e esta conta
        for (let i = 0; i < mesesDatas.length; i++) {
          const colIndex = mesesColIndices[i];
          const valorRaw = row[colIndex];
          
          const mesData = mesesDatas[i];
          const mesReferencia = mesData.toISOString().slice(0, 10); // 'YYYY-MM-DD'
          const valor = parseValor(valorRaw);
          
          parsedData.push({
            loja_id: lojaId,
            mes_referencia: mesReferencia,
            grupo: currentGrupo,
            descricao: currentDescricao,
            valor
          });
        }
        
      } catch (err) {
        errors.push(`Erro na linha ${rowIndex + 1}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }
    
    // ========================================================================
    // VALIDAÇÕES
    // ========================================================================
    
    // Verificar lojas faltando
    const lojasFaltando = CONFIG.LOJAS_ESPERADAS.filter(
      l => !lojasEncontradas.has(l)
    );
    
    if (lojasFaltando.length > 0) {
      warnings.push(`Lojas não encontradas: ${lojasFaltando.join(', ')}`);
    }
    
    // Verificar número de meses
    if (mesesDatas.length < 12) {
      warnings.push(`Apenas ${mesesDatas.length} meses encontrados (esperado: 12)`);
    }
    
    // ========================================================================
    // RESULTADO
    // ========================================================================
    
    return {
      success: parsedData.length > 0,
      data: parsedData,
      totalLinhas: parsedData.length,
      totalLojas: lojasEncontradas.size,
      lojasEncontradas: Array.from(lojasEncontradas).sort((a, b) => a - b),
      mesesEncontrados: mesesDatas.map(d => d.toISOString().slice(0, 7)),
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
    
  } catch (error) {
    console.error('Erro ao processar Excel:', error);
    return {
      success: false,
      data: [],
      totalLinhas: 0,
      totalLojas: 0,
      lojasEncontradas: [],
      mesesEncontrados: [],
      errors: [`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]
    };
  }
}

// ============================================================================
// INSERÇÃO NO SUPABASE
// ============================================================================

/**
 * Insere dados parseados no Supabase
 */
export async function insertDREDataParsed(
  data: DREDataParsed[]
): Promise<{ success: boolean; error?: string }> {
  
  const BATCH_SIZE = 1000;
  
  try {
    // Inserir em lotes de 1000
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      
      console.log(`Inserindo lote ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} registros)...`);
      
      const { error } = await supabase
        .from('dre_data')
        .insert(batch);
      
      if (error) {
        console.error('Erro ao inserir lote:', error);
        return {
          success: false,
          error: `Erro ao inserir dados: ${error.message}`
        };
      }
    }
    
    console.log(`✅ Total de ${data.length} registros inseridos com sucesso!`);
    
    return { success: true };
    
  } catch (error) {
    console.error('Erro na inserção:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}
