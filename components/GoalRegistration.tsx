
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { Save, Calendar, Target, AlertCircle, DollarSign, ShoppingBag, CreditCard, Tag, AlertTriangle, X, TrendingUp, TrendingDown, Activity, Upload, FileSpreadsheet, Loader2, CheckCircle, Package } from 'lucide-react';
import { formatCurrency, formatPercent } from '../constants';
import * as XLSX from 'xlsx';

interface GoalRegistrationProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onUpdateData: (data: MonthlyPerformance[]) => void;
}

const GoalRegistration: React.FC<GoalRegistrationProps> = ({ stores, performanceData, onUpdateData }) => {
  // Date Handling: Split Year and Month for better UI
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(currentMonth); // 1-12
  
  // Computed YYYY-MM string
  const selectedMonthStr = `${selectedYear}-${String(selectedMonthIndex).padStart(2, '0')}`;

  // Local state to hold form values before saving
  const [formData, setFormData] = useState<Record<string, Partial<MonthlyPerformance>>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  
  // Confirmation Modal State
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  // Constants for Dropdowns
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i); // Last year + next 3
  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  // Filter active stores and sort by number
  const activeStores = stores
    .filter(s => s.status === 'active')
    .sort((a, b) => parseInt(a.number) - parseInt(b.number));

  // Load existing data when date changes
  useEffect(() => {
    const newFormData: Record<string, Partial<MonthlyPerformance>> = {};
    
    activeStores.forEach(store => {
      const existing = performanceData.find(p => p.storeId === store.id && p.month === selectedMonthStr);
      if (existing) {
        newFormData[store.id] = { ...existing };
      } else {
        // Initialize with zeros if no data exists
        newFormData[store.id] = {
          revenueTarget: 0,
          itemsTarget: 0, // NEW: Init Items Goal
          paTarget: 0,
          ticketTarget: 0,
          puTarget: 0,
          delinquencyTarget: 2.0 // Default healthy max
        };
      }
    });
    setFormData(newFormData);
    setSaveStatus('idle');
  }, [selectedMonthStr, performanceData, stores]); 

  const handleInputChange = (storeId: string, field: keyof MonthlyPerformance, value: string) => {
    const cleanValue = value.replace(',', '.');
    const numValue = parseFloat(cleanValue);

    setFormData(prev => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        [field]: isNaN(numValue) ? 0 : numValue
      }
    }));
    setSaveStatus('idle');
  };

  const initiateSave = () => {
      // Check if ANY data exists for this month in the permanent database (not local form) with targets set
      const hasExistingTargets = performanceData.some(p => 
        p.month === selectedMonthStr && 
        (p.revenueTarget > 0 || (p.itemsTarget || 0) > 0)
      );

      if (hasExistingTargets) {
          setShowOverwriteModal(true);
      } else {
          executeSave();
      }
  };

  const executeSave = () => {
    setSaveStatus('saving');
    setShowOverwriteModal(false);
    
    // Clone the master data array
    let updatedPerformanceData = [...performanceData];

    Object.entries(formData).forEach(([storeId, val]) => {
      // Cast value to Partial<MonthlyPerformance> to avoid 'unknown' type errors
      const data = val as Partial<MonthlyPerformance>;
      
      const existingIndex = updatedPerformanceData.findIndex(p => p.storeId === storeId && p.month === selectedMonthStr);

      if (existingIndex >= 0) {
        // MERGE: Update existing record with new targets
        const currentRecord = updatedPerformanceData[existingIndex];
        updatedPerformanceData[existingIndex] = {
          ...currentRecord,
          revenueTarget: data.revenueTarget || 0,
          itemsTarget: data.itemsTarget || 0, // Save Items Goal
          paTarget: data.paTarget || 0,
          ticketTarget: data.ticketTarget || 0,
          puTarget: data.puTarget || 0,
          delinquencyTarget: data.delinquencyTarget || 0,
          // Recalculate percentMeta based on new target if actual revenue exists
          percentMeta: (data.revenueTarget || 0) > 0 
            ? ((currentRecord.revenueActual || 0) / (data.revenueTarget || 1)) * 100 
            : 0
        };
      } else {
        // CREATE: New record for this month
        updatedPerformanceData.push({
          storeId,
          month: selectedMonthStr,
          revenueTarget: data.revenueTarget || 0,
          revenueActual: 0,
          itemsTarget: data.itemsTarget || 0, // Save Items Goal
          itemsActual: 0,
          percentMeta: 0,
          itemsPerTicket: 0,
          unitPriceAverage: 0,
          averageTicket: 0,
          delinquencyRate: 0,
          paTarget: data.paTarget || 0,
          ticketTarget: data.ticketTarget || 0,
          puTarget: data.puTarget || 0,
          delinquencyTarget: data.delinquencyTarget || 0,
          trend: 'stable',
          correctedDailyGoal: (data.revenueTarget || 0) / 30
        });
      }
    });

    onUpdateData(updatedPerformanceData);
    
    setTimeout(() => {
        setSaveStatus('success');
        alert("Metas salvas com sucesso!");
    }, 500);
  };

  // --- IMPORT LOGIC ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportStatus('');
    }
  };

  const parseRawNumber = (value: any): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
          // Remove % and spaces
          let clean = value.replace('%', '').trim();
          if (!clean || clean === '-') return 0;
          
          // Logic for PT-BR vs US formats
          if (clean.includes(',') && clean.includes('.')) {
              // 1.200,50 -> 1200.50
              clean = clean.replace(/\./g, '').replace(',', '.');
          } else if (clean.includes(',')) {
              // 1200,50 -> 1200.50
              clean = clean.replace(',', '.');
          }
          // if just dots (2.5), parseFloat handles it as 2.5
          
          return parseFloat(clean) || 0;
      }
      return 0;
  };

  const handleProcessImport = async () => {
      if (!selectedFile) return;
      setIsProcessing(true);
      setImportStatus('Lendo planilha...');

      try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer);
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

          // 1. Locate Header Row (for reference only, we start reading after it)
          let startRowIndex = -1;
          for (let r = 0; r < 30 && r < jsonData.length; r++) {
              const rowStr = jsonData[r]?.join(' ').toLowerCase();
              if (rowStr.includes('loja')) {
                  startRowIndex = r + 1;
                  break;
              }
          }

          if (startRowIndex === -1) throw new Error("Cabeçalho não encontrado. A planilha deve ter uma coluna 'Loja'.");

          // 2. Process Data using Strict Column Indices
          // Col 1 (A) = Index 0 = Loja
          // Col 3 (C) = Index 2 = Itens
          // Col 4 (D) = Index 3 = P.A
          // Col 5 (E) = Index 4 = P.U
          // Col 6 (F) = Index 5 = Ticket
          // Col 7 (G) = Index 6 = Meta
          // Col 8 (H) = Index 7 = Realizado (Assumed)
          // Col 15 (O) = Index 14 = Inadimplência
          // Col 16 (P) = Index 15 = Fallback Inadimplência

          const importedData: Partial<MonthlyPerformance>[] = [];
          let successCount = 0;

          for (let i = startRowIndex; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.length === 0) continue;
              
              const rawStoreNumber = String(row[0] || ''); // Col 1
              if (rawStoreNumber.toLowerCase().includes('total')) continue;

              const storeNumber = rawStoreNumber.replace(/\D/g, '');
              const store = stores.find(s => s.number === String(parseInt(storeNumber || '0')));

              if (store) {
                  const salesQty = parseRawNumber(row[2]); // Col 3
                  const pa = parseRawNumber(row[3]);       // Col 4
                  const pu = parseRawNumber(row[4]);       // Col 5
                  const ticket = parseRawNumber(row[5]);   // Col 6
                  const meta = parseRawNumber(row[6]);     // Col 7 (META)
                  const revenueActual = parseRawNumber(row[7]); // Col 8 (REALIZADO)
                  
                  // Inadimplência: Check Col 15 (14), then fallback to Col 16 (15)
                  let delinquencyRate = parseRawNumber(row[14]); 
                  if (delinquencyRate === 0 && row[15] !== undefined) {
                      delinquencyRate = parseRawNumber(row[15]);
                  }

                  if (delinquencyRate > 0 && delinquencyRate < 1) {
                      delinquencyRate = delinquencyRate * 100;
                  }

                  importedData.push({
                      storeId: store.id,
                      month: selectedMonthStr, 
                      itemsPerTicket: pa,
                      unitPriceAverage: pu,
                      averageTicket: ticket,
                      revenueTarget: meta, // Importing Target as well
                      revenueActual: Number(revenueActual.toFixed(2)),
                      itemsActual: salesQty, 
                      delinquencyRate: Number(delinquencyRate.toFixed(2))
                  });
                  successCount++;
              }
          }

          if (successCount > 0) {
              // MERGE WITH EXISTING STATE
              const updatedPerformanceData = [...performanceData];
              
              importedData.forEach(item => {
                  const existingIndex = updatedPerformanceData.findIndex(p => p.storeId === item.storeId && p.month === selectedMonthStr);
                  
                  // Calc percent if missing
                  const percent = (item.revenueTarget && item.revenueTarget > 0) 
                        ? ((item.revenueActual || 0) / item.revenueTarget) * 100 
                        : 0;

                  if (existingIndex >= 0) {
                      // Update existing record
                      updatedPerformanceData[existingIndex] = {
                          ...updatedPerformanceData[existingIndex],
                          itemsPerTicket: item.itemsPerTicket!,
                          unitPriceAverage: item.unitPriceAverage!,
                          averageTicket: item.averageTicket!,
                          revenueTarget: item.revenueTarget!, // Update target from file
                          revenueActual: item.revenueActual!,
                          itemsActual: item.itemsActual!,
                          delinquencyRate: item.delinquencyRate!,
                          percentMeta: percent
                      };
                  } else {
                      // New Record
                      updatedPerformanceData.push({
                          storeId: item.storeId!,
                          month: selectedMonthStr,
                          revenueTarget: item.revenueTarget || 0,
                          itemsTarget: 0, 
                          paTarget: 0,
                          ticketTarget: 0,
                          puTarget: 0,
                          delinquencyTarget: 0,
                          itemsPerTicket: item.itemsPerTicket!,
                          unitPriceAverage: item.unitPriceAverage!,
                          averageTicket: item.averageTicket!,
                          revenueActual: item.revenueActual!,
                          itemsActual: item.itemsActual!, 
                          delinquencyRate: item.delinquencyRate!,
                          percentMeta: percent,
                          trend: 'stable',
                          correctedDailyGoal: 0
                      });
                  }
              });

              onUpdateData(updatedPerformanceData);
              alert(`${successCount} lojas atualizadas! Metas e Realizados importados.`);
              setShowImportModal(false);
              setSelectedFile(null);
          } else {
              throw new Error("Nenhuma loja correspondente encontrada na planilha.");
          }

      } catch (err: any) {
          console.error(err);
          setImportStatus(`Erro: ${err.message}`);
      } finally {
          setIsProcessing(false);
      }
  };

  // Calculate Totals for Header
  const totals = useMemo(() => {
      let totalTarget = 0;
      let totalActual = 0;
      Object.values(formData).forEach((d: Partial<MonthlyPerformance>) => {
          totalTarget += d.revenueTarget || 0;
          totalActual += d.revenueActual || 0;
      });
      return { totalTarget, totalActual, percent: totalTarget > 0 ? (totalActual/totalTarget)*100 : 0 };
  }, [formData]);

  // Helper for performance comparison color
  const getPerfColor = (actual: number, target: number, inverse: boolean = false) => {
      if (!target || target === 0) return 'text-gray-400';
      if (!actual || actual === 0) return 'text-gray-400';
      
      const isGood = inverse ? actual <= target : actual >= target;
      return isGood ? 'text-green-600' : 'text-red-500';
  };

  return (
    <div className="p-8 max-w-[1800px] mx-auto space-y-8 relative">
      <style>{`
        /* Remove arrows/spinners from number inputs */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Target className="text-red-600" size={32} />
            Cadastro e Análise de Metas
          </h2>
          <p className="text-gray-500 mt-1">Defina objetivos e compare com o realizado importado.</p>
        </div>

        <div className="flex items-center gap-3">
            <button 
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 bg-white text-green-700 border border-green-200 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors shadow-sm font-bold text-sm"
            >
                <FileSpreadsheet size={18} /> Importar Realizado
            </button>

            <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 border-r border-gray-200 pr-4 pl-2">
                    <Calendar className="text-blue-600" size={20} />
                    <span className="text-sm font-semibold text-gray-700 hidden md:inline">Referência:</span>
                </div>
                
                <div className="flex gap-2">
                    <select 
                        value={selectedMonthIndex}
                        onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
                        className="bg-gray-50 border-gray-200 border rounded-lg px-3 py-1.5 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none font-medium cursor-pointer"
                    >
                        {months.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <select 
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-gray-50 border-gray-200 border rounded-lg px-3 py-1.5 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none font-medium cursor-pointer"
                    >
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
      </div>

      {/* SUMMARY BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Meta Total da Rede</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalTarget)}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-full text-gray-500"><Target size={20}/></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Realizado Importado</p>
                  <p className={`text-2xl font-bold ${totals.totalActual > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                      {formatCurrency(totals.totalActual)}
                  </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full text-blue-600"><Activity size={20}/></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Atingimento Global</p>
                  <p className={`text-2xl font-bold ${totals.percent >= 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {totals.percent.toFixed(1)}%
                  </p>
              </div>
              <div className={`p-3 rounded-full ${totals.percent >= 100 ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                  {totals.percent >= 100 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
              </div>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-320px)]">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center sticky top-0 z-20">
            <div className="flex gap-4 text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> Campos Editáveis (Metas)</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-400 rounded-full"></div> Dados Importados (Realizado)</span>
            </div>
            <button 
                onClick={initiateSave}
                disabled={saveStatus === 'saving'}
                className="flex items-center gap-2 bg-blue-700 text-white px-6 py-2.5 rounded-lg hover:bg-blue-800 shadow-md transition-all font-bold disabled:opacity-70"
            >
                <Save size={18} />
                {saveStatus === 'saving' ? 'Salvando...' : 'Salvar Todas as Metas'}
            </button>
        </div>

        <div className="overflow-auto flex-1 no-scrollbar">
            <table className="w-full text-left border-collapse relative">
                <thead className="bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="p-4 bg-gray-100 w-52 border-r border-gray-200">Loja</th>
                        <th className="p-4 bg-gray-100 text-center text-blue-800 border-r border-gray-200 min-w-[160px]">
                            Venda (R$)
                        </th>
                        <th className="p-4 bg-gray-100 text-center text-blue-800 border-r border-gray-200 min-w-[120px]">
                            P.A.
                        </th>
                        <th className="p-4 bg-gray-100 text-center text-blue-800 border-r border-gray-200 min-w-[140px]">
                            P.U. (R$)
                        </th>
                        <th className="p-4 bg-gray-100 text-center text-blue-800 border-r border-gray-200 min-w-[140px]">
                            Ticket (R$)
                        </th>
                        <th className="p-4 bg-gray-100 text-center text-blue-800 border-r border-gray-200 min-w-[120px]">
                            Qtde Itens
                        </th>
                        <th className="p-4 bg-gray-100 text-center text-red-700 border-r border-gray-200 min-w-[120px]">
                            Inadimp. (%)
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {activeStores.map(store => {
                        const data = formData[store.id] || {};
                        // Mock data import check (in real app, 0 implies no data)
                        const hasRealized = (data.revenueActual || 0) > 0;

                        return (
                            <tr key={store.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="p-4 border-r border-gray-100 bg-white group-hover:bg-blue-50/30">
                                    <div className="font-bold text-gray-800 text-base">{store.number} - {store.name}</div>
                                    <div className="text-xs text-gray-500">{store.city}</div>
                                    {hasRealized && (
                                        <div className="mt-2 inline-block px-2 py-0.5 rounded bg-green-50 text-[10px] font-bold text-green-700 border border-green-100">
                                            Dados Importados
                                        </div>
                                    )}
                                </td>

                                {/* Meta Venda + Analysis */}
                                <td className="p-3 border-r border-gray-100 bg-white group-hover:bg-blue-50/30 align-top">
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={data.revenueTarget || ''}
                                                onChange={(e) => handleInputChange(store.id, 'revenueTarget', e.target.value)}
                                                className="w-full pl-8 pr-3 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold text-gray-800"
                                                placeholder="Meta"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] px-1 bg-gray-50 rounded py-1 border border-gray-100">
                                            <span className="text-gray-500">Real:</span>
                                            <span className={`font-bold ${getPerfColor(data.revenueActual || 0, data.revenueTarget || 0)}`}>
                                                {formatCurrency(data.revenueActual || 0)}
                                            </span>
                                        </div>
                                        {(data.revenueTarget || 0) > 0 && (
                                            <div className="text-[9px] text-right text-gray-400">
                                                {((data.revenueActual || 0) / (data.revenueTarget || 1) * 100).toFixed(1)}% atingido
                                            </div>
                                        )}
                                    </div>
                                </td>

                                {/* Meta PA + Analysis */}
                                <td className="p-3 border-r border-gray-100 bg-white group-hover:bg-blue-50/30 align-top">
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400"><ShoppingBag size={14}/></span>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={data.paTarget || ''}
                                                onChange={(e) => handleInputChange(store.id, 'paTarget', e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium text-gray-700"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] px-1 bg-gray-50 rounded py-1 border border-gray-100">
                                            <span className="text-gray-500">Real:</span>
                                            <span className={`font-bold ${getPerfColor(data.itemsPerTicket || 0, data.paTarget || 0)}`}>
                                                {(data.itemsPerTicket || 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </td>

                                {/* Meta PU + Analysis */}
                                <td className="p-3 border-r border-gray-100 bg-white group-hover:bg-blue-50/30 align-top">
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={data.puTarget || ''}
                                                onChange={(e) => handleInputChange(store.id, 'puTarget', e.target.value)}
                                                className="w-full pl-8 pr-3 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium text-gray-700"
                                                placeholder="0,00"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] px-1 bg-gray-50 rounded py-1 border border-gray-100">
                                            <span className="text-gray-500">Real:</span>
                                            <span className={`font-bold ${getPerfColor(data.unitPriceAverage || 0, data.puTarget || 0)}`}>
                                                {formatCurrency(data.unitPriceAverage || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </td>

                                {/* Meta Ticket + Analysis */}
                                <td className="p-3 border-r border-gray-100 bg-white group-hover:bg-blue-50/30 align-top">
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={data.ticketTarget || ''}
                                                onChange={(e) => handleInputChange(store.id, 'ticketTarget', e.target.value)}
                                                className="w-full pl-8 pr-3 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium text-gray-700"
                                                placeholder="0,00"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] px-1 bg-gray-50 rounded py-1 border border-gray-100">
                                            <span className="text-gray-500">Real:</span>
                                            <span className={`font-bold ${getPerfColor(data.averageTicket || 0, data.ticketTarget || 0)}`}>
                                                {formatCurrency(data.averageTicket || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </td>

                                {/* Meta Items (Reordered) */}
                                <td className="p-3 border-r border-gray-100 bg-white group-hover:bg-blue-50/30 align-top">
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400"><Package size={14}/></span>
                                            <input 
                                                type="number" 
                                                value={data.itemsTarget || ''}
                                                onChange={(e) => handleInputChange(store.id, 'itemsTarget', e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium text-gray-700"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] px-1 bg-gray-50 rounded py-1 border border-gray-100">
                                            <span className="text-gray-500">Real:</span>
                                            <span className={`font-bold ${getPerfColor(data.itemsActual || 0, data.itemsTarget || 0)}`}>
                                                {data.itemsActual || 0}
                                            </span>
                                        </div>
                                    </div>
                                </td>

                                {/* Meta Inadimplência + Analysis (Inverse Logic) */}
                                <td className="p-3 border-r border-gray-100 bg-white group-hover:bg-blue-50/30 align-top">
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400"><AlertCircle size={14}/></span>
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                value={data.delinquencyTarget || ''}
                                                onChange={(e) => handleInputChange(store.id, 'delinquencyTarget', e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-white border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-right font-medium text-red-700"
                                                placeholder="0.0"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] px-1 bg-gray-50 rounded py-1 border border-gray-100">
                                            <span className="text-gray-500">Real:</span>
                                            {/* Inverse: Lower is better */}
                                            <span className={`font-bold ${getPerfColor(data.delinquencyRate || 0, data.delinquencyTarget || 0, true)}`}>
                                                {(data.delinquencyRate || 0).toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        <div className="p-3 bg-gray-50 border-t border-gray-200 text-center text-xs text-gray-400">
            Dica: Valores importados aparecem abaixo do campo de meta. Cores indicam desempenho (Verde = Meta Batida/Bom, Vermelho = Atenção).
        </div>
      </div>

      {/* OVERWRITE CONFIRMATION MODAL */}
      {showOverwriteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border-t-4 border-yellow-500">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={32} className="text-yellow-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Metas Já Cadastradas</h3>
                    <p className="text-gray-600 mb-6 text-sm">
                        Já existem metas cadastradas para <strong>{months[selectedMonthIndex-1].label}/{selectedYear}</strong>.
                        <br/><br/>
                        Deseja <strong>substituir</strong> as metas existentes pelos valores informados na tela agora?
                    </p>
                    
                    <div className="flex gap-3">
                         <button 
                            onClick={() => setShowOverwriteModal(false)}
                            className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={executeSave}
                            className="flex-1 px-4 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-bold shadow-md transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={18} />
                            Substituir
                        </button>
                    </div>
                </div>
             </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-blue-900">Importar Dados Realizados</h3>
                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
             </div>
             <p className="text-gray-500 mb-6 text-sm">
               Selecione a planilha (.xlsx, .xls) com os resultados de <strong>{months[selectedMonthIndex-1].label}</strong>.
               <br/>
               <span className="text-xs mt-2 block">
                   <strong>Colunas esperadas:</strong> Loja, Vendas, P.A, P.U, Ticket, Inadimplência (Col P).
                   <br/>
                   Os dados serão vinculados a este mês selecionado automaticamente.
               </span>
             </p>
             
             {/* Hidden Input for File Selection */}
             <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept=".xlsx, .xls"
                onChange={handleFileChange}
             />

             <div 
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center mb-6 cursor-pointer transition-colors group ${
                    selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-gray-50'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                        <span className="text-xs text-gray-400 mt-1">Excel (.xlsx)</span>
                    </>
                )}
             </div>

             <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded mb-4">
                 <strong>Colunas Esperadas (Excel):</strong><br/>
                 1: Loja | 3: Itens | 4: P.A | 5: P.U | 6: Ticket | 7: Meta | 8: Realizado | 15: Inadimplência
             </div>

             {importStatus && (
                 <div className="mb-4 text-center text-sm font-medium text-blue-600 flex items-center justify-center gap-2">
                     {isProcessing && <Loader2 size={16} className="animate-spin"/>}
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
                 disabled={isProcessing}
                 className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
               >
                 Cancelar
               </button>
               <button 
                 onClick={handleProcessImport}
                 disabled={!selectedFile || isProcessing}
                 className={`flex-1 px-4 py-2 rounded-lg font-medium shadow-md transition-all ${
                     !selectedFile || isProcessing
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg'
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

export default GoalRegistration;
