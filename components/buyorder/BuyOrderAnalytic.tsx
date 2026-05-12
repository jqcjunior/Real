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
  ano?: number;
  percVenda?: number;
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
      // Validação da biblioteca conforme solicitado
      console.log('XLSX carregado com sucesso:', !!XLSX && !!XLSX.utils);
      
      if (!XLSX || !XLSX.utils) {
        throw new Error('Biblioteca XLSX não carregada corretamente');
      }

      // Ler arquivo como ArrayBuffer
      const data = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      // Parsear workbook
      const workbook = XLSX.read(data, { type: 'array' });
      console.log('Workbook carregado');
      
      if (!workbook.SheetNames?.length) {
        throw new Error('Nenhuma planilha encontrada');
      }

      let sheetName = workbook.SheetNames[0];
      let sheet = workbook.Sheets[sheetName];
      
      if (!sheet) {
        throw new Error('Worksheet inválida');
      }

      let rawData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

      // Se primeira sheet está vazia, tentar segunda
      if (rawData.length < 10 && workbook.SheetNames.length > 1) {
        sheetName = workbook.SheetNames[1];
        sheet = workbook.Sheets[sheetName];
        if (sheet) {
          rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
        }
      }

      // USAR LINHA 5 COMO HEADER (índice 4)
      const headerRowIndex = 4;
      
      if (rawData.length <= headerRowIndex) {
        throw new Error('Arquivo muito pequeno ou formato incorreto');
      }

      const headers = rawData[headerRowIndex];
      const dataRows = rawData.slice(headerRowIndex + 1);

      // Mapear índices exatos das colunas
      const colMap: Record<string, number> = {};
      headers.forEach((header: any, index: number) => {
        const headerStr = String(header || '').trim();
        colMap[headerStr] = index;
      });

      // Buscar colunas essenciais
      const getColIndex = (exactNames: string[]): number => {
        for (const name of exactNames) {
          if (colMap[name] !== undefined) return colMap[name];
        }
        return -1;
      };

      const colIndices = {
        loja: getColIndex(['Loja']),
        marca: getColIndex(['Marca']),
        referencia: getColIndex(['Referência']),
        estoqueQtde: getColIndex(['Estoque (Qtde)']),
        compraQtde: getColIndex(['Compra (Qtde)']),
        vendaQtde: getColIndex(['Venda (Qtde)']),
        vendaValor: getColIndex(['Venda (R$)']),
        ultimaCompra: getColIndex(['Última Compra']),
        diasEstoque: getColIndex(['Dias em Estoque'])
      };

      // Validar colunas obrigatórias
      if (colIndices.loja === -1) {
        throw new Error('Coluna "Loja" não encontrada');
      }
      if (colIndices.referencia === -1) {
        throw new Error('Coluna "Referência" não encontrada');
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
                const parsed = XLSX.SSF.parse_date_code(ultimaCompraRaw);
                dateObj = new Date(parsed.y, parsed.m - 1, parsed.d);
              } else if (typeof ultimaCompraRaw === 'string') {
                // Formato DD/MM/YYYY
                if (ultimaCompraRaw.includes('/')) {
                  const parts = ultimaCompraRaw.split('/');
                  if (parts.length === 3) {
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const year = parseInt(parts[2]);
                    dateObj = new Date(year, month, day);
                  }
                } else {
                  dateObj = new Date(ultimaCompraRaw);
                }
              }

              if (dateObj && !isNaN(dateObj.getTime())) {
                ano = dateObj.getFullYear();
                ultimaCompraDate = dateObj.toLocaleDateString('pt-BR');
              }
            } catch (e) {
              console.warn('Erro ao parsear data');
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
            diasEstoque: parseNumber(getValue(colIndices.diasEstoque, 0)),
            ano,
            percVenda
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

    } catch (err) {
      console.error('Erro ao processar arquivo');
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao processar arquivo');
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

      const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2C5F8D' } };
      const headerFont = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      const titleFont = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF2C5F8D' } };
      const yearFont = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      const yearFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4472C4' } };
      const goodFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFC6EFCE' } };
      const badFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFC7CE' } };
      const starFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFD700' } };
      const starFont = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF8B4513' } };

      const border = {
        top: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } }
      };

      const anos = processedData.anos;

      for (const loja of processedData.lojas) {
        const worksheet = workbook.addWorksheet(`Loja ${loja}`);

        const titleRow = worksheet.addRow([`LOJA ${loja} - ANÁLISE ${processedData.marca.toUpperCase()}`]);
        titleRow.getCell(1).font = titleFont;
        worksheet.mergeCells(1, 1, 1, 6);
        
        let currentRow = 3;

        const topRefsPorAno: Record<number, string[]> = {};
        
        for (const ano of anos) {
          const dadosAno = processedData.items.filter(item => item.loja === loja && item.ano === ano);
          if (dadosAno.length > 0) {
            const top20 = dadosAno
              .filter(item => item.vendaQtde > 0)
              .sort((a, b) => b.vendaQtde - a.vendaQtde)
              .slice(0, 20)
              .map(item => item.referencia);
            topRefsPorAno[ano] = top20;
          }
        }

        let recorrentes: string[] = [];
        if (Object.keys(topRefsPorAno).length === 2) {
          const setAno1 = new Set(topRefsPorAno[anos[0]] || []);
          const setAno2 = new Set(topRefsPorAno[anos[1]] || []);
          recorrentes = Array.from(setAno1).filter(ref => setAno2.has(ref));
        }

        if (recorrentes.length > 0) {
          const destaqueRow = worksheet.addRow([`⭐ DESTAQUE: ${recorrentes.length} itens TOP nos 2 anos consecutivos`]);
          destaqueRow.getCell(1).font = starFont;
          destaqueRow.getCell(1).fill = starFill;
          worksheet.mergeCells(currentRow, 1, currentRow, 6);
          currentRow++;

          for (const ref of recorrentes.sort()) {
            const refRow = worksheet.addRow([`  • ${ref}`]);
            refRow.getCell(1).font = starFont;
            worksheet.mergeCells(currentRow, 1, currentRow, 6);
            currentRow++;
          }
          currentRow++;
        }

        for (const ano of anos) {
          const dadosAno = processedData.items.filter(item => item.loja === loja && item.ano === ano);
          
          if (dadosAno.length === 0) continue;

          const anoRow = worksheet.addRow([`ANO ${ano}`]);
          anoRow.getCell(1).font = yearFont;
          anoRow.getCell(1).fill = yearFill;
          anoRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
          worksheet.mergeCells(currentRow, 1, currentRow, 6);
          currentRow++;

          const venderamBem = dadosAno
            .filter(item => item.vendaQtde > 0)
            .sort((a, b) => b.vendaQtde - a.vendaQtde)
            .slice(0, 20);

          const topTitleRow = worksheet.addRow(['✓ TOP 20 MAIS VENDIDOS']);
          topTitleRow.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF006100' } };
          topTitleRow.getCell(1).fill = goodFill;
          worksheet.mergeCells(currentRow, 1, currentRow, 6);
          currentRow++;

          const topHeaderRow = worksheet.addRow(['Referência', 'Estq Atual', 'Comprou', 'Vendeu', '% Venda', 'Status']);
          topHeaderRow.eachCell((cell) => {
            cell.font = headerFont;
            cell.fill = headerFill;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = border;
          });
          currentRow++;

          for (const item of venderamBem) {
            const isRecorrente = recorrentes.includes(item.referencia);
            const percVenda = item.percVenda || 0;
            let status = 'REGULAR';
            if (item.estoqueQtde === 0) status = 'ZEROU';
            else if (percVenda >= 70) status = 'ÓTIMO';
            else if (percVenda >= 50) status = 'BOM';

            const dataRow = worksheet.addRow([
              (isRecorrente ? '⭐ ' : '') + item.referencia,
              item.estoqueQtde,
              item.compraQtde,
              item.vendaQtde,
              `${percVenda.toFixed(1)}%`,
              status
            ]);

            dataRow.eachCell((cell, colNumber) => {
              cell.border = border;
              if (colNumber === 1) {
                cell.alignment = { horizontal: 'left' };
                if (isRecorrente) cell.font = starFont;
              } else {
                cell.alignment = { horizontal: 'center' };
              }
            });
            currentRow++;
          }

          currentRow++;

          const naoVenderam = dadosAno
            .filter(item => item.vendaQtde === 0 && item.estoqueQtde > 0)
            .sort((a, b) => b.estoqueQtde - a.estoqueQtde)
            .slice(0, 15);

          if (naoVenderam.length > 0) {
            const flopTitleRow = worksheet.addRow([`✗ NÃO VENDERAM (${naoVenderam.length} itens com estoque parado)`]);
            flopTitleRow.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF9C0006' } };
            flopTitleRow.getCell(1).fill = badFill;
            worksheet.mergeCells(currentRow, 1, currentRow, 6);
            currentRow++;

            const flopHeaderRow = worksheet.addRow(['Referência', 'Estq Parado', 'Comprou', 'Última Compra', 'Dias Parado', 'Risco']);
            flopHeaderRow.eachCell((cell) => {
              cell.font = headerFont;
              cell.fill = headerFill;
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              cell.border = border;
            });
            currentRow++;

            for (const item of naoVenderam) {
              const diasParado = item.diasEstoque || 0;
              let risco = 'BAIXO';
              if (diasParado > 180) risco = 'ALTO';
              else if (diasParado > 90) risco = 'MÉDIO';

              const dataRow = worksheet.addRow([
                item.referencia,
                item.estoqueQtde,
                item.compraQtde,
                item.ultimaCompra || '-',
                diasParado,
                risco
              ]);

              dataRow.eachCell((cell, colNumber) => {
                cell.border = border;
                cell.alignment = { horizontal: colNumber === 1 ? 'left' : 'center' };
              });
              currentRow++;
            }
          }

          currentRow += 2;
        }

        worksheet.getColumn(1).width = 28;
        worksheet.getColumn(2).width = 12;
        worksheet.getColumn(3).width = 12;
        worksheet.getColumn(4).width = 12;
        worksheet.getColumn(5).width = 12;
        worksheet.getColumn(6).width = 12;
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
      console.error('Erro ao exportar arquivo');
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
