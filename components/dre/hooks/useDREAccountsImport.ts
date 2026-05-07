import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/services/supabaseClient';
import type { DREData } from '../types/dre.types';

interface ImportError {
  row: number;
  field: string;
  error: string;
}

/**
 * Funções Auxiliares de Parsing
 */
function parseMesAno(text: string): string | null {
  if (!text) return null;
  const months: Record<string, string> = {
    'jan': '01', 'janeiro': '01',
    'fev': '02', 'fevereiro': '02',
    'mar': '03', 'março': '03', 'marco': '03',
    'abr': '04', 'abril': '04',
    'mai': '05', 'maio': '05',
    'jun': '06', 'junho': '06',
    'jul': '07', 'julho': '07',
    'ago': '08', 'agosto': '08',
    'set': '09', 'setembro': '09',
    'out': '10', 'outubro': '10',
    'nov': '11', 'novembro': '11',
    'dez': '12', 'dezembro': '12'
  };
  
  const cleanText = text.toLowerCase().trim();
  
  // 1. Padrão: "Março/2025" ou "03/2025" ou "Março-2025"
  const match1 = cleanText.match(/([a-zA-ZÀ-ÖØ-öø-ÿ0-9]+)[\/\-](\d{4})/);
  if (match1) {
    const mesValue = match1[1].substring(0, 3);
    const ano = match1[2];
    if (months[mesValue]) return `${ano}-${months[mesValue]}-01`;
    const mesNum = match1[1].padStart(2, '0');
    if (parseInt(mesNum) >= 1 && parseInt(mesNum) <= 12) return `${ano}-${mesNum}-01`;
  }

  // 2. Padrão: "jan.-25" ou "jan/25" ou "jan 25"
  const match2 = cleanText.match(/([a-z]{3})[\s\.\/\-]*(\d{2})$/);
  if (match2) {
    const mesShort = match2[1].substring(0, 3);
    const ano = "20" + match2[2];
    if (months[mesShort]) return `${ano}-${months[mesShort]}-01`;
  }
  
  // 3. Padrão: "Janeiro de 2025"
  const match3 = cleanText.match(/([a-z]{3,})\s+de\s+(\d{4})/);
  if (match3) {
    const mesName = match3[1].substring(0, 3);
    const ano = match3[2];
    if (months[mesName]) return `${ano}-${months[mesName]}-01`;
  }

  return null;
}

export const useDREAccountsImport = () => {
  const [importPreview, setImportPreview] = useState<DREData[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [importStats, setImportStats] = useState({ valid: 0, invalid: 0 });
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [mesReferencia, setMesReferencia] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * ✅ PARSER DRE - VERSÃO FINAL CORRIGIDA
   */
  const parseDREExcel = useCallback((rawData: any[][]): { 
    data: DREData[], 
    errors: ImportError[], 
    period: string | null 
  } => {
    const data: DREData[] = [];
    const errors: ImportError[] = [];
    let gruposIgnorados = 0;
    let descricoesImportadas = 0;
    
    if (rawData.length < 5) {
      errors.push({ row: 0, field: 'formato', error: 'Arquivo muito curto ou sem dados' });
      return { data, errors, period: null };
    }

    try {
      // PASSO 1: Extrair loja_id
      const lojaLine = String(rawData[2]?.[0] || '');
      const lojaMatch = lojaLine.match(/LOJA\s+(\d+)/i);
      const lojaId = lojaMatch ? parseInt(lojaMatch[1]) : 0;
      
      console.log('🏢 Loja detectada:', lojaId);

      // PASSO 2: Detectar colunas de meses (loop até col 26 para garantir 12 meses)
      const headerRow = rawData[3] || [];
      const monthColumns: { colIndex: number, date: string }[] = [];
      
      // ✅ CORREÇÃO: Loop até coluna 26 (Jan, Fev... Dez)
      for (let i = 3; i <= 26; i += 2) {
        const cellValue = headerRow[i];
        if (!cellValue) continue;

        let dateStr = '';

        if (cellValue instanceof Date) {
          // Ajustar fuso para evitar que dia 1 vire dia 31 do mês anterior
          const year = cellValue.getUTCFullYear();
          const month = String(cellValue.getUTCMonth() + 1).padStart(2, '0');
          dateStr = `${year}-${month}-01`;
        } else if (typeof cellValue === 'string') {
          // Tentar Iso ou Helper
          const matchIso = cellValue.match(/\d{4}-\d{2}-\d{2}/);
          if (matchIso) {
            dateStr = matchIso[0];
          } else {
            const parsed = parseMesAno(cellValue);
            if (parsed) dateStr = parsed;
          }
        }

        if (dateStr) {
          monthColumns.push({ colIndex: i, date: dateStr });
          console.log(`📅 Mês detectado: Col ${i} = ${dateStr}`);
        }
      }
      
      console.log(`✅ Total de meses detectados: ${monthColumns.length}`);
      if (monthColumns.length !== 12) {
        console.warn(`⚠️ AVISO: Esperava 12 meses, encontrou ${monthColumns.length}`);
      }

      if (monthColumns.length === 0) {
        errors.push({ row: 4, field: 'meses', error: 'Nenhum mês identificado na linha 4' });
        return { data, errors, period: null };
      }

      // PASSO 3: Processar linhas de dados
      for (let rowIdx = 4; rowIdx < rawData.length; rowIdx++) {
        const row = rawData[rowIdx] || [];
        
        const marcacaoColA = row[0]; // Col A - marcação especial
        const grupo = row[1] ? String(row[1]).trim() : null;
        const descricao = row[2] ? String(row[2]).trim() : null;
        
        // ✅ REGRA CRÍTICA: Importar APENAS linhas com DESCRIÇÃO (Col C)
        if (!descricao || descricao.trim() === '') {
          // Linha de GRUPO (total) - IGNORAR
          if (grupo && grupo.trim() !== '') {
            gruposIgnorados++;
            console.log(`❌ GRUPO ignorado (linha ${rowIdx + 1}): ${grupo}`);
          }
          continue;
        }

        // ✅ Linha de DESCRIÇÃO (detalhe) - IMPORTAR
        descricoesImportadas++;

        // Classificação baseada na Coluna A
        let type: 'RECEITA' | 'DESPESA' | 'CMV' | 'RESULTADO' = 'DESPESA';
        
        if (marcacaoColA) {
          const marcacao = String(marcacaoColA).toLowerCase().trim();
          
          if (marcacao.includes('receita')) {
            type = 'RECEITA';
          } 
          else if (marcacao.includes('compras') || marcacao.includes('cmv')) {
            type = 'CMV';
          }
          else if (marcacao.includes('lucro') || marcacao.includes('resultado') || marcacao.includes('líquido')) {
            type = 'RESULTADO';
          }
          else if (marcacao.includes('despesa')) {
            type = 'DESPESA';
          }
        }
        
        const code = grupo || descricao.substring(0, 20).toUpperCase().replace(/\s+/g, '_');
        const level = grupo ? 2 : 1;
        const parent_code = grupo ? grupo : null;
        
        // PASSO 4: Pivotar para cada mês
        monthColumns.forEach(({ colIndex, date }) => {
          const rawValue = row[colIndex];
          let valor = 0;

          if (typeof rawValue === 'number') {
            valor = rawValue;
          } else if (typeof rawValue === 'string') {
            const cleaned = rawValue.replace(/[^\d.,-]/g, '').replace(',', '.');
            valor = parseFloat(cleaned) || 0;
          }
          
          data.push({
            loja_id: lojaId,
            mes_referencia: date,
            code,
            name: descricao,
            type,
            level,
            parent_code,
            descricao,
            valor,
            grupo: null // Não importar o grupo pois é soma calculada
          });
        });
      }

      console.log(`\n✅ Descrições importadas: ${descricoesImportadas}`);
      console.log(`❌ Grupos ignorados (totais): ${gruposIgnorados}`);

      return { 
        data, 
        errors, 
        period: monthColumns[0]?.date || null 
      };

    } catch (err: any) {
      errors.push({ row: 0, field: 'parser', error: err.message });
      return { data, errors, period: null };
    }
  }, []);

  /**
   * ✅ HANDLER DE SELEÇÃO DE ARQUIVO
   */
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage('Lendo arquivo...');
    setImportProgress(10);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as ArrayBuffer;
        if (!result) throw new Error('Arquivo vazio');

        const workbook = XLSX.read(new Uint8Array(result), { 
          type: 'array',
          cellDates: true 
        });
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { 
          header: 1,
          raw: true // ✅ MUDADO: Pegar valores brutos (Dates como objetos Date)
        }) as any[][];

        setStatusMessage('Analisando estrutura...');
        setImportProgress(40);

        const { data, errors, period } = parseDREExcel(rawData);

        setImportPreview(data);
        setImportErrors(errors);
        setMesReferencia(period);
        setImportStats({ valid: data.length, invalid: errors.length });

        const receitaCount = data.filter(r => r.type === 'RECEITA').length;
        const cmvCount = data.filter(r => r.type === 'CMV').length;
        const despesaCount = data.filter(r => r.type === 'DESPESA').length;
        const resultadoCount = data.filter(r => r.type === 'RESULTADO').length;
        const mesesUnicos = new Set(data.map(r => r.mes_referencia)).size;

        console.log('\n📊 RESUMO DA IMPORTAÇÃO:');
        console.log(`Total de registros: ${data.length}`);
        console.log(`🟢 Receitas: ${receitaCount}`);
        console.log(`🟡 CMV: ${cmvCount}`);
        console.log(`🔴 Despesas: ${despesaCount}`);
        console.log(`🔵 Resultado: ${resultadoCount}`);
        console.log(`📅 Meses únicos: ${mesesUnicos}`);

        setStatusMessage(
          errors.length > 0 
            ? 'Arquivo lido com pendências' 
            : `${data.length} registros prontos | ${mesesUnicos} meses identificados`
        );
        setImportProgress(100);

      } catch (err) {
        console.error('Erro ao processar:', err);
        setImportErrors([{ row: 0, field: 'arquivo', error: 'Falha crítica ao ler o Excel' }]);
        setStatusMessage('Erro no processamento');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [parseDREExcel]);

  const resetImport = useCallback(() => {
    setImportPreview([]);
    setImportErrors([]);
    setImportStats({ valid: 0, invalid: 0 });
    setImportProgress(0);
    setStatusMessage('');
    setMesReferencia(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return {
    importPreview,
    importing,
    importProgress,
    statusMessage,
    importStats,
    importErrors,
    mesReferencia,
    fileInputRef,
    handleFileSelect,
    resetImport,
    setImporting,
    setImportProgress,
    setStatusMessage
  };
};