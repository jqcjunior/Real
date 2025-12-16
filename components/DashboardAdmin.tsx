import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, FileSpreadsheet, Sparkles, Upload, Calendar, BarChart2, CheckCircle, Filter, FileText, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { analyzePerformance, extractDataFromDocument, ExtractedPDFData } from '../services/geminiService';
import * as XLSX from 'xlsx';

interface DashboardAdminProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onImportData: (data: MonthlyPerformance[]) => void;
}

type EvolutionMetric = 'revenue' | 'pa' | 'ticket';

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, onImportData }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [evolutionMetric, setEvolutionMetric] = useState<EvolutionMetric>('revenue');
  
  // File Import States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // FILTER: Only show performance data for stores that currently exist in the 'stores' list.
  const activePerformanceData = useMemo(() => {
    const activeStoreIds = new Set(stores.map(s => s.id));
    return performanceData.filter(d => activeStoreIds.has(d.storeId));
  }, [performanceData, stores]);

  // Determine available years from data + current year
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear()); // Ensure current year is always an option
    activePerformanceData.forEach(d => {
        const y = parseInt(d.month.split('-')[0]);
        if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a,b) => b - a); // Descending
  }, [activePerformanceData]);

  // Initial State: Latest Month in Data or Current Month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const months = Array.from(new Set(activePerformanceData.map(d => d.month))).sort();
     return months.length > 0 ? months[months.length - 1] : new Date().toISOString().slice(0, 7);
  });

  // Helper to format Month Name (e.g. 2025-11 -> Novembro)
  const formatMonthName = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1); // Capitalize
  };

  const handleMonthYearChange = (type: 'month' | 'year', value: number) => {
      const [currentY, currentM] = selectedMonth.split('-');
      let newY = parseInt(currentY);
      let newM = parseInt(currentM);

      if (type === 'month') newM = value;
      if (type === 'year') newY = value;

      const newStr = `${newY}-${String(newM).padStart(2, '0')}`;
      setSelectedMonth(newStr);
  };

  // Filter data for the selected month (for KPIs and Ranking) using ACTIVE data
  const currentMonthData = useMemo(() => {
    return activePerformanceData.filter(d => d.month === selectedMonth);
  }, [activePerformanceData, selectedMonth]);

  // --- COMPARATIVE LOGIC (NEW) ---
  const comparisons = useMemo(() => {
      const [currY, currM] = selectedMonth.split('-').map(Number);
      
      // Previous Month Logic
      let prevM = currM - 1;
      let prevY_MoM = currY;
      if (prevM === 0) { prevM = 12; prevY_MoM = currY - 1; }
      const prevMonthStr = `${prevY_MoM}-${String(prevM).padStart(2, '0')}`;

      // Previous Year Logic
      const prevYearStr = `${currY - 1}-${String(currM).padStart(2, '0')}`;

      // Calculate Sums
      const currentRev = activePerformanceData.filter(d => d.month === selectedMonth).reduce((acc, c) => acc + c.revenueActual, 0);
      const lastMonthRev = activePerformanceData.filter(d => d.month === prevMonthStr).reduce((acc, c) => acc + c.revenueActual, 0);
      const lastYearRev = activePerformanceData.filter(d => d.month === prevYearStr).reduce((acc, c) => acc + c.revenueActual, 0);

      // Calculate Percentages
      const momPercent = lastMonthRev > 0 ? ((currentRev - lastMonthRev) / lastMonthRev) * 100 : 0;
      const yoyPercent = lastYearRev > 0 ? ((currentRev - lastYearRev) / lastYearRev) * 100 : 0;

      return {
          currentRev,
          momPercent,
          yoyPercent,
          lastMonthRev,
          lastYearRev
      };
  }, [activePerformanceData, selectedMonth]);

  // Aggregated Stats for Selected Month
  const totalRevenue = comparisons.currentRev;
  const totalTarget = currentMonthData.reduce((acc, curr) => acc + curr.revenueTarget, 0);
  const globalPercent = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
  
  // Data for Ranking Charts (Selected Month)
  const rankingData = useMemo(() => {
    return currentMonthData.map(p => {
      const storeName = stores.find(s => s.id === p.storeId)?.name || p.storeId;
      return {
        name: storeName.split(' ')[0] + ' ' + (storeName.split(' ')[1] || ''), // Short name
        Realizado: p.revenueActual,
        Meta: p.revenueTarget,
        Atingimento: p.percentMeta
      };
    }).sort((a, b) => b.Atingimento - a.Atingimento);
  }, [currentMonthData, stores]);

  // Data for Evolution Chart (History) using ACTIVE data - Use availableYears to determine range or just data
  const evolutionData = useMemo(() => {
    const months = Array.from(new Set(activePerformanceData.map(d => d.month))).sort();
    
    return months.map(month => {
      const monthData = activePerformanceData.filter(d => d.month === month);
      const count = monthData.length || 1;
      
      const rev = monthData.reduce((acc, c) => acc + c.revenueActual, 0);
      const target = monthData.reduce((acc, c) => acc + c.revenueTarget, 0);
      
      const avgPA = monthData.reduce((acc, c) => acc + c.itemsPerTicket, 0) / count;
      const avgTicket = monthData.reduce((acc, c) => acc + c.averageTicket, 0) / count;

      return {
        name: month, // YYYY-MM
        Realizado: rev,
        Meta: target,
        'Percentual': target > 0 ? (rev / target) * 100 : 0,
        PA: parseFloat(avgPA.toFixed(2)),
        TicketMedio: parseFloat(avgTicket.toFixed(2))
      };
    });
  }, [activePerformanceData]);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzePerformance(currentMonthData, stores, 'ADMIN');
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportStatus('');
    }
  };

  // Helper to parse numbers that might come as strings with comma (PT-BR) or dots
  const parseRawNumber = (value: any): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
          const clean = value.replace(/\./g, '').replace(',', '.');
          return parseFloat(clean) || 0;
      }
      return 0;
  };

  // Helper to parse Excel dates or Month Names
  const parseExcelDateOrMonth = (value: any): string => {
      if (!value) return '';
      
      // Map Portuguese Months
      const ptMonths: {[key: string]: string} = {
          'JANEIRO': '01', 'FEVEREIRO': '02', 'MARÇO': '03', 'ABRIL': '04', 
          'MAIO': '05', 'JUNHO': '06', 'JULHO': '07', 'AGOSTO': '08', 
          'SETEMBRO': '09', 'OUTUBRO': '10', 'NOVEMBRO': '11', 'DEZEMBRO': '12'
      };

      if (typeof value === 'string') {
        const upper = value.toUpperCase().trim();
        // Check if it's a month name
        if (ptMonths[upper]) {
            const currentYear = new Date().getFullYear(); // Assume current year if only month name provided
            return `${currentYear}-${ptMonths[upper]}`;
        }
        // Check YYYY-MM
        if (/^\d{4}-\d{2}$/.test(value)) return value;
      }

      // If it's a serial number (Excel date)
      if (typeof value === 'number') {
          const date = new Date(Math.round((value - 25569) * 86400 * 1000));
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          return `${year}-${month}`;
      }
      
      return '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
              const result = reader.result as string;
              // Remove data:application/pdf;base64, prefix
              const base64 = result.split(',')[1];
              resolve(base64);
          };
          reader.onerror = error => reject(error);
      });
  };

  const handleImportProcess = async () => {
    if (!selectedFile) {
        alert("Por favor, selecione um arquivo.");
        return;
    }

    setIsProcessingFile(true);
    setImportStatus('Processando arquivo...');

    try {
        const importedDataItems: Partial<MonthlyPerformance>[] = [];
        let successCount = 0;
        let unknownStoreCount = 0;

        // --- PDF LOGIC ---
        if (selectedFile.type === 'application/pdf') {
             setImportStatus('Lendo PDF com IA... (Isso pode levar alguns segundos)');
             const base64 = await fileToBase64(selectedFile);
             
             try {
                const extractedData: ExtractedPDFData[] = await extractDataFromDocument(base64, selectedFile.type);
                
                if (!Array.isArray(extractedData)) {
                    throw new Error("Formato inválido retornado pela IA.");
                }

                extractedData.forEach(item => {
                    const storeNumber = item.storeNumber ? String(parseInt(String(item.storeNumber).replace(/\D/g, ''), 10)) : '';
                    
                    if (storeNumber) {
                        const store = stores.find(s => s.number === storeNumber);
                        
                        // If store doesn't exist yet, we still import it with a temporary ID
                        // This allows "Reconciliation" when the store is later added
                        const storeId = store ? store.id : `temp_num_${storeNumber}`;

                        const ticket = item.ticket || 0;
                        const percentMeta = item.percentMeta || 0;
                        
                        // Simulation fallback for revenue (same as Excel logic)
                        const revenueActual = ticket * 1000; 
                        
                        importedDataItems.push({
                            storeId: storeId,
                            month: item.month || new Date().toISOString().slice(0, 7),
                            itemsPerTicket: item.pa,
                            unitPriceAverage: item.pu,
                            averageTicket: ticket,
                            percentMeta: percentMeta,
                            revenueActual: Number(revenueActual.toFixed(2)),
                            // revenueTarget will be calculated/merged later
                            delinquencyRate: 1.5,
                            trend: percentMeta >= 100 ? 'up' : percentMeta >= 90 ? 'stable' : 'down',
                            correctedDailyGoal: 0
                        });
                        
                        if (store) successCount++;
                        else unknownStoreCount++;
                    }
                });

             } catch (err) {
                 console.error(err);
                 setImportStatus('Erro na leitura do PDF. Tente novamente ou use Excel.');
                 setIsProcessingFile(false);
                 return;
             }

        } 
        // --- EXCEL LOGIC ---
        else {
            setImportStatus('Lendo Excel...');
            const arrayBuffer = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            // DYNAMIC START ROW DETECTION
            // Try to find the header row containing "Loja" in the first 20 rows
            let startRowIndex = 5; // Fallback to old format (line 6)
            let detectedGlobalMonth = '';

            for (let r = 0; r < 20 && r < jsonData.length; r++) {
                const firstCell = String(jsonData[r][0] || '').toLowerCase();
                // Check if this row is the header
                if (firstCell.includes('loja')) {
                    startRowIndex = r + 1; // Data starts on next row
                    
                    // Also check if Month is in this header row or previous row (legacy support)
                    if (r > 0) {
                        const prevRowVal = parseExcelDateOrMonth(jsonData[r-1][14]);
                        if (prevRowVal) detectedGlobalMonth = prevRowVal;
                    }
                    break;
                }
            }

            // If global month not found in header area, try scanning first few rows broadly
            if (!detectedGlobalMonth) {
                for(let r=0; r<10 && r<jsonData.length; r++) {
                    for(let c=0; c<jsonData[r].length; c++) {
                         const val = jsonData[r][c];
                         const parsed = parseExcelDateOrMonth(val);
                         if (parsed && parsed.length === 7) { // YYYY-MM
                             detectedGlobalMonth = parsed;
                             break;
                         }
                    }
                    if (detectedGlobalMonth) break;
                }
            }

            for (let i = startRowIndex; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;
                if (String(row[0]).toLowerCase().includes('total')) continue;
                if (!row[0]) continue;

                const rawStoreNumber = row[0];
                const storeNumber = rawStoreNumber ? String(parseInt(String(rawStoreNumber).replace(/\D/g, ''), 10)) : '';

                const pa = parseRawNumber(row[3]);
                const pu = parseRawNumber(row[4]);
                const ticket = parseRawNumber(row[5]);
                let percentMeta = parseRawNumber(row[8]);
                if (percentMeta < 2 && percentMeta > 0) percentMeta = percentMeta * 100;

                // Priority: Check specific column O (index 14) for month on this row
                let monthRef = parseExcelDateOrMonth(row[14]); 
                if (!monthRef && detectedGlobalMonth) {
                    monthRef = detectedGlobalMonth;
                }

                if (storeNumber && monthRef) {
                    const store = stores.find(s => s.number === storeNumber);
                    
                    // If store doesn't exist yet, we still import it with a temporary ID
                    // This allows "Reconciliation" when the store is later added
                    const storeId = store ? store.id : `temp_num_${storeNumber}`;

                    const qtdeVendas = parseRawNumber(row[1]);
                    let revenueActual = 0;
                    if (qtdeVendas > 0 && ticket > 0) {
                        revenueActual = qtdeVendas * ticket;
                    } else {
                        revenueActual = ticket * 1000; 
                    }

                    importedDataItems.push({
                        storeId: storeId,
                        month: monthRef,
                        itemsPerTicket: pa,
                        unitPriceAverage: pu,
                        averageTicket: ticket,
                        percentMeta: percentMeta,
                        revenueActual: Number(revenueActual.toFixed(2)),
                        // revenueTarget not set here, will be merged
                        delinquencyRate: 1.5, // Mocked as not in Excel
                        trend: percentMeta >= 100 ? 'up' : percentMeta >= 90 ? 'stable' : 'down',
                        correctedDailyGoal: 0
                    });

                    if (store) successCount++;
                    else unknownStoreCount++;
                }
            }
        }

        if (importedDataItems.length > 0) {
            // MERGE LOGIC: Combine imported actuals with existing targets
            const updatedPerformanceData = [...performanceData];

            importedDataItems.forEach(newItem => {
                const existingIndex = updatedPerformanceData.findIndex(p => p.storeId === newItem.storeId && p.month === newItem.month);
                
                if (existingIndex >= 0) {
                    const existingRecord = updatedPerformanceData[existingIndex];
                    
                    // If we have a manually set target, use it to recalculate percentage
                    let finalTarget = existingRecord.revenueTarget;
                    // If Excel has percentMeta, and we know revenueActual, we can back-calculate target if needed, 
                    // BUT priority goes to manual target if it was set > 0.
                    
                    if (finalTarget === 0 && newItem.percentMeta && newItem.percentMeta > 0 && newItem.revenueActual) {
                         finalTarget = newItem.revenueActual / (newItem.percentMeta / 100);
                    }

                    updatedPerformanceData[existingIndex] = {
                        ...existingRecord,
                        ...newItem,
                        revenueTarget: finalTarget, // Keep existing target
                        // Preserve Operational Targets
                        paTarget: existingRecord.paTarget,
                        ticketTarget: existingRecord.ticketTarget,
                        puTarget: existingRecord.puTarget,
                        delinquencyTarget: existingRecord.delinquencyTarget,
                    } as MonthlyPerformance;
                } else {
                     // New Record (calculate target from percent if possible)
                     let derivedTarget = 0;
                     if (newItem.percentMeta && newItem.percentMeta > 0 && newItem.revenueActual) {
                         derivedTarget = Number((newItem.revenueActual / (newItem.percentMeta / 100)).toFixed(2));
                     }

                     updatedPerformanceData.push({
                         ...newItem,
                         revenueTarget: derivedTarget,
                         paTarget: 0,
                         ticketTarget: 0,
                         puTarget: 0,
                         delinquencyTarget: 0
                     } as MonthlyPerformance);
                }
            });
            
            onImportData(updatedPerformanceData);
            
            const newMonth = importedDataItems[0].month;
            if (newMonth) setSelectedMonth(newMonth);

            let msg = `${successCount} registros vinculados e importados!`;
            if (unknownStoreCount > 0) {
                msg += `\n(${unknownStoreCount} registros de lojas desconhecidas foram salvos e serão vinculados automaticamente quando a loja for cadastrada).`;
            }
            alert(msg);
            setShowImportModal(false);
            setSelectedFile(null);
            setImportStatus('');
        } else {
            setImportStatus(`Nenhum dado válido encontrado. Verifique o mês no arquivo.`);
        }

    } catch (error) {
        console.error("Import Error:", error);
        setImportStatus('Erro ao processar arquivo.');
    } finally {
        setIsProcessingFile(false);
    }
  };

  const getMetricConfig = () => {
      switch(evolutionMetric) {
          case 'revenue': return { dataKey: 'Realizado', label: 'Faturamento', color: '#1e40af', formatter: formatCurrency };
          case 'pa': return { dataKey: 'PA', label: 'P.A. Médio', color: '#3b82f6', formatter: (v: number) => v.toFixed(2) };
          case 'ticket': return { dataKey: 'TicketMedio', label: 'Ticket Médio', color: '#dc2626', formatter: formatCurrency };
      }
  };

  const metricConfig = getMetricConfig();

  return (
    <div className="p-8 space-y-8">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Visão Geral da Rede</h2>
          <p className="text-gray-500">Acompanhamento consolidado e evolução mensal.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
            {/* Month Selector Component - Refactored to match GoalRegistration style */}
            <div className="flex items-center gap-4 bg-white p-2 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-2 px-2 border-r border-gray-100">
                    <Calendar size={20} className="text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700 hidden md:inline">Mês de Referência:</span>
                </div>
                
                <div className="flex gap-2">
                    <select 
                        value={parseInt(selectedMonth.split('-')[1]) || ''}
                        onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))}
                        className="bg-gray-50 border-gray-200 border rounded-md px-3 py-1.5 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none font-medium cursor-pointer text-sm"
                    >
                        {MONTHS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <select 
                        value={parseInt(selectedMonth.split('-')[0]) || ''}
                        onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))}
                        className="bg-gray-50 border-gray-200 border rounded-md px-3 py-1.5 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none font-medium cursor-pointer text-sm"
                    >
                        {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            <button 
                onClick={handleAIAnalysis}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-700 to-blue-900 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all"
                disabled={isAnalyzing}
            >
                <Sparkles size={18} />
                {isAnalyzing ? 'Analisando...' : 'Insights IA'}
            </button>
            <button 
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
                <FileSpreadsheet size={18} className="text-green-600"/>
                Importar Dados
            </button>
        </div>
      </div>

      {/* KPI Cards (Filtered by Selected Month) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
              <DollarSign size={24} />
            </div>
            <span className={`text-sm font-semibold px-2 py-1 rounded-full ${globalPercent >= 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {globalPercent.toFixed(1)}% Meta
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Faturamento ({formatMonthName(selectedMonth)})</h3>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
          
          {/* Comparative Indicators */}
          <div className="mt-3 flex gap-4 text-[10px] font-semibold border-t border-gray-50 pt-2">
              <div className="flex items-center gap-1">
                  {comparisons.yoyPercent >= 0 ? <ArrowUp size={12} className="text-green-500"/> : <ArrowDown size={12} className="text-red-500"/>}
                  <span className={comparisons.yoyPercent >= 0 ? 'text-green-600' : 'text-red-600'}>{Math.abs(comparisons.yoyPercent).toFixed(1)}% vs Ano Ant.</span>
              </div>
              <div className="flex items-center gap-1">
                  {comparisons.momPercent >= 0 ? <ArrowUp size={12} className="text-green-500"/> : <ArrowDown size={12} className="text-red-500"/>}
                  <span className={comparisons.momPercent >= 0 ? 'text-green-600' : 'text-red-600'}>{Math.abs(comparisons.momPercent).toFixed(1)}% vs Mês Ant.</span>
              </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-500 rounded-lg">
              <TrendingUp size={24} />
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Meta Total ({formatMonthName(selectedMonth)})</h3>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalTarget)}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-gray-50 text-gray-600 rounded-lg">
              <Users size={24} />
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Lojas Ativas</h3>
          <p className="text-2xl font-bold text-gray-900">{currentMonthData.length}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-lg">
              <TrendingDown size={24} />
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Inadimplência Média</h3>
          <p className="text-2xl font-bold text-gray-900">
            {(currentMonthData.reduce((acc, c) => acc + c.delinquencyRate, 0) / (currentMonthData.length || 1)).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Evolution Chart (Full History) with Tabs */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Calendar size={20} className="text-blue-700"/>
                Evolução Mensal da Rede (Total)
              </h3>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setEvolutionMetric('revenue')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${evolutionMetric === 'revenue' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Faturamento
                  </button>
                  <button 
                    onClick={() => setEvolutionMetric('pa')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${evolutionMetric === 'pa' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    P.A.
                  </button>
                  <button 
                    onClick={() => setEvolutionMetric('ticket')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${evolutionMetric === 'ticket' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Ticket Médio
                  </button>
              </div>
          </div>
          
          <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolutionData}>
                      <defs>
                        <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={metricConfig.color} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={metricConfig.color} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => typeof val === 'number' && val > 1000 ? `${val/1000}k` : `${val}`} />
                      <Tooltip formatter={(value: number) => metricConfig.formatter(value)} labelStyle={{ color: '#374151' }} />
                      <Legend />
                      <Area 
                        name={metricConfig.label}
                        type="monotone" 
                        dataKey={metricConfig.dataKey} 
                        stroke={metricConfig.color} 
                        fillOpacity={1} 
                        fill="url(#colorMetric)" 
                        strokeWidth={3} 
                        animationDuration={1000}
                      />
                  </AreaChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* AI Analysis Section */}
      {analysis && (
        <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-xl border border-blue-100">
            <h3 className="flex items-center gap-2 text-blue-800 font-bold mb-3">
                <Sparkles size={20} /> Análise Inteligente ({formatMonthName(selectedMonth)})
            </h3>
            <div className="prose prose-blue text-blue-900/80 text-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
        </div>
      )}

      {/* Charts Section (Specific Month) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
                <BarChart2 size={20} className="text-gray-400"/> Comparativo de Faturamento - {formatMonthName(selectedMonth)}
            </h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankingData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="Meta" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Realizado" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp size={20} className="text-gray-400"/> Ranking de Atingimento - {formatMonthName(selectedMonth)}
            </h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankingData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} fontSize={12} />
                        <Tooltip formatter={(value: number) => value.toFixed(1) + '%'} />
                        <Bar dataKey="Atingimento" radius={[0, 4, 4, 0]} barSize={20}>
                            {rankingData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.Atingimento >= 100 ? '#10b981' : '#ef4444'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

       {/* Detailed Table */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-800">Detalhamento por Loja ({formatMonthName(selectedMonth)})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-900 font-semibold">
                    <tr>
                        <th className="p-4">Loja</th>
                        <th className="p-4">Meta</th>
                        <th className="p-4">Realizado</th>
                        <th className="p-4">%</th>
                        <th className="p-4">P.A.</th>
                        <th className="p-4">P.U.</th>
                        <th className="p-4">Ticket Médio</th>
                        <th className="p-4">Trend</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {currentMonthData.map((data) => {
                         const store = stores.find(s => s.id === data.storeId);
                         return (
                            <tr key={data.storeId} className="hover:bg-gray-50">
                                <td className="p-4 font-medium text-gray-900">{store?.name}</td>
                                <td className="p-4">{formatCurrency(data.revenueTarget)}</td>
                                <td className="p-4">{formatCurrency(data.revenueActual)}</td>
                                <td className={`p-4 font-bold ${data.percentMeta >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                                    {data.percentMeta.toFixed(1)}%
                                </td>
                                <td className="p-4">{data.itemsPerTicket.toFixed(2)}</td>
                                <td className="p-4">{data.unitPriceAverage.toFixed(2)}</td>
                                <td className="p-4">{formatCurrency(data.averageTicket)}</td>
                                <td className="p-4">
                                    {data.trend === 'up' ? <TrendingUp size={16} className="text-green-500" /> : 
                                     data.trend === 'down' ? <TrendingDown size={16} className="text-red-500" /> : 
                                     <span className="text-gray-400">-</span>}
                                </td>
                            </tr>
                         );
                    })}
                </tbody>
            </table>
          </div>
       </div>

       {/* Import Modal */}
       {showImportModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-blue-900">Importar Dados</h3>
                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                    <TrendingDown size={20} className="rotate-45" />
                </button>
             </div>
             <p className="text-gray-500 mb-6 text-sm">
               Selecione um arquivo <strong>.xlsx, .xls ou .pdf</strong>.
               <br/>
               <span className="text-xs mt-2 block">
                   <strong>O sistema lerá automaticamente a partir do cabeçalho.</strong><br/>
                   Colunas: A (Loja), D (P.A), E (P.U), F (Ticket), I (% Meta), O (Mês).
                   <br/>
                   <span className="text-blue-600 font-semibold flex items-center gap-1 mt-1">
                      <Sparkles size={12}/> Suporte a PDF via IA disponível.
                   </span>
                   <span className="text-gray-500 block mt-1">
                      Dados de lojas não cadastradas serão salvos como "Pendentes" e vinculados automaticamente quando a loja for criada.
                   </span>
               </span>
             </p>
             
             {/* Hidden Input for File Selection */}
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls, .pdf"
                onChange={handleFileChange}
             />

             <div 
                onClick={() => !isProcessingFile && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center mb-6 cursor-pointer transition-colors group ${
                    selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-gray-50'
                } ${isProcessingFile ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
                {selectedFile ? (
                    <>
                        <CheckCircle size={32} className="text-green-500 mb-2" />
                        <span className="text-sm font-bold text-green-700 break-all text-center">{selectedFile.name}</span>
                        <span className="text-xs text-green-600 mt-1">Clique para alterar</span>
                    </>
                ) : (
                    <>
                        <Upload size={32} className="text-gray-400 mb-2 group-hover:text-blue-500 transition-colors" />
                        <span className="text-sm text-gray-500 group-hover:text-gray-700">Clique para selecionar arquivo</span>
                        <span className="text-xs text-gray-400 mt-1">Excel ou PDF</span>
                    </>
                )}
             </div>

             {importStatus && (
                 <div className="mb-4 text-center text-sm font-medium text-blue-600 flex items-center justify-center gap-2">
                     {isProcessingFile && <Loader2 size={16} className="animate-spin"/>}
                     {importStatus}
                 </div>
             )}

             <div className="flex gap-3">
               <button 
                 onClick={() => {
                     setShowImportModal(false);
                     setSelectedFile(null);
                     setImportStatus('');
                 }}
                 disabled={isProcessingFile}
                 className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
               >
                 Cancelar
               </button>
               <button 
                 onClick={handleImportProcess}
                 disabled={!selectedFile || isProcessingFile}
                 className={`flex-1 px-4 py-2 rounded-lg font-medium shadow-md transition-all ${
                     !selectedFile || isProcessingFile
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-700 text-white hover:bg-blue-800 hover:shadow-lg'
                 }`}
               >
                 Processar
               </button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
};

export default DashboardAdmin;