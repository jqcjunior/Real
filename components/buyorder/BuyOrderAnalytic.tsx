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
  
  // Filtros
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

        {!processedData ? (
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

              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processFile(file);
                }}
                className="hidden"
                id="file-upload"
                disabled={isProcessing}
              />

              <label
                htmlFor="file-upload"
                className={`inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors ${
                  isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Upload className="w-5 h-5" />
                {isProcessing ? 'Processando...' : 'Selecionar Arquivo'}
              </label>

              <p className="text-xs text-gray-500 mt-4">
                Formatos aceitos: .xls, .xlsx
              </p>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default BuyOrderAnalytic;
