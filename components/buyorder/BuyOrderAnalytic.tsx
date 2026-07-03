import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Upload, FileSpreadsheet, Download, Search, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

// ==================== TIPOS ====================
interface SupplierItem {
  loja: number;
  marca: string;
  referencia: string;
  estoqueQtde: number;
  compraQtde: number;
  vendaQtde: number;
  consumoPerc: number;
  vendaValor: number;
  ultimaCompra: string;
  diasEstoque: number;
  ano: number;
  percVenda: number;
  velocidade: number;      // vendaQtde / max(diasEstoque, 1)
  cobertura: number | null; // estoqueQtde / velocidade, null se zerado
}

interface ProcessedData {
  items: SupplierItem[];
  lojas: number[];
  anos: number[];
  marca: string;
}

interface MultiSupplierItem {
  loja: number;
  marca: string;
  referencia: string;
  estoqueQtde: number;
  compraQtde: number;
  vendaQtde: number;
  consumoPerc: number;
  vendaValor: number;
  ultimaCompra: string;
  diasEstoque: number;
  ano: number;
  percVenda: number;
  velocidade: number;
  cobertura: number | null;
  
  // Novas colunas mapeadas
  precoCompra: number;
  sugestaoCompra: number;
  coberturaFornecedor: number | null;
  markupInicial: number;
  markupReal: number;
  pedidosPendentesQtde: number;
  
  // Novas métricas calculadas
  margemUnitaria: number;
  margemReais: number;
}

interface MultiProcessedData {
  items: MultiSupplierItem[];
  lojas: number[];
  marcas: string[];
  anos: number[];
}

interface BuyOrderAnalyticProps {
  user: any;
  stores: any[];
}

// ==================== COMPONENTE PRINCIPAL ====================
const BuyOrderAnalytic: React.FC<BuyOrderAnalyticProps> = ({ user, stores }) => {
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Estados do Fluxo de Várias Marcas (Multi-Marcas)
  const [multiProcessedData, setMultiProcessedData] = useState<MultiProcessedData | null>(null);
  const [isProcessingMulti, setIsProcessingMulti] = useState(false);
  const [errorMulti, setErrorMulti] = useState<string | null>(null);
  const [isExportingMulti, setIsExportingMulti] = useState(false);
  const [selectedLojaMulti, setSelectedLojaMulti] = useState<number>(0);
  const [selectedTabMulti, setSelectedTabMulti] = useState<'resumo' | 'lojas'>('resumo');

  // Filtros (fluxo de uma única marca)
  const [selectedLoja, setSelectedLoja] = useState<number | 'all'>('all');
  const [selectedAno, setSelectedAno] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // ==================== PROCESSAR ARQUIVO ====================
  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Acesso robusto à biblioteca em diferentes ambientes (Sandbox/Vite)
      const X = XLSX as any;
      const API = (X && X.utils) ? X : (X?.default || X);
      
      if (!API || !API.utils) {
        throw new Error('A biblioteca de planilhas (XLSX) não pôde ser inicializada. Recarregue a página e tente novamente.');
      }

      console.log('XLSX carregado com sucesso');

      // Ler arquivo como ArrayBuffer (mais estável em iFrames)
      const data = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      // Parsear workbook
      const workbook = API.read(data, { type: 'array' });
      console.log('Workbook carregado com sucesso');
      
      if (!workbook.SheetNames?.length) {
        throw new Error('Nenhuma planilha encontrada no arquivo.');
      }

      let sheetName = workbook.SheetNames[0];
      let sheet = workbook.Sheets[sheetName];
      
      if (!sheet) {
        throw new Error('Não foi possível ler a primeira página da planilha.');
      }

      let rawData: any[] = API.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

      // Se primeira sheet está vazia, tentar segunda
      if (rawData.length < 10 && workbook.SheetNames.length > 1) {
        sheetName = workbook.SheetNames[1];
        sheet = workbook.Sheets[sheetName];
        if (sheet) {
          rawData = API.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
        }
      }

      // 🔍 DETECÇÃO DE CABEÇALHO RESILIENTE
      let headerRowIndex = -1;
      const keywords = ['loja', 'filial', 'unidade', 'referência', 'venda'];

      for (let i = 0; i < Math.min(25, rawData.length); i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;
        
        const rowText = row.map(cell => 
          String(cell || '').toLowerCase().trim()
        ).join(' ');
        
        // Se encontrar pelo menos 3 palavras-chave, é o header
        const matchCount = keywords.filter(kw => rowText.includes(kw)).length;
        if (matchCount >= 3) {
          headerRowIndex = i;
          console.log(`✅ Header encontrado na linha ${i + 1}`);
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error(
          'Não foi possível identificar o cabeçalho do relatório. ' +
          'Verifique se o arquivo contém as colunas: Loja, Referência, Venda'
        );
      }

      const headers = rawData[headerRowIndex];
      const dataRows = rawData.slice(headerRowIndex + 1);

      // ✅ Buscar colunas com apelidos (fuzzy match)
      const getColIndex = (exactNames: string[], aliases: string[] = []): number => {
        const allNames = [...exactNames, ...aliases];
        
        for (const name of allNames) {
          const normalized = name.toLowerCase().trim();
          
          for (let i = 0; i < headers.length; i++) {
            const header = String(headers[i] || '').toLowerCase().trim();
            
            // Match exato
            if (header === normalized) return i;
            
            // Match parcial (contém)
            if (header.includes(normalized) || normalized.includes(header)) {
              if (header.length > 2) return i; // Evita matches muito curtos
            }
          }
        }
        return -1;
      };

      const colIndices = {
        loja: getColIndex(['Loja'], ['Filial', 'Unidade', 'Cod Loja', 'Código Loja']),
        marca: getColIndex(['Marca'], ['Fabricante', 'Brand']),
        referencia: getColIndex(['Referência'], ['Ref', 'Código', 'SKU']),
        estoqueQtde: getColIndex(['Estoque (Qtde)'], ['Estoque Qtde', 'Qtd Estoque', 'Estoque']),
        compraQtde: getColIndex(['Compra (Qtde)'], ['Compra Qtde', 'Qtd Compra', 'Compras']),
        vendaQtde: getColIndex(['Venda (Qtde)'], ['Venda Qtde', 'Qtd Venda', 'Vendas']),
        vendaValor: getColIndex(['Preço Venda'], ['Preco Venda', 'Preço de Venda', 'Venda (R$)', 'Valor Venda']),
        ultimaCompra: getColIndex(['Última Compra'], ['Data Compra', 'Dt Compra']),
        diasEstoque: getColIndex(['Dias em Estoque'], ['Dias Estoque', 'Dias'])
      };

      console.log('DEBUG - Mapeamento de colunas:', colIndices);

      // ✅ Validar apenas colunas REALMENTE obrigatórias
      const colunasObrigatorias = [];

      if (colIndices.loja === -1) {
        colunasObrigatorias.push('Loja (ou Filial/Unidade)');
      }
      if (colIndices.referencia === -1) {
        colunasObrigatorias.push('Referência (ou Ref/Código)');
      }

      if (colunasObrigatorias.length > 0) {
        throw new Error(
          `Colunas obrigatórias não encontradas: ${colunasObrigatorias.join(', ')}. ` +
          `Verifique se o relatório está no formato correto. ` +
          `(Tente converter para .xlsx se estiver usando .xls)`
        );
      }

      const items: SupplierItem[] = dataRows
        .map((row: any[]) => {
          if (!Array.isArray(row) || row.length === 0) return null;

          const getValue = (idx: number, defaultVal: any = '') => {
            if (idx === -1) return defaultVal;
            const val = row[idx];
            return val === '' || val === null || val === undefined ? defaultVal : val;
          };

          const lojaVal = getValue(colIndices.loja, 0);
          const referenciaVal = getValue(colIndices.referencia, '');

          // Pular linhas vazias
          if (!lojaVal || !referenciaVal || String(referenciaVal).trim() === '') {
            return null;
          }

          // Processar data
          const ultimaCompraRaw = getValue(colIndices.ultimaCompra, '');
          let ultimaCompraDate = '';
          let ano: number | undefined;

          if (ultimaCompraRaw && ultimaCompraRaw !== '') {
            try {
              let dateObj: Date | null = null;

              if (typeof ultimaCompraRaw === 'number') {
                // Serial do Excel: dias desde 1899-12-30
                const msPerDay = 86400000;
                const epoch = new Date(1899, 11, 30).getTime();
                dateObj = new Date(epoch + Math.floor(ultimaCompraRaw) * msPerDay);
              } else if (typeof ultimaCompraRaw === 'string') {
                const s = ultimaCompraRaw.trim();
                if (s.includes('/')) {
                  const parts = s.split('/');
                  if (parts.length === 3) {
                    const p0 = parseInt(parts[0]);
                    const p1 = parseInt(parts[1]);
                    let p2 = parseInt(parts[2]);
                    if (p2 < 100) p2 += 2000; // "26" → 2026
                    if (p0 > 12) {
                      dateObj = new Date(p2, p1 - 1, p0); // DD/MM/YYYY
                    } else {
                      dateObj = new Date(p2, p0 - 1, p1); // MM/DD/YYYY
                    }
                  }
                } else if (s.includes('-')) {
                  dateObj = new Date(s); // YYYY-MM-DD
                }
              } else if (ultimaCompraRaw instanceof Date) {
                dateObj = ultimaCompraRaw;
              }

              if (dateObj && !isNaN(dateObj.getTime())) {
                const y = dateObj.getFullYear();
                if (y >= 2010 && y <= 2035) {
                  ano = y;
                  ultimaCompraDate = dateObj.toLocaleDateString('pt-BR');
                }
              }
            } catch (e) {
              console.warn('Erro ao parsear data:', e);
            }
          }

          // Converter números
          const parseNumber = (val: any): number => {
            if (val === '' || val === null || val === undefined) return 0;
            if (typeof val === 'number') return val;
            const str = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
          };

          const estoqueQtde = parseNumber(getValue(colIndices.estoqueQtde, 0));
          const compraQtde = parseNumber(getValue(colIndices.compraQtde, 0));
          const vendaQtde = parseNumber(getValue(colIndices.vendaQtde, 0));

          // Calcular % de venda
          const estoqueInicial = estoqueQtde + vendaQtde - compraQtde;
          const totalDisponivel = estoqueInicial + compraQtde;
          const percVenda = totalDisponivel > 0 ? (vendaQtde / totalDisponivel) * 100 : 0;

          const diasEst = parseNumber(getValue(colIndices.diasEstoque, 0));
          const velocidade = vendaQtde / Math.max(diasEst, 1);
          const cobertura = velocidade > 0 && estoqueQtde > 0
            ? Math.round(estoqueQtde / velocidade)
            : estoqueQtde <= 0 ? 0 : null;

          return {
            loja: parseNumber(lojaVal),
            marca: String(getValue(colIndices.marca, '')),
            referencia: String(referenciaVal).trim(),
            estoqueQtde,
            compraQtde,
            vendaQtde,
            consumoPerc: 0,
            vendaValor: parseNumber(getValue(colIndices.vendaValor, 0)),
            ultimaCompra: ultimaCompraDate,
            diasEstoque: diasEst,
            ano,
            percVenda,
            velocidade,
            cobertura
          };
        })
        .filter((item): item is SupplierItem => item !== null && item.loja > 0);

      if (items.length === 0) {
        throw new Error('Nenhum dado válido encontrado. Verifique o formato do arquivo.');
      }

      const lojas = Array.from(new Set(items.map(item => item.loja))).sort((a, b) => a - b);
      // Pegar os 2 anos mais recentes
      const anos = Array.from(new Set(items.map(item => item.ano).filter(Boolean)))
        .sort((a, b) => b! - a!)
        .slice(0, 2) as number[];
      const marca = items.find(item => item.marca)?.marca || 'Fornecedor';

      console.log('Arquivo processado com sucesso');

      setProcessedData({ items, lojas, anos, marca });

    } catch (err: any) {
      console.error('Erro detalhado ao processar arquivo:', err);
      const errorMsg = err?.message || 'Erro desconhecido ao processar arquivo';
      setError(`${errorMsg} (Tente converter para .xlsx se estiver usando .xls)`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== CONSTANTES E AUXILIARES MULTI-MARCAS ====================
  const PISO_MINIMO_PARES = 5;

  const checkVendeuBem = (item: MultiSupplierItem) => {
    return item.percVenda >= 50 && item.compraQtde >= PISO_MINIMO_PARES;
  };

  const fmtCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getBrandColor = (brand: string) => {
    const colors = [
      { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', fill: 'FFE8DAEF', darkText: 'FF6C3483' },
      { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', fill: 'FFD4E6F1', darkText: 'FF1F4E79' },
      { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', fill: 'FFD4EDDA', darkText: 'FF1E6B3A' },
      { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', fill: 'FFFADBD8', darkText: 'FFC0392B' },
      { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', fill: 'FFFDEBD0', darkText: 'FFB9770E' },
      { text: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', fill: 'FFD1F2EB', darkText: 'FF117A65' },
      { text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', fill: 'FFE8EAF6', darkText: 'FF3F51B5' },
    ];
    let hash = 0;
    for (let i = 0; i < brand.length; i++) {
      hash = brand.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  const getStatusAndColors = (estoqueQtde: number, percVenda: number) => {
    if (estoqueQtde <= 0) {
      return {
        text: 'ZEROU ⚠',
        excelBg: 'FFFADBD8',
        uiBg: 'bg-[#FADBD8] text-[#900C3F]', // red
      };
    } else if (percVenda >= 80) {
      return {
        text: 'ÓTIMO',
        excelBg: 'FFD4EDDA',
        uiBg: 'bg-[#D4EDDA] text-[#155724]', // green
      };
    } else if (percVenda >= 50) {
      return {
        text: 'BOM',
        excelBg: 'FFD5F5E3',
        uiBg: 'bg-[#D5F5E3] text-[#155724]', // light green
      };
    } else if (percVenda >= 25) {
      return {
        text: 'REGULAR',
        excelBg: 'FFFEF9E7',
        uiBg: 'bg-[#FEF9E7] text-[#856404]', // yellow
      };
    } else {
      return {
        text: 'PÉSSIMO',
        excelBg: 'FFFADBD8',
        uiBg: 'bg-[#FADBD8] text-[#721C24]', // red
      };
    }
  };

  // ==================== PROCESSAR ARQUIVO MULTI-MARCAS ====================
  const processFileMulti = async (file: File) => {
    setIsProcessingMulti(true);
    setErrorMulti(null);

    try {
      const X = XLSX as any;
      const API = (X && X.utils) ? X : (X?.default || X);
      
      if (!API || !API.utils) {
        throw new Error('A biblioteca de planilhas (XLSX) não pôde ser inicializada. Recarregue a página e tente novamente.');
      }

      const data = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      const uint8 = new Uint8Array(data);
      const isUtf16le = uint8[0] === 0xFF && uint8[1] === 0xFE;
      
      const firstBytes = uint8.slice(0, Math.min(200, uint8.length));
      let decodedSnippet = '';
      if (isUtf16le) {
        decodedSnippet = new TextDecoder('utf-16le').decode(firstBytes);
      } else {
        decodedSnippet = new TextDecoder('utf-8').decode(firstBytes);
      }

      const isHtmlDisguised = /<table|<style|<html/i.test(decodedSnippet);
      console.log('Multi-marcas: detectado HTML disfarçado:', isHtmlDisguised);

      let rawData: any[][] = [];

      if (isHtmlDisguised) {
        let texto = '';
        if (isUtf16le) {
          texto = new TextDecoder('utf-16le').decode(data);
        } else {
          const textUtf8 = new TextDecoder('utf-8').decode(data);
          const replacementUtf8 = (textUtf8.match(/\uFFFD/g) || []).length;
          const textUtf16 = new TextDecoder('utf-16le').decode(data);
          const replacementUtf16 = (textUtf16.match(/\uFFFD/g) || []).length;

          texto = replacementUtf8 <= replacementUtf16 ? textUtf8 : textUtf16;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(texto, 'text/html');
        const tables = Array.from(doc.querySelectorAll('table'));
        let bestTable: HTMLTableElement | null = null;
        let maxMatches = 0;
        const targetKeywords = ['loja', 'marca', 'referência', 'venda'];

        for (const table of tables) {
          const firstRow = table.querySelector('tr');
          if (!firstRow) continue;
          const cells = Array.from(firstRow.querySelectorAll('th, td'));
          const rowText = cells.map(c => 
            (c.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          ).join(' ');

          let matches = 0;
          for (const kw of targetKeywords) {
            const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (rowText.includes(normalizedKw)) {
              matches++;
            }
          }

          if (matches >= 3 && matches > maxMatches) {
            maxMatches = matches;
            bestTable = table;
          }
        }

        if (!bestTable) {
          throw new Error('Nenhuma tabela de dados válida encontrada no arquivo HTML disfarçado.');
        }

        const rows = Array.from(bestTable.querySelectorAll('tr'));
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('th, td'));
          const rowValues = cells.map(cell => (cell.textContent || '').trim());
          rawData.push(rowValues);
        }
      } else {
        const workbook = API.read(data, { type: 'array' });
        if (!workbook.SheetNames?.length) {
          throw new Error('Nenhuma planilha encontrada no arquivo.');
        }

        let sheetName = workbook.SheetNames[0];
        let sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          throw new Error('Não foi possível ler a primeira página da planilha.');
        }

        rawData = API.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

        if (rawData.length < 10 && workbook.SheetNames.length > 1) {
          sheetName = workbook.SheetNames[1];
          sheet = workbook.Sheets[sheetName];
          if (sheet) {
            rawData = API.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
          }
        }
      }

      // Detecção de cabeçalho
      let headerRowIndex = -1;
      const keywords = ['loja', 'filial', 'unidade', 'referência', 'venda'];

      for (let i = 0; i < Math.min(25, rawData.length); i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;
        const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
        const matchCount = keywords.filter(kw => rowText.includes(kw)).length;
        if (matchCount >= 3) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('Não foi possível identificar o cabeçalho do relatório de várias marcas.');
      }

      const headers = rawData[headerRowIndex];
      const dataRows = rawData.slice(headerRowIndex + 1);

      const getColIndex = (exactNames: string[], aliases: string[] = []): number => {
        const allNames = [...exactNames, ...aliases];
        for (const name of allNames) {
          const normalized = name.toLowerCase().trim();
          for (let i = 0; i < headers.length; i++) {
            const header = String(headers[i] || '').toLowerCase().trim();
            if (header === normalized) return i;
            if (header.includes(normalized) || normalized.includes(header)) {
              if (header.length > 2) return i;
            }
          }
        }
        return -1;
      };

      const colIndices = {
        loja: getColIndex(['Loja'], ['Filial', 'Unidade', 'Cod Loja', 'Código Loja']),
        marca: getColIndex(['Marca'], ['Fabricante', 'Brand']),
        referencia: getColIndex(['Referência'], ['Ref', 'Código', 'SKU']),
        estoqueQtde: getColIndex(['Estoque (Qtde)'], ['Estoque Qtde', 'Qtd Estoque', 'Estoque']),
        compraQtde: getColIndex(['Compra (Qtde)'], ['Compra Qtde', 'Qtd Compra', 'Compras']),
        vendaQtde: getColIndex(['Venda (Qtde)'], ['Venda Qtde', 'Qtd Venda', 'Vendas']),
        vendaValor: getColIndex(['Preço Venda'], ['Preco Venda', 'Preço de Venda', 'Venda (R$)', 'Valor Venda']),
        ultimaCompra: getColIndex(['Última Compra'], ['Data Compra', 'Dt Compra']),
        diasEstoque: getColIndex(['Dias em Estoque'], ['Dias Estoque', 'Dias']),
        precoCompra: getColIndex(['Preço Compra'], ['Preco Compra']),
        sugestaoCompra: getColIndex(['Sugestão de Compra'], ['Sugestao de Compra']),
        coberturaFornecedor: getColIndex(['Cobertura']),
        markupInicial: getColIndex(['Markup Inicial']),
        markupReal: getColIndex(['Markup Real']),
        pedidosPendentesQtde: getColIndex(['Pedidos Pendentes (Qtde)'])
      };

      const colunasObrigatorias = [];
      if (colIndices.loja === -1) colunasObrigatorias.push('Loja');
      if (colIndices.referencia === -1) colunasObrigatorias.push('Referência');

      if (colunasObrigatorias.length > 0) {
        throw new Error(`Colunas obrigatórias não encontradas: ${colunasObrigatorias.join(', ')}.`);
      }

      const parseNumberMulti = (val: any): number => {
        if (val === '' || val === null || val === undefined) return 0;
        if (typeof val === 'number') return val;
        let str = String(val).trim();
        if (str.includes(',')) {
          str = str.replace(/\./g, '').replace(',', '.');
        }
        str = str.replace(/[^\d.-]/g, '');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
      };

      const items: MultiSupplierItem[] = dataRows
        .map((row: any[]) => {
          if (!Array.isArray(row) || row.length === 0) return null;

          const getValue = (idx: number, defaultVal: any = '') => {
            if (idx === -1) return defaultVal;
            const val = row[idx];
            return val === '' || val === null || val === undefined ? defaultVal : val;
          };

          const lojaVal = getValue(colIndices.loja, 0);
          const referenciaVal = getValue(colIndices.referencia, '');

          if (!lojaVal || !referenciaVal || String(referenciaVal).trim() === '') {
            return null;
          }

          const ultimaCompraRaw = getValue(colIndices.ultimaCompra, '');
          let ultimaCompraDate = '';
          let ano: number | undefined;

          if (ultimaCompraRaw && ultimaCompraRaw !== '') {
            try {
              let dateObj: Date | null = null;
              if (typeof ultimaCompraRaw === 'number') {
                const msPerDay = 86400000;
                const epoch = new Date(1899, 11, 30).getTime();
                dateObj = new Date(epoch + Math.floor(ultimaCompraRaw) * msPerDay);
              } else if (typeof ultimaCompraRaw === 'string') {
                const s = ultimaCompraRaw.trim();
                if (s.includes('/')) {
                  const parts = s.split('/');
                  if (parts.length === 3) {
                    const p0 = parseInt(parts[0]);
                    const p1 = parseInt(parts[1]);
                    let p2 = parseInt(parts[2]);
                    if (p2 < 100) p2 += 2000;
                    if (p0 > 12) {
                      dateObj = new Date(p2, p1 - 1, p0);
                    } else {
                      dateObj = new Date(p2, p0 - 1, p1);
                    }
                  }
                } else if (s.includes('-')) {
                  dateObj = new Date(s);
                }
              } else if (ultimaCompraRaw instanceof Date) {
                dateObj = ultimaCompraRaw;
              }

              if (dateObj && !isNaN(dateObj.getTime())) {
                const y = dateObj.getFullYear();
                if (y >= 2010 && y <= 2035) {
                  ano = y;
                  ultimaCompraDate = dateObj.toLocaleDateString('pt-BR');
                }
              }
            } catch (e) {
              console.warn('Erro ao parsear data:', e);
            }
          }

          const estoqueQtde = parseNumberMulti(getValue(colIndices.estoqueQtde, 0));
          const compraQtde = parseNumberMulti(getValue(colIndices.compraQtde, 0));
          const vendaQtde = parseNumberMulti(getValue(colIndices.vendaQtde, 0));
          const vendaValor = parseNumberMulti(getValue(colIndices.vendaValor, 0));

          const estoqueInicial = estoqueQtde + vendaQtde - compraQtde;
          const totalDisponivel = estoqueInicial + compraQtde;
          const percVenda = totalDisponivel > 0 ? (vendaQtde / totalDisponivel) * 100 : 0;

          const diasEst = parseNumberMulti(getValue(colIndices.diasEstoque, 0));
          const velocidade = vendaQtde / Math.max(diasEst, 1);
          const cobertura = velocidade > 0 && estoqueQtde > 0
            ? Math.round(estoqueQtde / velocidade)
            : estoqueQtde <= 0 ? 0 : null;

          const precoCompra = parseNumberMulti(getValue(colIndices.precoCompra, 0));
          const margemUnitaria = vendaValor - precoCompra;
          const margemReais = margemUnitaria * vendaQtde;

          const sugestaoCompra = parseNumberMulti(getValue(colIndices.sugestaoCompra, 0));
          const coberturaFornecedorRaw = getValue(colIndices.coberturaFornecedor, '');
          let coberturaFornecedor: number | null = null;
          if (coberturaFornecedorRaw !== '' && coberturaFornecedorRaw !== null && coberturaFornecedorRaw !== undefined) {
            const parsedCobForn = parseNumberMulti(coberturaFornecedorRaw);
            if (!isNaN(parsedCobForn)) {
              coberturaFornecedor = parsedCobForn;
            }
          }

          const markupInicial = parseNumberMulti(getValue(colIndices.markupInicial, 0));
          const markupReal = parseNumberMulti(getValue(colIndices.markupReal, 0));
          const pedidosPendentesQtde = parseNumberMulti(getValue(colIndices.pedidosPendentesQtde, 0));

          const marcaVal = String(getValue(colIndices.marca, 'OUTROS')).trim().toUpperCase() || 'OUTROS';

          return {
            loja: parseNumberMulti(lojaVal),
            marca: marcaVal,
            referencia: String(referenciaVal).trim(),
            estoqueQtde,
            compraQtde,
            vendaQtde,
            consumoPerc: 0,
            vendaValor,
            ultimaCompra: ultimaCompraDate,
            diasEstoque: diasEst,
            ano,
            percVenda,
            velocidade,
            cobertura,
            precoCompra,
            sugestaoCompra,
            coberturaFornecedor,
            markupInicial,
            markupReal,
            pedidosPendentesQtde,
            margemUnitaria,
            margemReais
          };
        })
        .filter((item): item is MultiSupplierItem => item !== null && item.loja > 0);

      if (items.length === 0) {
        throw new Error('Nenhum dado válido encontrado. Verifique o formato do arquivo.');
      }

      const lojas = Array.from(new Set(items.map(item => item.loja))).sort((a, b) => a - b);
      const marcas = Array.from(new Set(items.map(item => item.marca))).sort();
      const anos = Array.from(new Set(items.map(item => item.ano).filter(Boolean)))
        .sort((a, b) => b! - a!)
        .slice(0, 2) as number[];

      setSelectedLojaMulti(lojas[0] || 0);
      setMultiProcessedData({ items, lojas, marcas, anos });

    } catch (err: any) {
      console.error('Erro ao processar várias marcas:', err);
      setErrorMulti(err?.message || 'Erro desconhecido ao processar arquivo');
    } finally {
      setIsProcessingMulti(false);
    }
  };

  // ==================== CALCULO DE RESUMO GERAL MULTI-MARCAS ====================
  const statusPriority: Record<string, number> = {
    'ZEROU ⚠': 0,
    'ÓTIMO': 1,
    'BOM': 2,
    'REGULAR': 3,
    'PÉSSIMO': 4,
  };

  const sortedLojas = useMemo(() => {
    if (!multiProcessedData) return [];
    return [...multiProcessedData.lojas].sort((a, b) => a - b);
  }, [multiProcessedData]);

  const sortMultiItems = <T extends { estoqueQtde: number; percVenda: number; margemReais: number }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      const textA = getStatusAndColors(a.estoqueQtde, a.percVenda).text;
      const textB = getStatusAndColors(b.estoqueQtde, b.percVenda).text;
      const pa = statusPriority[textA] ?? 99;
      const pb = statusPriority[textB] ?? 99;
      if (pa !== pb) return pa - pb;
      return b.margemReais - a.margemReais;
    });
  };

  const resumoGeralData = useMemo(() => {
    if (!multiProcessedData) return [];
    
    return multiProcessedData.marcas.map(marca => {
      const itemsOfBrand = multiProcessedData.items.filter(it => it.marca === marca);
      const itemsVendeuBem = itemsOfBrand.filter(checkVendeuBem);
      const totalMargemReais = itemsVendeuBem.reduce((acc, curr) => acc + curr.margemReais, 0);

      const refMap: Record<string, typeof itemsVendeuBem> = {};
      itemsVendeuBem.forEach(it => {
        if (!refMap[it.referencia]) refMap[it.referencia] = [];
        refMap[it.referencia].push(it);
      });

      const references = Object.keys(refMap).map(ref => {
        const occurrences = refMap[ref];
        const lojasCount = occurrences.length;
        const totalMargemRef = occurrences.reduce((acc, curr) => acc + curr.margemReais, 0);

        const storeInfoMap: Record<number, { vendaQtde: number; percVenda: number }> = {};
        occurrences.forEach(o => {
          storeInfoMap[o.loja] = {
            vendaQtde: o.vendaQtde,
            percVenda: o.percVenda
          };
        });

        return {
          referencia: ref,
          lojasCount,
          totalMargemRef,
          storeInfoMap
        };
      }).sort((a, b) => b.lojasCount - a.lojasCount);

      return {
        marca,
        totalMargemReais,
        references
      };
    }).sort((a, b) => b.totalMargemReais - a.totalMargemReais);
  }, [multiProcessedData]);

  // ==================== EXPORTAR EXCEL MULTI-MARCAS ====================
  const handleExportMulti = async () => {
    if (!multiProcessedData) return;
    setIsExportingMulti(true);
    try {
      const workbook = new ExcelJS.Workbook();

      const mkFill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
      const mkFont = (argb: string, size = 9, bold = false) => ({ name: 'Arial', size, bold, color: { argb } });
      const thinBorder = {
        top: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
      };
      const centerAlign = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
      const leftAlign = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
      const rightAlign = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };

      const applyHeader = (row: ExcelJS.Row, fillArgb: string, fontArgb: string, cols: number) => {
        for (let c = 1; c <= cols; c++) {
          const cell = row.getCell(c);
          cell.fill = mkFill(fillArgb);
          cell.font = mkFont(fontArgb, 10, true);
          cell.alignment = leftAlign;
        }
        row.height = 22;
      };

      const applyColHeader = (row: ExcelJS.Row, fillArgb: string, fontArgb: string) => {
        row.eachCell(cell => {
          cell.fill = mkFill(fillArgb);
          cell.font = mkFont(fontArgb, 9, true);
          cell.alignment = centerAlign;
          cell.border = thinBorder;
        });
        row.height = 18;
      };

      const applyDataRow = (row: ExcelJS.Row, fillArgb: string, boldFirst = false) => {
        row.eachCell((cell, col) => {
          cell.fill = mkFill(fillArgb);
          cell.font = mkFont('FF000000', 9, boldFirst && col === 1);
          cell.alignment = col === 1 ? leftAlign : centerAlign;
          cell.border = thinBorder;
        });
        row.height = 16;
      };

      // 1. ABA RESUMO GERAL (NOVA MATRIZ ITEM x LOJA)
      const wsResumo = workbook.addWorksheet('Resumo Geral');
      wsResumo.views = [{ showGridLines: false }];

      wsResumo.getColumn(1).width = 20; // Referência
      wsResumo.getColumn(2).width = 20; // Margem Total (R$)
      wsResumo.getColumn(3).width = 12; // Qtd Lojas
      sortedLojas.forEach((loja, idx) => {
        wsResumo.getColumn(4 + idx).width = 6; // Lojas dinâmicas
      });

      const totCols = 3 + sortedLojas.length;

      const titleRow = wsResumo.addRow(['📋 RESUMO GERAL - ANÁLISE MULTI-MARCAS']);
      wsResumo.mergeCells(titleRow.number, 1, titleRow.number, totCols);
      titleRow.getCell(1).fill = mkFill('FF185FA5');
      titleRow.getCell(1).font = mkFont('FFFFFFFF', 12, true);
      titleRow.getCell(1).alignment = centerAlign;
      titleRow.height = 30;
      wsResumo.addRow([]);

      resumoGeralData.forEach(bd => {
        const colorConfig = getBrandColor(bd.marca);
        const headerRow = wsResumo.addRow([
          `🏷️ MARCA: ${bd.marca.toUpperCase()} | Margem Total Vendeu Bem: ${fmtCurrency(bd.totalMargemReais)}`
        ]);
        wsResumo.mergeCells(headerRow.number, 1, headerRow.number, totCols);
        applyHeader(headerRow, colorConfig.fill, colorConfig.darkText, totCols);

        if (bd.references.length > 0) {
          const tableHeaders = [
            'Referência',
            'Margem Total (R$)',
            'Qtd Lojas',
            ...sortedLojas.map(l => String(l).padStart(2, '0'))
          ];
          const rHeaders = wsResumo.addRow(tableHeaders);
          applyColHeader(rHeaders, 'FFEAEAEA', 'FF333333');

          bd.references.forEach(ref => {
            const rowData = [
              ref.referencia,
              ref.totalMargemRef,
              ref.lojasCount,
              ...sortedLojas.map(loja => {
                const info = ref.storeInfoMap[loja];
                return info ? info.vendaQtde : '—';
              })
            ];

            const dr = wsResumo.addRow(rowData);
            applyDataRow(dr, 'FFFFFFFF', true);

            const cM = dr.getCell(2);
            cM.value = ref.totalMargemRef;
            cM.numFmt = '"R$"#,##0.00';
            cM.alignment = rightAlign;

            const cLojas = dr.getCell(3);
            cLojas.alignment = centerAlign;
            cLojas.font = mkFont('FF000000', 9, true);

            sortedLojas.forEach((loja, idx) => {
              const cellIdx = 4 + idx;
              const cell = dr.getCell(cellIdx);
              const info = ref.storeInfoMap[loja];
              if (info) {
                const isGreen = info.percVenda >= 70;
                const cellBg = isGreen ? 'FFD4EDDA' : 'FFFEF9E7';
                cell.fill = mkFill(cellBg);
                cell.font = mkFont('FF000000', 9, true);
              } else {
                cell.font = mkFont('FFCCCCCC', 9, false);
              }
              cell.alignment = centerAlign;
            });
          });
        } else {
          const emptyRow = wsResumo.addRow(["Nenhum item desta marca atingiu o critério 'vendeu bem' (Venda >= 50% e Compra >= 5 pares)."]);
          wsResumo.mergeCells(emptyRow.number, 1, emptyRow.number, totCols);
          emptyRow.getCell(1).font = mkFont('FF666666', 9);
          emptyRow.getCell(1).alignment = leftAlign;
        }
        wsResumo.addRow([]);
      });

      // 2. ABAS POR LOJA
      const COLS_MULTI = 14;

      for (const loja of multiProcessedData.lojas) {
        const ws = workbook.addWorksheet(`Loja ${loja}`);
        ws.views = [{ showGridLines: false }];

        [18, 18, 14, 11, 14, 12, 10, 13, 13, 10, 18, 14, 12, 12].forEach((w, i) => {
          ws.getColumn(i + 1).width = w;
        });

        const storeTitleRow = ws.addRow([
          `📊 LOJA ${loja} — ANÁLISE MULTI-MARCAS | Gerado em: ${new Date().toLocaleDateString('pt-BR')}`
        ]);
        ws.mergeCells(storeTitleRow.number, 1, storeTitleRow.number, COLS_MULTI);
        storeTitleRow.getCell(1).fill = mkFill('FF1B4F72');
        storeTitleRow.getCell(1).font = mkFont('FFFFFFFF', 12, true);
        storeTitleRow.getCell(1).alignment = centerAlign;
        storeTitleRow.height = 28;
        ws.addRow([]);

        const itemsOfStore = multiProcessedData.items.filter(i => i.loja === loja);
        const brandsInStore = Array.from(new Set(itemsOfStore.map(i => i.marca))).sort();

        for (const brand of brandsInStore) {
          const brandColor = getBrandColor(brand);
          const itemsOfBrand = itemsOfStore.filter(i => i.marca === brand);

          const brandDividerRow = ws.addRow([`🏷️ MARCA: ${brand.toUpperCase()}`]);
          ws.mergeCells(brandDividerRow.number, 1, brandDividerRow.number, COLS_MULTI);
          applyHeader(brandDividerRow, brandColor.fill, brandColor.darkText, COLS_MULTI);
          ws.addRow([]);

          // BLOCO 1: ALERTA DE RUPTURA
          const ruptura = sortMultiItems(
            itemsOfBrand.filter(i => i.compraQtde > 0 && i.percVenda >= 50)
          );

          const rTitle = ws.addRow([`🚨 ALERTA DE RUPTURA — ${brand.toUpperCase()} (${ruptura.length} itens)`]);
          ws.mergeCells(rTitle.number, 1, rTitle.number, COLS_MULTI);
          applyHeader(rTitle, 'FFC0392B', 'FFFFFFFF', COLS_MULTI);

          if (ruptura.length > 0) {
            const rHeaders = ws.addRow([
              'Referência', 'Margem (R$)', 'Comprou', 'Vendeu', 'Estoque', '% Vendido',
              'Vel./Dia', 'Cob. (Nossa)', 'Cob. (Forn.)', 'Sugestão', 'Markup Real/Inic', 'Pedidos Pend.', 'Status'
            ]);
            applyColHeader(rHeaders, 'FFFADBD8', 'FFC0392B');

            ruptura.forEach(item => {
              const fill = item.percVenda >= 80 ? 'FFFADBD8' : 'FFFEF9E7';
              const mkText = `${item.markupReal.toFixed(1)}% / ${item.markupInicial.toFixed(1)}%`;
              const cobFornText = item.coberturaFornecedor === null ? '∞' : item.coberturaFornecedor;
              const cobNossaText = item.cobertura === null ? '∞' : item.cobertura;
              const pendText = item.pedidosPendentesQtde > 0 ? `Sim (${item.pedidosPendentesQtde})` : 'Não';
              const statusInfo = getStatusAndColors(item.estoqueQtde, item.percVenda);

              const dr = ws.addRow([
                item.referencia,
                item.margemReais,
                item.compraQtde,
                item.vendaQtde,
                item.estoqueQtde,
                `${item.percVenda.toFixed(0)}%`,
                item.velocidade.toFixed(2),
                cobNossaText,
                cobFornText,
                item.sugestaoCompra,
                mkText,
                pendText,
                statusInfo.text
              ]);
              applyDataRow(dr, fill, true);
              
              const cM = dr.getCell(2);
              cM.value = item.margemReais;
              cM.numFmt = '"R$"#,##0.00';
              cM.alignment = rightAlign;

              const cStatus = dr.getCell(13);
              cStatus.fill = mkFill(statusInfo.excelBg);
              cStatus.font = mkFont('FF000000', 9, true);

              if (Math.abs(item.markupReal - item.markupInicial) > 5) {
                dr.getCell(11).fill = mkFill('FFFFE0');
                dr.getCell(11).font = mkFont('FF000000', 9, true);
              }
            });
          } else {
            const emptyR = ws.addRow(['Nenhum item com risco de ruptura nesta marca.']);
            ws.mergeCells(emptyR.number, 1, emptyR.number, COLS_MULTI);
            emptyR.getCell(1).font = mkFont('FF666666', 9);
          }
          ws.addRow([]);

          // BLOCO 2: CHEGARAM NO PERÍODO
          const recentes = sortMultiItems(
            itemsOfBrand.filter(i => i.compraQtde > 0)
          );

          const recTitle = ws.addRow([`📦 CHEGARAM NO PERÍODO — ${brand.toUpperCase()} (${recentes.length} itens)`]);
          ws.mergeCells(recTitle.number, 1, recTitle.number, COLS_MULTI);
          applyHeader(recTitle, 'FF6C3483', 'FFFFFFFF', COLS_MULTI);

          if (recentes.length > 0) {
            const recHeaders = ws.addRow([
              'Referência', 'Margem (R$)', 'Comprou', 'Vendeu', 'Estoque', '% Vendido',
              'Vel./Dia', 'Cob. (Nossa)', 'Cob. (Forn.)', 'Sugestão', 'Markup Real/Inic', 'Pedidos Pend.', 'Status'
            ]);
            applyColHeader(recHeaders, 'FFE8DAEF', 'FF6C3483');

            recentes.forEach(item => {
              let fill = 'FFFFFFFF';
              if (item.percVenda >= 80) fill = 'FFD4EDDA';
              else if (item.percVenda >= 50) fill = 'FFD5F5E3';
              else if (item.percVenda >= 25) fill = 'FFFEF9E7';
              else fill = 'FFFADBD8';

              const mkText = `${item.markupReal.toFixed(1)}% / ${item.markupInicial.toFixed(1)}%`;
              const cobFornText = item.coberturaFornecedor === null ? '∞' : item.coberturaFornecedor;
              const cobNossaText = item.cobertura === null ? '∞' : item.cobertura;
              const pendText = item.pedidosPendentesQtde > 0 ? `Sim (${item.pedidosPendentesQtde})` : 'Não';
              const statusInfo = getStatusAndColors(item.estoqueQtde, item.percVenda);

              const dr = ws.addRow([
                item.referencia,
                item.margemReais,
                item.compraQtde,
                item.vendaQtde,
                item.estoqueQtde,
                `${item.percVenda.toFixed(0)}%`,
                item.velocidade.toFixed(2),
                cobNossaText,
                cobFornText,
                item.sugestaoCompra,
                mkText,
                pendText,
                statusInfo.text
              ]);
              applyDataRow(dr, fill, true);
              const cM = dr.getCell(2);
              cM.value = item.margemReais;
              cM.numFmt = '"R$"#,##0.00';
              cM.alignment = rightAlign;

              const cStatus = dr.getCell(13);
              cStatus.fill = mkFill(statusInfo.excelBg);
              cStatus.font = mkFont('FF000000', 9, true);

              if (Math.abs(item.markupReal - item.markupInicial) > 5) {
                dr.getCell(11).fill = mkFill('FFFFE0');
                dr.getCell(11).font = mkFont('FF000000', 9, true);
              }
            });
          } else {
            const emptyRec = ws.addRow(['Nenhum item com compra recente nesta marca.']);
            ws.mergeCells(emptyRec.number, 1, emptyRec.number, COLS_MULTI);
            emptyRec.getCell(1).font = mkFont('FF666666', 9);
          }
          ws.addRow([]);

          // BLOCO 3: TOP MAIS VENDIDOS
          const top20 = sortMultiItems(
            itemsOfBrand
              .filter(i => i.vendaQtde > 0)
              .sort((a, b) => b.vendaQtde - a.vendaQtde)
              .slice(0, 20)
          );

          const topTitleRow = ws.addRow([`🏆 TOP MAIS VENDIDOS — ${brand.toUpperCase()} (${top20.length} itens)`]);
          ws.mergeCells(topTitleRow.number, 1, topTitleRow.number, COLS_MULTI);
          applyHeader(topTitleRow, 'FF1E6B3A', 'FFFFFFFF', COLS_MULTI);

          if (top20.length > 0) {
            const topHeaders = ws.addRow([
              'Pos', 'Referência', 'Margem (R$)', 'Comprou', 'Vendeu', 'Estoque', '% Vendido',
              'Vel./Dia', 'Cob. (Nossa)', 'Cob. (Forn.)', 'Sugestão', 'Markup Real/Inic', 'Pedidos Pend.', 'Status'
            ]);
            applyColHeader(topHeaders, 'FFD4EDDA', 'FF1E6B3A');

            top20.forEach((item, idx) => {
              let fill = 'FFFFFFFF';
              if (item.estoqueQtde <= 0) fill = 'FFFADBD8';
              else if (item.percVenda >= 80) fill = 'FFD4EDDA';
              else if (item.percVenda >= 50) fill = 'FFD5F5E3';
              else fill = 'FFFEF9E7';

              const mkText = `${item.markupReal.toFixed(1)}% / ${item.markupInicial.toFixed(1)}%`;
              const cobFornText = item.coberturaFornecedor === null ? '∞' : item.coberturaFornecedor;
              const cobNossaText = item.cobertura === null ? '∞' : item.cobertura;
              const pendText = item.pedidosPendentesQtde > 0 ? `Sim (${item.pedidosPendentesQtde})` : 'Não';
              const statusInfo = getStatusAndColors(item.estoqueQtde, item.percVenda);

              const dr = ws.addRow([
                idx + 1,
                item.referencia,
                item.margemReais,
                item.compraQtde,
                item.vendaQtde,
                item.estoqueQtde,
                `${item.percVenda.toFixed(0)}%`,
                item.velocidade.toFixed(2),
                cobNossaText,
                cobFornText,
                item.sugestaoCompra,
                mkText,
                pendText,
                statusInfo.text
              ]);
              applyDataRow(dr, fill, false);
              dr.getCell(2).font = mkFont('FF000000', 9, true);

              const cM = dr.getCell(3);
              cM.value = item.margemReais;
              cM.numFmt = '"R$"#,##0.00';
              cM.alignment = rightAlign;

              const cStatus = dr.getCell(14);
              cStatus.fill = mkFill(statusInfo.excelBg);
              cStatus.font = mkFont('FF000000', 9, true);

              if (Math.abs(item.markupReal - item.markupInicial) > 5) {
                dr.getCell(12).fill = mkFill('FFFFE0');
                dr.getCell(12).font = mkFont('FF000000', 9, true);
              }
            });
          } else {
            const emptyTop = ws.addRow(['Nenhum item vendido nesta marca.']);
            ws.mergeCells(emptyTop.number, 1, emptyTop.number, COLS_MULTI);
            emptyTop.getCell(1).font = mkFont('FF666666', 9);
          }
          ws.addRow([]);

          // BLOCO 4: ESTOQUE PARADO
          const parados = sortMultiItems(
            itemsOfBrand.filter(i => i.estoqueQtde > 0 && i.vendaQtde === 0 && i.diasEstoque > 90)
          );

          const parTitle = ws.addRow([`💀 ESTOQUE PARADO (+90 dias) — ${brand.toUpperCase()} (${parados.length} itens)`]);
          ws.mergeCells(parTitle.number, 1, parTitle.number, COLS_MULTI);
          applyHeader(parTitle, 'FF7D3C98', 'FFFFFFFF', COLS_MULTI);

          if (parados.length > 0) {
            const parHeaders = ws.addRow([
              'Referência', 'Margem (R$)', 'Comprou', 'Estoque', 'Última Compra', 'Dias Parado',
              'Vel./Dia', 'Cob. (Nossa)', 'Cob. (Forn.)', 'Sugestão', 'Markup Real/Inic', 'Pedidos Pend.', 'Status'
            ]);
            applyColHeader(parHeaders, 'FFE8DAEF', 'FF7D3C98');

            parados.forEach(item => {
              let fill = 'FFFFFFFF';
              if (item.diasEstoque > 365) fill = 'FFFADBD8';
              else if (item.diasEstoque > 180) fill = 'FFFEF9E7';
              else fill = 'FFF2F2F2';

              const mkText = `${item.markupReal.toFixed(1)}% / ${item.markupInicial.toFixed(1)}%`;
              const cobFornText = item.coberturaFornecedor === null ? '∞' : item.coberturaFornecedor;
              const cobNossaText = item.cobertura === null ? '∞' : item.cobertura;
              const pendText = item.pedidosPendentesQtde > 0 ? `Sim (${item.pedidosPendentesQtde})` : 'Não';
              const statusInfo = getStatusAndColors(item.estoqueQtde, item.percVenda);

              const dr = ws.addRow([
                item.referencia,
                item.margemReais,
                item.compraQtde,
                item.estoqueQtde,
                item.ultimaCompra || 'N/D',
                item.diasEstoque,
                item.velocidade.toFixed(2),
                cobNossaText,
                cobFornText,
                item.sugestaoCompra,
                mkText,
                pendText,
                statusInfo.text
              ]);
              applyDataRow(dr, fill, true);
              const cM = dr.getCell(2);
              cM.value = item.margemReais;
              cM.numFmt = '"R$"#,##0.00';
              cM.alignment = rightAlign;

              const cStatus = dr.getCell(13);
              cStatus.fill = mkFill(statusInfo.excelBg);
              cStatus.font = mkFont('FF000000', 9, true);

              if (Math.abs(item.markupReal - item.markupInicial) > 5) {
                dr.getCell(11).fill = mkFill('FFFFE0');
                dr.getCell(11).font = mkFont('FF000000', 9, true);
              }
            });
          } else {
            const emptyPar = ws.addRow(['Nenhum item com estoque parado nesta marca.']);
            ws.mergeCells(emptyPar.number, 1, emptyPar.number, COLS_MULTI);
            emptyPar.getCell(1).font = mkFont('FF666666', 9);
          }
          ws.addRow([]);
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Analise_Multi_Marcas_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Erro ao exportar:', err);
      setErrorMulti('Erro ao exportar arquivo Excel');
    } finally {
      setIsExportingMulti(false);
    }
  };

  // ==================== EXPORTAR EXCEL ====================
  const handleExport = async () => {
    if (!processedData) return;
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();

      // ── Estilos reutilizáveis ──
      const mkFill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
      const mkFont = (argb: string, size = 9, bold = false) => ({ name: 'Arial', size, bold, color: { argb } });
      const thinBorder = {
        top: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
      };
      const centerAlign = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
      const leftAlign = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };

      const applyHeader = (row: ExcelJS.Row, fillArgb: string, fontArgb: string, cols: number) => {
        for (let c = 1; c <= cols; c++) {
          const cell = row.getCell(c);
          cell.fill = mkFill(fillArgb);
          cell.font = mkFont(fontArgb, 10, true);
          cell.alignment = leftAlign;
          if (c === 1) cell.alignment = leftAlign;
        }
        row.height = 22;
      };

      const applyColHeader = (row: ExcelJS.Row, fillArgb: string, fontArgb: string) => {
        row.eachCell(cell => {
          cell.fill = mkFill(fillArgb);
          cell.font = mkFont(fontArgb, 9, true);
          cell.alignment = centerAlign;
          cell.border = thinBorder;
        });
        row.height = 18;
      };

      const applyDataRow = (row: ExcelJS.Row, fillArgb: string, boldFirst = false) => {
        row.eachCell((cell, col) => {
          cell.fill = mkFill(fillArgb);
          cell.font = mkFont('FF000000', 9, boldFirst && col === 1);
          cell.alignment = col === 1 ? leftAlign : centerAlign;
          cell.border = thinBorder;
        });
        row.height = 16;
      };

      const COLS = 9;
      const hoje = new Date();

      for (const loja of processedData.lojas) {
        const ws = workbook.addWorksheet(`Loja ${loja}`);
        ws.views = [{ showGridLines: false }];

        // Larguras das colunas
        [14, 16, 14, 12, 12, 14, 12, 14, 14].forEach((w, i) => {
          ws.getColumn(i + 1).width = w;
        });

        const items = processedData.items.filter(i => i.loja === loja);

        // ── TÍTULO DA LOJA ──
        const titleRow = ws.addRow([
          `📊 LOJA ${loja} — ANÁLISE ${processedData.marca.toUpperCase()} | Período: Jan–Mai ${hoje.getFullYear()} | Gerado em: ${hoje.toLocaleDateString('pt-BR')}`
        ]);
        ws.mergeCells(titleRow.number, 1, titleRow.number, COLS);
        titleRow.getCell(1).fill = mkFill('FF1F4E79');
        titleRow.getCell(1).font = mkFont('FFFFFFFF', 12, true);
        titleRow.getCell(1).alignment = centerAlign;
        titleRow.height = 28;
        ws.addRow([]);

        // ──────────────────────────────────────────────────────
        // BLOCO 1: ALERTA DE RUPTURA
        // ──────────────────────────────────────────────────────
        const ruptura = items
          .filter(i => i.compraQtde > 0 && i.percVenda >= 50)
          .sort((a, b) => b.percVenda - a.percVenda);

        const rupturaTitle = ws.addRow([
          `🚨 ALERTA DE RUPTURA — Chegaram e já venderam 50%+ do estoque (${ruptura.length} itens)`
        ]);
        ws.mergeCells(rupturaTitle.number, 1, rupturaTitle.number, COLS);
        applyHeader(rupturaTitle, 'FFC0392B', 'FFFFFFFF', COLS);

        if (ruptura.length > 0) {
          const rh = ws.addRow(['Referência','Data Chegada','Dias em Loja','Comprou','Vendeu','Estoque Atual','% Vendido','Vel./Dia','⚠ Cobertura (dias)']);
          applyColHeader(rh, 'FFFADBD8', 'FFC0392B');

          for (const item of ruptura) {
            const coberturaVal = item.cobertura === 0 ? 'ZERADO' : item.cobertura === null ? '∞' : item.cobertura;
            const fill = item.percVenda >= 80 ? 'FFFADBD8' : 'FFFEF9E7';
            const dr = ws.addRow([
              item.referencia,
              item.ultimaCompra || 'N/D',
              item.diasEstoque,
              item.compraQtde,
              item.vendaQtde,
              item.estoqueQtde,
              `${item.percVenda.toFixed(0)}%`,
              item.velocidade.toFixed(2),
              coberturaVal
            ]);
            applyDataRow(dr, fill, true);
          }
        } else {
          const nr = ws.addRow(['Nenhum item com risco de ruptura iminente neste período.']);
          ws.mergeCells(nr.number, 1, nr.number, COLS);
          nr.getCell(1).font = mkFont('FF666666', 9);
        }
        ws.addRow([]);

        // ──────────────────────────────────────────────────────
        // BLOCO 2: MERCADORIAS QUE CHEGARAM NO PERÍODO
        // ──────────────────────────────────────────────────────
        const recentes = items
          .filter(i => i.compraQtde > 0)
          .sort((a, b) => b.percVenda - a.percVenda);

        const recentesTitle = ws.addRow([
          `📦 MERCADORIAS QUE CHEGARAM NO PERÍODO (${recentes.length} itens com compra registrada)`
        ]);
        ws.mergeCells(recentesTitle.number, 1, recentesTitle.number, COLS);
        applyHeader(recentesTitle, 'FF6C3483', 'FFFFFFFF', COLS);

        if (recentes.length > 0) {
          const rh2 = ws.addRow(['Referência','Data Chegada','Dias em Loja','Comprou','Vendeu','Estoque Atual','% Vendido','Vel./Dia','Status']);
          applyColHeader(rh2, 'FFE8DAEF', 'FF6C3483');

          for (const item of recentes) {
            let status: string, fill: string;
            if (item.percVenda >= 80)      { status = 'ÓTIMO';    fill = 'FFD4EDDA'; }
            else if (item.percVenda >= 50) { status = 'BOM';      fill = 'FFD5F5E3'; }
            else if (item.percVenda >= 25) { status = 'REGULAR';  fill = 'FFFEF9E7'; }
            else                           { status = 'LENTO';    fill = 'FFFADBD8'; }

            const dr = ws.addRow([
              item.referencia,
              item.ultimaCompra || 'N/D',
              item.diasEstoque,
              item.compraQtde,
              item.vendaQtde,
              item.estoqueQtde,
              `${item.percVenda.toFixed(0)}%`,
              item.velocidade.toFixed(2),
              status
            ]);
            applyDataRow(dr, fill, true);
          }
        } else {
          const nr = ws.addRow(['Nenhuma compra registrada no período para esta loja.']);
          ws.mergeCells(nr.number, 1, nr.number, COLS);
          nr.getCell(1).font = mkFont('FF666666', 9);
        }
        ws.addRow([]);

        // ──────────────────────────────────────────────────────
        // BLOCO 3: TOP 20 MAIS VENDIDOS
        // ──────────────────────────────────────────────────────
        const top20 = items
          .filter(i => i.vendaQtde > 0)
          .sort((a, b) => b.vendaQtde - a.vendaQtde)
          .slice(0, 20);

        const topTitle = ws.addRow([
          `🏆 TOP 20 MAIS VENDIDOS NO PERÍODO (inclui estoque de períodos anteriores)`
        ]);
        ws.mergeCells(topTitle.number, 1, topTitle.number, COLS);
        applyHeader(topTitle, 'FF1E6B3A', 'FFFFFFFF', COLS);

        const th = ws.addRow(['Pos','Referência','Última Compra','Dias em Estoque','Comprou (per.)','Vendeu','Estoque Atual','Preço Venda','Status']);
        applyColHeader(th, 'FF1E6B3A', 'FFFFFFFF');

        top20.forEach((item, idx) => {
          const pct = item.percVenda;
          let status: string, fill: string;
          if (item.estoqueQtde <= 0) { status = 'ZEROU ⚠'; fill = 'FFFADBD8'; }
          else if (pct >= 80)        { status = 'ÓTIMO';   fill = 'FFD4EDDA'; }
          else if (pct >= 50)        { status = 'BOM';     fill = 'FFD5F5E3'; }
          else                       { status = 'REGULAR'; fill = 'FFFEF9E7'; }

          const preco = item.vendaValor > 0 ? `R$ ${item.vendaValor.toFixed(2)}` : '-';
          const dr = ws.addRow([
            idx + 1,
            item.referencia,
            item.ultimaCompra || 'N/D',
            item.diasEstoque,
            item.compraQtde,
            item.vendaQtde,
            item.estoqueQtde,
            preco,
            status
          ]);
          applyDataRow(dr, fill, false);
          dr.getCell(2).font = mkFont('FF000000', 9, true);
        });
        ws.addRow([]);

        // ──────────────────────────────────────────────────────
        // BLOCO 4: ESTOQUE PARADO
        // ──────────────────────────────────────────────────────
        const parados = items
          .filter(i => i.estoqueQtde > 0 && i.vendaQtde === 0 && i.diasEstoque > 90)
          .sort((a, b) => b.diasEstoque - a.diasEstoque);

        const paradoTitle = ws.addRow([
          `💀 ESTOQUE PARADO SEM VENDA (${parados.length} itens, +90 dias sem girar)`
        ]);
        ws.mergeCells(paradoTitle.number, 1, paradoTitle.number, COLS);
        applyHeader(paradoTitle, 'FF7D3C98', 'FFFFFFFF', COLS);

        if (parados.length > 0) {
          const ph = ws.addRow(['Referência','Última Compra','Dias Parado','Estoque Qtde','Preço Venda','Preço Custo','Risco','','']);
          applyColHeader(ph, 'FF9B59B6', 'FFFFFFFF');

          for (const item of parados.slice(0, 20)) {
            let risco: string, fill: string;
            if (item.diasEstoque > 365)      { risco = 'CRÍTICO'; fill = 'FFFADBD8'; }
            else if (item.diasEstoque > 180) { risco = 'ALTO';    fill = 'FFFEF9E7'; }
            else                             { risco = 'MÉDIO';   fill = 'FFF2F2F2'; }

            const preco = item.vendaValor > 0 ? `R$ ${item.vendaValor.toFixed(2)}` : '-';
            const dr = ws.addRow([
              item.referencia,
              item.ultimaCompra || 'N/D',
              item.diasEstoque,
              item.estoqueQtde,
              preco,
              '-',
              risco,
              '',
              ''
            ]);
            applyDataRow(dr, fill, true);
          }
        } else {
          const nr = ws.addRow(['Nenhum item com estoque parado >90 dias sem venda.']);
          ws.mergeCells(nr.number, 1, nr.number, COLS);
          nr.getCell(1).font = mkFont('FF666666', 9);
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Analise_${processedData.marca}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Erro ao exportar:', err);
      setError('Erro ao exportar arquivo Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // ==================== FILTROS ====================
  const filteredItems = useMemo(() => {
    let filtered = processedData?.items || [];

    if (selectedLoja !== 'all') {
      filtered = filtered.filter(item => item.loja === selectedLoja);
    }

    if (selectedAno !== 'all') {
      filtered = filtered.filter(item => item.ano === selectedAno);
    }

    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.referencia.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => b.vendaQtde - a.vendaQtde);
  }, [processedData, selectedLoja, selectedAno, searchTerm]);

  const topItems = filteredItems.filter(item => item.vendaQtde > 0).slice(0, 20);
  const flopItems = filteredItems.filter(item => item.vendaQtde === 0 && item.estoqueQtde > 0).slice(0, 15);

  const getStatus = (item: SupplierItem) => {
    if (item.estoqueQtde === 0) return { label: 'ZEROU', color: 'bg-green-100 text-green-800' };
    if ((item.percVenda || 0) >= 70) return { label: 'ÓTIMO', color: 'bg-green-100 text-green-800' };
    if ((item.percVenda || 0) >= 50) return { label: 'BOM', color: 'bg-blue-100 text-blue-800' };
    return { label: 'REGULAR', color: 'bg-gray-100 text-gray-800' };
  };

  const getRisco = (dias: number) => {
    if (dias > 180) return { label: 'ALTO', color: 'bg-red-100 text-red-800' };
    if (dias > 90) return { label: 'MÉDIO', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'BAIXO', color: 'bg-green-100 text-green-800' };
  };

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 Análise de Performance - Fornecedores
          </h1>
          <p className="text-gray-600">
            Importe o relatório do fornecedor e analise a performance de vendas por loja e ano
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Erro ao processar arquivo</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {errorMulti && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Erro ao processar arquivo (Várias marcas)</h3>
              <p className="text-sm text-red-700">{errorMulti}</p>
            </div>
          </div>
        )}

        {!processedData && !multiProcessedData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Importar Análise de Fornecedor
              </h3>
              
              <p className="text-sm text-gray-600 mb-6">
                Faça upload do arquivo Excel (.xls ou .xlsx) exportado do sistema do fornecedor
              </p>

              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <div>
                  <input
                    type="file"
                    accept=".xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processFile(file);
                    }}
                    className="hidden"
                    id="file-upload"
                    disabled={isProcessing || isProcessingMulti}
                  />

                  <label
                    htmlFor="file-upload"
                    className={`inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors ${
                      isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload className="w-5 h-5" />
                    {isProcessing ? 'Processando...' : 'Selecionar Arquivo — Uma única marca'}
                  </label>
                </div>

                <div>
                  <input
                    type="file"
                    accept=".xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processFileMulti(file);
                    }}
                    className="hidden"
                    id="file-upload-multi"
                    disabled={isProcessing || isProcessingMulti}
                  />

                  <label
                    htmlFor="file-upload-multi"
                    className={`inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer transition-colors ${
                      isProcessingMulti ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload className="w-5 h-5" />
                    {isProcessingMulti ? 'Processando...' : 'Selecionar Arquivo — Várias marcas'}
                  </label>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Formatos aceitos: .xls, .xlsx (Suporta HTML codificado em UTF-16LE com BOM)
              </p>
            </div>
          </div>
        ) : processedData ? (
          <>
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {processedData.marca} - {processedData.items.length} itens processados
                </h3>
                <p className="text-sm text-gray-600">
                  {processedData.lojas.length} lojas • Anos: {processedData.anos.join(', ')}
                </p>
              </div>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <Download className="w-5 h-5" />
                {isExporting ? 'Exportando...' : 'Exportar Excel Completo'}
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Loja</label>
                    <select
                      value={selectedLoja}
                      onChange={(e) => setSelectedLoja(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">Todas as Lojas</option>
                      {processedData.lojas.map(loja => (
                        <option key={loja} value={loja}>Loja {loja}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                    <select
                      value={selectedAno}
                      onChange={(e) => setSelectedAno(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">Todos os Anos</option>
                      {processedData.anos.map(ano => (
                        <option key={ano} value={ano}>{ano}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Buscar Referência</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Digite a referência..."
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="bg-green-50 border-b border-green-200 px-4 py-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-700" />
                  <h3 className="font-semibold text-green-900">
                    ✓ TOP 20 MAIS VENDIDOS ({topItems.length} itens)
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Referência</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Estq Atual</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Comprou</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Vendeu</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">% Venda</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {topItems.map((item, idx) => {
                        const status = getStatus(item);
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.referencia}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-700">{item.estoqueQtde}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-700">{item.compraQtde}</td>
                            <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900">{item.vendaQtde}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-700">{item.percVenda?.toFixed(1)}%</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${status.color}`}>
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {flopItems.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-700" />
                    <h3 className="font-semibold text-red-900">
                      ✗ NÃO VENDERAM ({flopItems.length} itens com estoque parado)
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Referência</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Estq Parado</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Comprou</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Última Compra</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Dias Parado</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Risco</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {flopItems.map((item, idx) => {
                          const risco = getRisco(item.diasEstoque);
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.referencia}</td>
                              <td className="px-4 py-3 text-sm text-center text-gray-700">{item.estoqueQtde}</td>
                              <td className="px-4 py-3 text-sm text-center text-gray-700">{item.compraQtde}</td>
                              <td className="px-4 py-3 text-sm text-center text-gray-700">{item.ultimaCompra || '-'}</td>
                              <td className="px-4 py-3 text-sm text-center text-gray-700">{item.diasEstoque}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${risco.color}`}>
                                  {risco.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setProcessedData(null);
                  setError(null);
                }}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Carregar outro arquivo
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ==================== DASHBOARD MULTI-MARCAS ==================== */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    📦 Análise de Multi-Marcas ({multiProcessedData.items.length} registros)
                  </h3>
                  <p className="text-sm text-gray-600 font-medium">
                    Marcas: {multiProcessedData.marcas.join(', ')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Lojas: {multiProcessedData.lojas.map(l => String(l).padStart(2, '0')).join(', ')} • Anos: {multiProcessedData.anos.join(', ')}
                  </p>
                </div>
                <button
                  onClick={handleExportMulti}
                  disabled={isExportingMulti}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm text-sm"
                >
                  <Download className="w-5 h-5" />
                  {isExportingMulti ? 'Exportando...' : 'Exportar Excel Completo'}
                </button>
              </div>

              {/* Seletor de Aba */}
              <div className="flex border-b border-gray-200 gap-6">
                <button
                  onClick={() => setSelectedTabMulti('resumo')}
                  className={`pb-4 px-2 font-bold text-sm tracking-wide border-b-2 transition-colors ${
                    selectedTabMulti === 'resumo'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  📋 RESUMO GERAL
                </button>
                <button
                  onClick={() => setSelectedTabMulti('lojas')}
                  className={`pb-4 px-2 font-bold text-sm tracking-wide border-b-2 transition-colors ${
                    selectedTabMulti === 'lojas'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  🏪 ABAS POR LOJA
                </button>
              </div>

              {selectedTabMulti === 'resumo' ? (
                <div className="space-y-6">
                  {resumoGeralData.map(bd => {
                    const colorConfig = getBrandColor(bd.marca);
                    return (
                      <div key={bd.marca} className={`bg-white rounded-xl shadow-sm border ${colorConfig.border} overflow-hidden`}>
                        <div className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${colorConfig.bg} border-b ${colorConfig.border}`}>
                          <span className={`text-base font-black uppercase tracking-wider ${colorConfig.text}`}>
                            🏷️ MARCA: {bd.marca}
                          </span>
                          <div className="text-right">
                            <span className="text-xs font-bold text-gray-400 uppercase mr-1">Margem Total Vendeu Bem:</span>
                            <span className={`text-base font-black ${colorConfig.text}`}>{fmtCurrency(bd.totalMargemReais)}</span>
                          </div>
                        </div>

                        <div className="p-4">
                          {bd.references.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-gray-50 text-gray-700 text-xs font-bold uppercase border-b border-gray-200">
                                  <tr>
                                    <th className="px-4 py-3 text-left">Referência</th>
                                    <th className="px-4 py-3 text-right">Margem Total (R$)</th>
                                    <th className="px-4 py-3 text-center w-24">Qtd Lojas</th>
                                    {sortedLojas.map(loja => (
                                      <th key={loja} className="px-2 py-3 text-center w-16 bg-gray-100 border-l border-gray-200">
                                        Loja {String(loja).padStart(2, '0')}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {bd.references.map((ref, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 font-bold text-gray-900">{ref.referencia}</td>
                                      <td className="px-4 py-3 text-right font-semibold text-gray-700">{fmtCurrency(ref.totalMargemRef)}</td>
                                      <td className="px-4 py-3 text-center font-black text-blue-600 bg-blue-50/50">{ref.lojasCount}</td>
                                      {sortedLojas.map(loja => {
                                        const info = ref.storeInfoMap[loja];
                                        if (info) {
                                          const isGreen = info.percVenda >= 70;
                                          return (
                                            <td key={loja} className={`px-2 py-3 text-center border-l border-gray-100 ${
                                              isGreen 
                                                ? 'bg-green-100 text-green-900 font-black border-green-200' 
                                                : 'bg-amber-100 text-amber-900 font-bold border-amber-200'
                                            }`}>
                                              {info.vendaQtde}
                                            </td>
                                          );
                                        }
                                        return (
                                          <td key={loja} className="px-2 py-3 text-center text-gray-300 border-l border-gray-100">—</td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic text-center py-4">
                              Nenhum item desta marca atingiu o critério "vendeu bem" (Venda &gt;= 50% e Compra &gt;= 5 pares).
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Seletor de Loja */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <span className="font-bold text-sm text-gray-700 uppercase">Selecionar Loja:</span>
                    <div className="flex flex-wrap gap-2">
                      {multiProcessedData.lojas.map(loja => (
                        <button
                          key={loja}
                          onClick={() => setSelectedLojaMulti(loja)}
                          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                            selectedLojaMulti === loja
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Loja {String(loja).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Blocos por Marca na Loja Selecionada */}
                  {(() => {
                    const itemsOfStore = multiProcessedData.items.filter(it => it.loja === selectedLojaMulti);
                    const brandsInStore = Array.from(new Set(itemsOfStore.map(it => it.marca))).sort();

                    if (brandsInStore.length === 0) {
                      return (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500 italic">
                          Nenhuma marca cadastrada nesta loja.
                        </div>
                      );
                    }

                    return brandsInStore.map(brand => {
                      const itemsOfBrand = itemsOfStore.filter(it => it.marca === brand);
                      const brandColor = getBrandColor(brand);

                      // 1. Alerta de Ruptura
                      const ruptura = sortMultiItems(
                        itemsOfBrand.filter(i => i.compraQtde > 0 && i.percVenda >= 50)
                      );

                      // 2. Recentes
                      const recentes = sortMultiItems(
                        itemsOfBrand.filter(i => i.compraQtde > 0)
                      );

                      // 3. Top 20
                      const top20 = sortMultiItems(
                        itemsOfBrand
                          .filter(i => i.vendaQtde > 0)
                          .sort((a, b) => b.vendaQtde - a.vendaQtde)
                          .slice(0, 20)
                      );

                      // 4. Parados
                      const parados = sortMultiItems(
                        itemsOfBrand.filter(i => i.estoqueQtde > 0 && i.vendaQtde === 0 && i.diasEstoque > 90)
                      );

                      return (
                        <div key={brand} className={`bg-white rounded-xl shadow-sm border ${brandColor.border} overflow-hidden p-6 space-y-6`}>
                          <div className="flex items-center justify-between border-b pb-4">
                            <span className={`text-lg font-black uppercase tracking-wider ${brandColor.text}`}>
                              🏷️ MARCA: {brand}
                            </span>
                            <span className="text-xs font-bold text-gray-400 uppercase">
                              Loja {String(selectedLojaMulti).padStart(2, '0')}
                            </span>
                          </div>

                          {/* BLOCO 1: ALERTA DE RUPTURA */}
                          <div className="bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden">
                            <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-red-700" />
                                <h3 className="font-bold text-red-900 text-sm uppercase tracking-wide">
                                  🚨 ALERTA DE RUPTURA — Ordenado por Margem ({ruptura.length} itens)
                                </h3>
                              </div>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs font-bold uppercase">
                                  <tr>
                                    <th className="px-4 py-3 text-left">Referência</th>
                                    <th className="px-4 py-3 text-right">Margem (R$)</th>
                                    <th className="px-4 py-3 text-center">Comprou</th>
                                    <th className="px-4 py-3 text-center">Vendeu</th>
                                    <th className="px-4 py-3 text-center">Estoque</th>
                                    <th className="px-4 py-3 text-center">% Vendido</th>
                                    <th className="px-4 py-3 text-center">Vel./Dia</th>
                                    <th className="px-4 py-3 text-center">Cob. (Nossa)</th>
                                    <th className="px-4 py-3 text-center">Cob. (Forn.)</th>
                                    <th className="px-4 py-3 text-center">Sugestão</th>
                                    <th className="px-4 py-3 text-center">Markup (Real/Inic)</th>
                                    <th className="px-4 py-3 text-center">Pedidos Pend.</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                  {ruptura.map((item, idx) => {
                                    const mDiff = Math.abs(item.markupReal - item.markupInicial) > 5;
                                    const statusInfo = getStatusAndColors(item.estoqueQtde, item.percVenda);
                                    return (
                                      <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-bold text-gray-900">{item.referencia}</td>
                                        <td className="px-4 py-3 text-right font-black text-red-600">{fmtCurrency(item.margemReais)}</td>
                                        <td className="px-4 py-3 text-center">{item.compraQtde}</td>
                                        <td className="px-4 py-3 text-center font-semibold">{item.vendaQtde}</td>
                                        <td className="px-4 py-3 text-center">{item.estoqueQtde}</td>
                                        <td className="px-4 py-3 text-center font-bold text-red-700">{item.percVenda?.toFixed(0)}%</td>
                                        <td className="px-4 py-3 text-center">{item.velocidade?.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-center font-bold">{item.cobertura === null ? '∞' : `${item.cobertura}d`}</td>
                                        <td className="px-4 py-3 text-center">{item.coberturaFornecedor === null ? '∞' : `${item.coberturaFornecedor}d`}</td>
                                        <td className="px-4 py-3 text-center font-bold text-blue-600">{item.sugestaoCompra || '—'}</td>
                                        <td className={`px-4 py-3 text-center font-medium ${mDiff ? 'bg-amber-100 font-black text-amber-900' : ''}`}>
                                          {item.markupReal?.toFixed(1)}% / {item.markupInicial?.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          {item.pedidosPendentesQtde > 0 ? (
                                            <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold animate-pulse">
                                              ⚠️ {item.pedidosPendentesQtde} pend.
                                            </span>
                                          ) : (
                                            <span className="text-gray-400">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span className={`inline-block px-2.5 py-1 text-xs font-black rounded ${statusInfo.uiBg}`}>
                                            {statusInfo.text}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {ruptura.length === 0 && (
                                    <tr>
                                      <td colSpan={13} className="px-4 py-6 text-center text-gray-500 italic">
                                        Nenhum item com risco de ruptura nesta marca.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* BLOCO 2: MERCADORIAS QUE CHEGARAM NO PERÍODO */}
                          <div className="bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden">
                            <div className="bg-purple-50 border-b border-purple-200 px-4 py-3">
                              <h3 className="font-bold text-purple-900 text-sm uppercase tracking-wide">
                                📦 MERCADORIAS QUE CHEGARAM NO PERÍODO ({recentes.length} itens)
                              </h3>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs font-bold uppercase">
                                  <tr>
                                    <th className="px-4 py-3 text-left">Referência</th>
                                    <th className="px-4 py-3 text-right">Margem (R$)</th>
                                    <th className="px-4 py-3 text-center">Comprou</th>
                                    <th className="px-4 py-3 text-center">Vendeu</th>
                                    <th className="px-4 py-3 text-center">Estoque</th>
                                    <th className="px-4 py-3 text-center">% Vendido</th>
                                    <th className="px-4 py-3 text-center">Vel./Dia</th>
                                    <th className="px-4 py-3 text-center">Cob. (Nossa)</th>
                                    <th className="px-4 py-3 text-center">Cob. (Forn.)</th>
                                    <th className="px-4 py-3 text-center">Sugestão</th>
                                    <th className="px-4 py-3 text-center">Markup (Real/Inic)</th>
                                    <th className="px-4 py-3 text-center">Pedidos Pend.</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                  {recentes.map((item, idx) => {
                                    const mDiff = Math.abs(item.markupReal - item.markupInicial) > 5;
                                    const statusInfo = getStatusAndColors(item.estoqueQtde, item.percVenda);
                                    return (
                                      <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-bold text-gray-900">{item.referencia}</td>
                                        <td className="px-4 py-3 text-right font-black text-purple-700">{fmtCurrency(item.margemReais)}</td>
                                        <td className="px-4 py-3 text-center">{item.compraQtde}</td>
                                        <td className="px-4 py-3 text-center font-semibold">{item.vendaQtde}</td>
                                        <td className="px-4 py-3 text-center">{item.estoqueQtde}</td>
                                        <td className="px-4 py-3 text-center font-bold text-purple-700">{item.percVenda?.toFixed(0)}%</td>
                                        <td className="px-4 py-3 text-center">{item.velocidade?.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-center font-bold">{item.cobertura === null ? '∞' : `${item.cobertura}d`}</td>
                                        <td className="px-4 py-3 text-center">{item.coberturaFornecedor === null ? '∞' : `${item.coberturaFornecedor}d`}</td>
                                        <td className="px-4 py-3 text-center font-bold text-blue-600">{item.sugestaoCompra || '—'}</td>
                                        <td className={`px-4 py-3 text-center font-medium ${mDiff ? 'bg-amber-100 font-black text-amber-900' : ''}`}>
                                          {item.markupReal?.toFixed(1)}% / {item.markupInicial?.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          {item.pedidosPendentesQtde > 0 ? (
                                            <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold animate-pulse">
                                              ⚠️ {item.pedidosPendentesQtde} pend.
                                            </span>
                                          ) : (
                                            <span className="text-gray-400">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span className={`inline-block px-2.5 py-1 text-xs font-black rounded ${statusInfo.uiBg}`}>
                                            {statusInfo.text}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {recentes.length === 0 && (
                                    <tr>
                                      <td colSpan={13} className="px-4 py-6 text-center text-gray-500 italic">
                                        Nenhum item com compra recente nesta marca.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* BLOCO 3: TOP MAIS VENDIDOS */}
                          <div className="bg-white rounded-lg shadow-sm border border-green-200 overflow-hidden">
                            <div className="bg-green-50 border-b border-green-200 px-4 py-3">
                              <h3 className="font-bold text-green-900 text-sm uppercase tracking-wide">
                                🏆 TOP MAIS VENDIDOS ({top20.length} itens)
                              </h3>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs font-bold uppercase">
                                  <tr>
                                    <th className="px-4 py-3 text-center w-12">Pos</th>
                                    <th className="px-4 py-3 text-left">Referência</th>
                                    <th className="px-4 py-3 text-right">Margem (R$)</th>
                                    <th className="px-4 py-3 text-right">Preço Venda</th>
                                    <th className="px-4 py-3 text-center">Comprou</th>
                                    <th className="px-4 py-3 text-center">Vendeu</th>
                                    <th className="px-4 py-3 text-center">Estoque</th>
                                    <th className="px-4 py-3 text-center">% Vendido</th>
                                    <th className="px-4 py-3 text-center">Vel./Dia</th>
                                    <th className="px-4 py-3 text-center">Cob. (Nossa)</th>
                                    <th className="px-4 py-3 text-center">Cob. (Forn.)</th>
                                    <th className="px-4 py-3 text-center">Sugestão</th>
                                    <th className="px-4 py-3 text-center">Markup (Real/Inic)</th>
                                    <th className="px-4 py-3 text-center">Pedidos Pend.</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                  {top20.map((item, idx) => {
                                    const mDiff = Math.abs(item.markupReal - item.markupInicial) > 5;
                                    const statusInfo = getStatusAndColors(item.estoqueQtde, item.percVenda);
                                    return (
                                      <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-center font-bold text-gray-400">{idx + 1}</td>
                                        <td className="px-4 py-3 font-bold text-gray-900">{item.referencia}</td>
                                        <td className="px-4 py-3 text-right font-black text-green-700">{fmtCurrency(item.margemReais)}</td>
                                        <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(item.vendaValor)}</td>
                                        <td className="px-4 py-3 text-center">{item.compraQtde}</td>
                                        <td className="px-4 py-3 text-center font-semibold">{item.vendaQtde}</td>
                                        <td className="px-4 py-3 text-center">{item.estoqueQtde}</td>
                                        <td className="px-4 py-3 text-center font-bold text-green-700">{item.percVenda?.toFixed(0)}%</td>
                                        <td className="px-4 py-3 text-center">{item.velocidade?.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-center font-bold">{item.cobertura === null ? '∞' : `${item.cobertura}d`}</td>
                                        <td className="px-4 py-3 text-center">{item.coberturaFornecedor === null ? '∞' : `${item.coberturaFornecedor}d`}</td>
                                        <td className="px-4 py-3 text-center font-bold text-blue-600">{item.sugestaoCompra || '—'}</td>
                                        <td className={`px-4 py-3 text-center font-medium ${mDiff ? 'bg-amber-100 font-black text-amber-900' : ''}`}>
                                          {item.markupReal?.toFixed(1)}% / {item.markupInicial?.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          {item.pedidosPendentesQtde > 0 ? (
                                            <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold animate-pulse">
                                              ⚠️ {item.pedidosPendentesQtde} pend.
                                            </span>
                                          ) : (
                                            <span className="text-gray-400">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span className={`inline-block px-2.5 py-1 text-xs font-black rounded ${statusInfo.uiBg}`}>
                                            {statusInfo.text}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {top20.length === 0 && (
                                    <tr>
                                      <td colSpan={15} className="px-4 py-6 text-center text-gray-500 italic">
                                        Nenhum item vendido nesta marca.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* BLOCO 4: ESTOQUE PARADO */}
                          <div className="bg-white rounded-lg shadow-sm border border-orange-200 overflow-hidden">
                            <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
                              <h3 className="font-bold text-orange-900 text-sm uppercase tracking-wide">
                                💀 ESTOQUE PARADO (+90 dias sem venda) ({parados.length} itens)
                              </h3>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs font-bold uppercase">
                                  <tr>
                                    <th className="px-4 py-3 text-left">Referência</th>
                                    <th className="px-4 py-3 text-right">Preço Venda</th>
                                    <th className="px-4 py-3 text-right">Preço Compra</th>
                                    <th className="px-4 py-3 text-center">Estoque Qtde</th>
                                    <th className="px-4 py-3 text-center">Última Compra</th>
                                    <th className="px-4 py-3 text-center">Dias Parado</th>
                                    <th className="px-4 py-3 text-center">Cob. (Forn.)</th>
                                    <th className="px-4 py-3 text-center">Sugestão</th>
                                    <th className="px-4 py-3 text-center">Markup (Real/Inic)</th>
                                    <th className="px-4 py-3 text-center">Pedidos Pend.</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                  {parados.map((item, idx) => {
                                    const mDiff = Math.abs(item.markupReal - item.markupInicial) > 5;
                                    const statusInfo = getStatusAndColors(item.estoqueQtde, item.percVenda);
                                    let riscoBg = '';
                                    if (item.diasEstoque > 365) riscoBg = 'bg-red-50 text-red-900';
                                    else if (item.diasEstoque > 180) riscoBg = 'bg-amber-50 text-amber-900';

                                    return (
                                      <tr key={idx} className={`hover:bg-gray-50 ${riscoBg}`}>
                                        <td className="px-4 py-3 font-bold text-gray-900">{item.referencia}</td>
                                        <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(item.vendaValor)}</td>
                                        <td className="px-4 py-3 text-right">{fmtCurrency(item.precoCompra)}</td>
                                        <td className="px-4 py-3 text-center font-bold">{item.estoqueQtde}</td>
                                        <td className="px-4 py-3 text-center">{item.ultimaCompra || '—'}</td>
                                        <td className="px-4 py-3 text-center font-semibold">{item.diasEstoque}d</td>
                                        <td className="px-4 py-3 text-center">{item.coberturaFornecedor === null ? '∞' : `${item.coberturaFornecedor}d`}</td>
                                        <td className="px-4 py-3 text-center font-bold text-blue-600">{item.sugestaoCompra || '—'}</td>
                                        <td className={`px-4 py-3 text-center font-medium ${mDiff ? 'bg-amber-100 font-black text-amber-900' : ''}`}>
                                          {item.markupReal?.toFixed(1)}% / {item.markupInicial?.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          {item.pedidosPendentesQtde > 0 ? (
                                            <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold animate-pulse">
                                              ⚠️ {item.pedidosPendentesQtde} pend.
                                            </span>
                                          ) : (
                                            <span className="text-gray-400">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span className={`inline-block px-2.5 py-1 text-xs font-black rounded ${statusInfo.uiBg}`}>
                                            {statusInfo.text}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {parados.length === 0 && (
                                    <tr>
                                      <td colSpan={11} className="px-4 py-6 text-center text-gray-500 italic">
                                        Nenhum item com estoque parado nesta marca.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setMultiProcessedData(null);
                  setErrorMulti(null);
                }}
                className="text-sm text-gray-600 hover:text-gray-900 underline font-semibold"
              >
                Carregar outro arquivo (Várias marcas)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BuyOrderAnalytic;
