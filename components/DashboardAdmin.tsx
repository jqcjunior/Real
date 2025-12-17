
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency } from '../constants';
import { TrendingUp, TrendingDown, Target, ShoppingBag, CreditCard, Tag, AlertCircle, Upload, FileSpreadsheet, Loader2, CheckCircle, Search, FileText, X, Edit, Save, ArrowLeft, Package, AlertTriangle, Trophy, Medal, Star, Crown, Info, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extractDataFromDocument } from '../services/geminiService';

interface DashboardAdminProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onImportData: (data: MonthlyPerformance[]) => void;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, onImportData }) => {
  // State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Edit Mode State
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [editedGoals, setEditedGoals] = useState<Record<string, Partial<MonthlyPerformance>>>({});

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importType, setImportType] = useState<'excel' | 'pdf'>('excel');

  // Criteria Modal
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);

  const handleMonthYearChange = (type: 'month' | 'year', value: number) => {
      const [currentY, currentM] = selectedMonth.split('-');
      let newY = parseInt(currentY);
      let newM = parseInt(currentM);

      if (type === 'month') newM = value;
      if (type === 'year') newY = value;

      const newStr = `${newY}-${String(newM).padStart(2, '0')}`;
      setSelectedMonth(newStr);
      setIsEditingGoals(false); // Exit edit mode on date change
  };

  const availableYears = useMemo(() => {
      const years = new Set<number>();
      const currentYear = new Date().getFullYear();
      
      // Ensure current year is there
      years.add(currentYear);
      
      // Add existing data years
      performanceData.forEach(d => years.add(parseInt(d.month.split('-')[0])));
      
      // Add future years up to 2030 per request
      for (let y = currentYear; y <= 2030; y++) {
          years.add(y);
      }
      
      return Array.from(years).sort((a,b) => b - a);
  }, [performanceData]);

  const formatMonthName = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  };

  const currentMonthData = useMemo(() => {
      return performanceData.filter(p => p.month === selectedMonth);
  }, [performanceData, selectedMonth]);

  // Aggregated Stats
  const networkStats = useMemo(() => {
      const totalRevenue = currentMonthData.reduce((acc, curr) => acc + curr.revenueActual, 0);
      const totalTarget = currentMonthData.reduce((acc, curr) => acc + curr.revenueTarget, 0);
      
      const totalItemsActual = currentMonthData.reduce((acc, curr) => acc + (curr.itemsActual || 0), 0);
      const totalItemsTarget = currentMonthData.reduce((acc, curr) => acc + (curr.itemsTarget || 0), 0);

      const count = currentMonthData.length;
      
      const avgTicket = count > 0 ? currentMonthData.reduce((acc, curr) => acc + curr.averageTicket, 0) / count : 0;
      const avgTicketTarget = count > 0 ? currentMonthData.reduce((acc, curr) => acc + (curr.ticketTarget || 0), 0) / count : 0;

      const avgPA = count > 0 ? currentMonthData.reduce((acc, curr) => acc + curr.itemsPerTicket, 0) / count : 0;
      const avgPATarget = count > 0 ? currentMonthData.reduce((acc, curr) => acc + (curr.paTarget || 0), 0) / count : 0;

      const avgPU = count > 0 ? currentMonthData.reduce((acc, curr) => acc + curr.unitPriceAverage, 0) / count : 0;
      const avgPUTarget = count > 0 ? currentMonthData.reduce((acc, curr) => acc + (curr.puTarget || 0), 0) / count : 0;
      
      const percentMeta = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
      const percentItems = totalItemsTarget > 0 ? (totalItemsActual / totalItemsTarget) * 100 : 0;
      const percentPA = avgPATarget > 0 ? (avgPA / avgPATarget) * 100 : 0;
      const percentTicket = avgTicketTarget > 0 ? (avgTicket / avgTicketTarget) * 100 : 0;
      const percentPU = avgPUTarget > 0 ? (avgPU / avgPUTarget) * 100 : 0;

      return { 
          totalRevenue, totalTarget, percentMeta, 
          totalItemsActual, totalItemsTarget, percentItems,
          avgTicket, avgTicketTarget, percentTicket,
          avgPA, avgPATarget, percentPA,
          avgPU, avgPUTarget, percentPU
      };
  }, [currentMonthData]);

  // --- RANKING & XP LOGIC (WEIGHTED) ---
  const rankedStores = useMemo(() => {
      const withStats = currentMonthData.map(data => {
          const store = stores.find(s => s.id === data.storeId);
          
          // Calculate individual percentages (capped at logic if needed, but raw for now)
          const pctRevenue = data.revenueTarget > 0 ? (data.revenueActual / data.revenueTarget) : 0;
          const pctPA = (data.paTarget || 0) > 0 ? (data.itemsPerTicket / (data.paTarget || 1)) : 0;
          const pctPU = (data.puTarget || 0) > 0 ? (data.unitPriceAverage / (data.puTarget || 1)) : 0;
          const pctTicket = (data.ticketTarget || 0) > 0 ? (data.averageTicket / (data.ticketTarget || 1)) : 0;
          const pctItems = (data.itemsTarget || 0) > 0 ? ((data.itemsActual || 0) / (data.itemsTarget || 1)) : 0;

          // WEIGHTS
          // Meta Atingida (Revenue): Peso 5
          // PA: Peso 4
          // PU: Peso 3
          // Ticket: Peso 2
          // Itens: Peso 1
          
          let totalWeight = 0;
          let weightedSum = 0;

          // Only add to weight calculation if a target exists (to avoid penalizing for missing goals)
          if (data.revenueTarget > 0) { weightedSum += pctRevenue * 5; totalWeight += 5; }
          if ((data.paTarget || 0) > 0) { weightedSum += pctPA * 4; totalWeight += 4; }
          if ((data.puTarget || 0) > 0) { weightedSum += pctPU * 3; totalWeight += 3; }
          if ((data.ticketTarget || 0) > 0) { weightedSum += pctTicket * 2; totalWeight += 2; }
          if ((data.itemsTarget || 0) > 0) { weightedSum += pctItems * 1; totalWeight += 1; }

          const finalWeightedPercent = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
          const xp = Math.round(finalWeightedPercent * 10000); // 100% = 10,000 XP

          return {
              ...data,
              storeName: store?.name || 'Desconhecida',
              storeNumber: store?.number || '00',
              xp,
              weightedPercent: finalWeightedPercent * 100, // For display if needed
              status: store?.status
          };
      });

      // Filter active stores only for ranking
      const activeOnly = withStats.filter(s => s.status === 'active');

      // Sort by XP desc
      return activeOnly.sort((a, b) => b.xp - a.xp).map((item, index) => ({
          ...item,
          rank: index + 1
      }));
  }, [currentMonthData, stores]);

  const top3 = rankedStores.slice(0, 3);

  // --- GOAL EDITING LOGIC ---
  const activeStores = useMemo(() => stores.filter(s => s.status === 'active').sort((a,b) => parseInt(a.number)-parseInt(b.number)), [stores]);

  const toggleEditMode = () => {
      if (!isEditingGoals) {
          // Enter Edit Mode: Populate formData with existing values or zeros
          const initialData: Record<string, Partial<MonthlyPerformance>> = {};
          activeStores.forEach(store => {
              const existing = performanceData.find(p => p.storeId === store.id && p.month === selectedMonth);
              if (existing) {
                  initialData[store.id] = { ...existing };
              } else {
                  initialData[store.id] = {
                      revenueTarget: 0,
                      paTarget: 0,
                      ticketTarget: 0,
                      puTarget: 0,
                      itemsTarget: 0,
                      delinquencyTarget: 2.0 // Default healthy max
                  };
              }
          });
          setEditedGoals(initialData);
      }
      setIsEditingGoals(!isEditingGoals);
  };

  const handleGoalChange = (storeId: string, field: keyof MonthlyPerformance, value: string) => {
      const cleanValue = value.replace(',', '.');
      const numValue = parseFloat(cleanValue);
      
      setEditedGoals(prev => ({
          ...prev,
          [storeId]: {
              ...prev[storeId],
              [field]: isNaN(numValue) ? 0 : numValue
          }
      }));
  };

  const handleSaveGoals = () => {
      const updatedPerformanceData = [...performanceData];

      Object.entries(editedGoals).forEach(([storeId, val]) => {
          const changes = val as Partial<MonthlyPerformance>;
          const idx = updatedPerformanceData.findIndex(p => p.storeId === storeId && p.month === selectedMonth);
          
          if (idx >= 0) {
              // Merge updates
              const current = updatedPerformanceData[idx];
              updatedPerformanceData[idx] = {
                  ...current,
                  revenueTarget: changes.revenueTarget || 0,
                  paTarget: changes.paTarget || 0,
                  ticketTarget: changes.ticketTarget || 0,
                  puTarget: changes.puTarget || 0,
                  itemsTarget: changes.itemsTarget || 0,
                  delinquencyTarget: changes.delinquencyTarget || 0,
                  // Re-calc percent meta if actual revenue exists
                  percentMeta: (changes.revenueTarget || 0) > 0 
                    ? ((current.revenueActual || 0) / (changes.revenueTarget || 1)) * 100 
                    : 0,
                  correctedDailyGoal: (changes.revenueTarget || 0) / 30
              };
          } else {
              // Create new record
              updatedPerformanceData.push({
                  storeId,
                  month: selectedMonth,
                  revenueTarget: changes.revenueTarget || 0,
                  revenueActual: 0,
                  itemsTarget: changes.itemsTarget || 0,
                  itemsActual: 0,
                  percentMeta: 0,
                  itemsPerTicket: 0,
                  unitPriceAverage: 0,
                  averageTicket: 0,
                  delinquencyRate: 0,
                  paTarget: changes.paTarget || 0,
                  ticketTarget: changes.ticketTarget || 0,
                  puTarget: changes.puTarget || 0,
                  delinquencyTarget: changes.delinquencyTarget || 0,
                  trend: 'stable',
                  correctedDailyGoal: (changes.revenueTarget || 0) / 30
              });
          }
      });

      onImportData(updatedPerformanceData); // Update parent state
      setIsEditingGoals(false);
      alert("Metas atualizadas com sucesso!");
  };

  // --- IMPORT LOGIC (Excel) ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportStatus('');
    }
  };

  const processExcel = async (file: File) => {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      let startRowIndex = -1;
      // Scan to find the start of the data table
      for(let i=0; i<30 && i < jsonData.length; i++) {
          const rowStr = jsonData[i]?.join(' ').toLowerCase();
          if(rowStr.includes('loja')) {
              startRowIndex = i + 1; 
              break;
          }
      }
      if(startRowIndex === -1) throw new Error("Cabeçalho 'Loja' não encontrado na planilha.");

      const updates: MonthlyPerformance[] = [...performanceData];
      let count = 0;
      let detectedMonthStr = '';

      // Month Mapper for PT-BR
      const monthMap: Record<string, string> = {
          'janeiro': '01', 'jan': '01',
          'fevereiro': '02', 'fev': '02',
          'março': '03', 'marco': '03', 'mar': '03',
          'abril': '04', 'abr': '04',
          'maio': '05', 'mai': '05',
          'junho': '06', 'jun': '06',
          'julho': '07', 'jul': '07',
          'agosto': '08', 'ago': '08',
          'setembro': '09', 'set': '09',
          'outubro': '10', 'out': '10',
          'novembro': '11', 'nov': '11',
          'dezembro': '12', 'dez': '12'
      };

      for(let i=startRowIndex; i<jsonData.length; i++) {
          const row = jsonData[i];
          if(!row || row.length === 0) continue;
          
          const rawStore = String(row[0] || ''); // Col 1
          if (rawStore.toLowerCase().includes('total')) continue; 

          const storeNum = rawStore.replace(/\D/g, ''); 
          if (!storeNum) continue;

          const store = stores.find(s => s.number === String(parseInt(storeNum)));
          
          if(store) {
             // --- FIDELITY TO MONTH LOGIC ---
             // Check Columns 14 (O), 15 (P), 16 (Q) for a month string
             let targetMonth = selectedMonth; // Fallback
             
             // Extract month name from row data if available
             // Looking at columns 14, 15, 16 specifically as requested ("referência na coluna 15")
             const possibleMonthCells = [row[14], row[15], row[16]]; 
             
             let foundMonthDigit = '';
             for (const cell of possibleMonthCells) {
                 if (typeof cell === 'string') {
                     const cleanVal = cell.trim().toLowerCase();
                     // Check against map
                     for (const [key, digit] of Object.entries(monthMap)) {
                         if (cleanVal.includes(key)) {
                             foundMonthDigit = digit;
                             break;
                         }
                     }
                 }
                 if (foundMonthDigit) break;
             }

             if (foundMonthDigit) {
                 // Use the year from the selected filter, but the month from the file
                 const currentYear = selectedMonth.split('-')[0];
                 targetMonth = `${currentYear}-${foundMonthDigit}`;
                 detectedMonthStr = targetMonth;
             }

             const parseNum = (val: any) => {
                 if (typeof val === 'number') return val;
                 if (typeof val === 'string') {
                     let clean = val.replace('%', '').trim();
                     if (!clean || clean === '-') return 0;
                     if (clean.includes(',') && clean.includes('.')) {
                         clean = clean.replace(/\./g, '').replace(',', '.');
                     } else if (clean.includes(',')) {
                         clean = clean.replace(',', '.');
                     }
                     return parseFloat(clean) || 0;
                 }
                 return 0;
             };

             const qtde = parseNum(row[2]); // Col 3
             const pa = parseNum(row[3]);   // Col 4
             const pu = parseNum(row[4]);   // Col 5
             const ticket = parseNum(row[5]); // Col 6
             const meta = parseNum(row[6]);   // Col 7
             const realizado = parseNum(row[7]); // Col 8
             
             // Inadimplencia logic
             let inad = 0;
             // Try to parse inadimplencia from expected columns, avoiding the month string
             const col14Val = row[14];
             const col15Val = row[15];
             
             // If column 14 is a number, use it. If it's a string (likely month), ignore.
             if (typeof col14Val === 'number') inad = col14Val;
             else if (typeof col14Val === 'string' && !isNaN(parseNum(col14Val)) && !monthMap[col14Val.toLowerCase()]) inad = parseNum(col14Val);
             
             // Fallback to 15 if 14 was zero/invalid/text
             if (inad === 0) {
                 if (typeof col15Val === 'number') inad = col15Val;
                 else if (typeof col15Val === 'string' && !isNaN(parseNum(col15Val)) && !monthMap[col15Val.toLowerCase()]) inad = parseNum(col15Val);
             }

             if (inad > 0 && inad < 1) inad = inad * 100;

             let percent = 0;
             if (meta > 0) {
                 percent = (realizado / meta) * 100;
             }

             // Use targetMonth found in row or selectedMonth
             const idx = updates.findIndex(p => p.storeId === store.id && p.month === targetMonth);
             
             const newData = {
                 revenueTarget: meta,
                 revenueActual: realizado,
                 percentMeta: percent,
                 itemsPerTicket: pa,
                 unitPriceAverage: pu,
                 averageTicket: ticket,
                 itemsActual: qtde,
                 delinquencyRate: inad
             };

             if(idx >= 0) {
                 updates[idx] = { ...updates[idx], ...newData };
             } else {
                 updates.push({
                     storeId: store.id,
                     month: targetMonth,
                     ...newData,
                     itemsTarget: 0,
                     trend: 'stable',
                     correctedDailyGoal: 0
                 });
             }
             count++;
          }
      }
      onImportData(updates);
      
      // If we detected a specific month from the file different from selected, notify user
      if (detectedMonthStr && detectedMonthStr !== selectedMonth) {
          const [y, m] = detectedMonthStr.split('-');
          const monthName = MONTHS.find(mon => mon.value === parseInt(m))?.label;
          alert(`Dados importados com sucesso para: ${monthName}/${y}. \n\nPor favor, mude o filtro de data para visualizar os dados importados.`);
      }
      
      return count;
  };

  const processPDF = async (file: File) => {
      const reader = new FileReader();
      return new Promise<number>((resolve, reject) => {
          reader.onload = async () => {
              try {
                  const base64 = (reader.result as string).split(',')[1];
                  const data = await extractDataFromDocument(base64, file.type);
                  const updates = [...performanceData];
                  let count = 0;
                  data.forEach(item => {
                      const store = stores.find(s => s.number === String(parseInt(item.storeNumber)));
                      if(store) {
                          const targetMonth = item.month || selectedMonth;
                          const idx = updates.findIndex(p => p.storeId === store.id && p.month === targetMonth);
                          if(idx >= 0) {
                              updates[idx] = { 
                                  ...updates[idx], 
                                  itemsPerTicket: item.pa, 
                                  unitPriceAverage: item.pu, 
                                  averageTicket: item.ticket,
                                  percentMeta: item.percentMeta
                              };
                          } else {
                              updates.push({
                                  storeId: store.id,
                                  month: targetMonth,
                                  revenueTarget: 0,
                                  revenueActual: 0,
                                  itemsPerTicket: item.pa,
                                  unitPriceAverage: item.pu,
                                  averageTicket: item.ticket,
                                  delinquencyRate: 0,
                                  percentMeta: item.percentMeta,
                                  trend: 'stable',
                                  correctedDailyGoal: 0
                              });
                          }
                          count++;
                      }
                  });
                  onImportData(updates);
                  resolve(count);
              } catch (e) {
                  reject(e);
              }
          };
          reader.readAsDataURL(file);
      });
  };

  const handleProcessImport = async () => {
      if(!selectedFile) return;
      setIsProcessing(true);
      setImportStatus('Processando arquivo...');
      try {
          let count = 0;
          if (importType === 'excel') {
              count = await processExcel(selectedFile);
          } else {
              count = await processPDF(selectedFile);
          }
          if (!count && importType === 'excel') {
             // Fallback message handled in processExcel? No, count is returned.
             // If count is 0 but no error thrown
             alert('Nenhum dado válido encontrado. Verifique o layout da planilha.');
          } else {
             alert(`Importação concluída! ${count} lojas atualizadas.`);
          }
          setShowImportModal(false);
          setSelectedFile(null);
      } catch (error: any) {
          alert(`Erro: ${error.message}`);
      } finally {
          setIsProcessing(false);
          setImportStatus('');
      }
  };

  // --- VISUAL COMPARISON HELPER ---
  const isGoalMet = (actual: number, target: number, type: 'higher_better' | 'lower_better') => {
      if (!target || target === 0) return false;
      if (type === 'higher_better') return actual >= target;
      return actual <= target;
  };

  const getComparisonClass = (actual: number, target: number, type: 'higher_better' | 'lower_better') => {
      if (!target || target === 0 || !actual) return 'text-gray-500';
      const met = isGoalMet(actual, target, type);
      return met ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
  };

  // --- UPDATED PROGRESS BAR WITH TEXT INSIDE ---
  const MiniProgressBar = ({ current, target, type }: { current: number, target: number, type: 'higher_better' | 'lower_better' }) => {
      if (!target || target === 0) return null;
      
      const met = isGoalMet(current, target, type);
      // For inverse logic (like P.U. where lower is better), if 'met' is true, green. If false, red.
      const colorClass = met ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600';
      
      let pct = 0;
      if (type === 'higher_better') {
          pct = (current / target) * 100;
      } else {
          // For lower is better, we still visualize % of target usually, but semantics change
          // Simplest viz: show raw % of target consumed
          pct = (current / target) * 100;
      }

      const displayPct = pct.toFixed(1);

      return (
          <div className="w-full bg-gray-100 rounded-full h-3 mt-1 overflow-hidden relative shadow-inner border border-gray-200">
              <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`} 
                  style={{ width: `${Math.min(pct, 100)}%` }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[9px] font-black text-white drop-shadow-md tracking-wide z-10 leading-none">
                      {displayPct}%
                  </span>
              </div>
          </div>
      );
  };

  // Helper Stat Card Component
  const NetworkStatCard = ({ title, value, target, percent, icon: Icon, colorClass, type = 'higher_better', prefix = '' }: any) => {
      const isSuccess = isGoalMet(parseFloat(value), parseFloat(target), type);
      const barColor = isSuccess ? 'bg-green-500' : 'bg-red-500';
      const textColor = isSuccess ? 'text-green-600' : 'text-red-600';
      
      return (
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
             <div>
                 <div className="flex items-center justify-between mb-4">
                     <h3 className="text-gray-500 text-sm font-bold uppercase">{title}</h3>
                     <div className={`p-2 rounded-lg ${colorClass}`}><Icon size={20}/></div>
                 </div>
                 <p className="text-3xl font-bold text-gray-900">
                    {prefix}{typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: title.includes('Itens') ? 0 : 2, maximumFractionDigits: 2 }) : value}
                 </p>
             </div>
             
             {target > 0 ? (
                 <div className="mt-4">
                     <div className="flex items-center gap-2">
                         <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                             <div className={`h-full ${barColor}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                         </div>
                         <span className={`text-xs font-bold ${textColor}`}>{percent.toFixed(1)}%</span>
                     </div>
                     <p className="text-[10px] text-gray-400 mt-1">Meta Global: {prefix}{typeof target === 'number' ? target.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : target}</p>
                 </div>
             ) : (
                 <p className="text-[10px] text-gray-400 mt-4">Meta não definida</p>
             )}
         </div>
      );
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
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

       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
             <h2 className="text-3xl font-bold text-gray-800">Visão Geral da Rede</h2>
             <p className="text-gray-500">
                 {isEditingGoals ? 'Definição e cadastro de metas das lojas.' : 'Monitoramento consolidado e comparação Meta x Realizado.'}
             </p>
          </div>
          
          <div className="flex items-center gap-3">
             {!isEditingGoals && (
                 <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex gap-2">
                        <select 
                            value={parseInt(selectedMonth.split('-')[1])}
                            onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))}
                            className="bg-transparent text-gray-700 font-medium outline-none cursor-pointer"
                        >
                            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <select 
                            value={parseInt(selectedMonth.split('-')[0])}
                            onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))}
                            className="bg-transparent text-gray-700 font-medium outline-none cursor-pointer"
                        >
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                 </div>
             )}

             {isEditingGoals ? (
                 <>
                    <button 
                        onClick={() => setIsEditingGoals(false)}
                        className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors shadow-sm font-bold"
                    >
                        <X size={18} /> Cancelar
                    </button>
                    <button 
                        onClick={handleSaveGoals}
                        className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-bold"
                    >
                        <Save size={18} /> Salvar Metas
                    </button>
                 </>
             ) : (
                 <>
                    <button 
                        onClick={toggleEditMode}
                        className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors shadow-sm font-bold"
                    >
                        <Target size={18} /> Definir Metas
                    </button>
                    <button 
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-bold"
                    >
                        <Upload size={18} /> Importar Realizado
                    </button>
                 </>
             )}
          </div>
       </div>

       {/* Network KPI Cards (Only in View Mode) */}
       {!isEditingGoals && (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
               <NetworkStatCard 
                   title="Faturamento Total"
                   value={networkStats.totalRevenue}
                   target={networkStats.totalTarget}
                   percent={networkStats.percentMeta}
                   icon={ShoppingBag}
                   colorClass="bg-green-50 text-green-600"
                   type="higher_better"
                   prefix="R$"
               />
               
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                   <div className="flex items-center justify-between mb-4">
                       <h3 className="text-gray-500 text-sm font-bold uppercase">Meta da Rede</h3>
                       <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Target size={20}/></div>
                   </div>
                   <p className="text-3xl font-bold text-gray-900">{formatCurrency(networkStats.totalTarget)}</p>
                   <p className="text-xs text-gray-400 mt-auto pt-4">Somatório consolidado</p>
               </div>

               <NetworkStatCard 
                   title="Ticket Médio"
                   value={networkStats.avgTicket}
                   target={networkStats.avgTicketTarget}
                   percent={networkStats.percentTicket}
                   icon={CreditCard}
                   colorClass="bg-purple-50 text-purple-600"
                   type="higher_better"
                   prefix="R$"
               />

               <NetworkStatCard 
                   title="P.A. Global"
                   value={networkStats.avgPA}
                   target={networkStats.avgPATarget}
                   percent={networkStats.percentPA}
                   icon={Tag}
                   colorClass="bg-orange-50 text-orange-600"
                   type="higher_better"
               />

               <NetworkStatCard 
                   title="Itens Vendidos"
                   value={networkStats.totalItemsActual}
                   target={networkStats.totalItemsTarget}
                   percent={networkStats.percentItems}
                   icon={Package}
                   colorClass="bg-indigo-50 text-indigo-600"
                   type="higher_better"
               />

               <NetworkStatCard 
                   title="P.U. Global"
                   value={networkStats.avgPU}
                   target={networkStats.avgPUTarget}
                   percent={networkStats.percentPU}
                   icon={DollarSign}
                   colorClass="bg-yellow-50 text-yellow-600"
                   type="lower_better"
                   prefix="R$"
               />
           </div>
       )}

       {/* GAMIFICATION & RANKING SECTION */}
       {!isEditingGoals && rankedStores.length > 0 && (
           <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
               <div className="flex justify-between items-start mb-6 relative z-10">
                   <div>
                       <h3 className="text-2xl font-bold flex items-center gap-2">
                           <Trophy className="text-yellow-400" size={28}/> Ranking & Gamificação
                       </h3>
                       <p className="text-blue-200 text-sm mt-1">Destaques da rede baseados na pontuação ponderada.</p>
                   </div>
                   <button 
                       onClick={() => setShowCriteriaModal(true)}
                       className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold transition-all backdrop-blur-sm"
                   >
                       <Info size={16}/> Critérios de Avaliação
                   </button>
               </div>

               {/* Top 3 Podium */}
               <div className="flex flex-wrap md:flex-nowrap justify-center gap-6 relative z-10">
                   {/* 2nd Place */}
                   {top3[1] && (
                       <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl flex-1 max-w-sm mt-4 md:mt-8">
                           <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-2">
                                   <Medal className="text-gray-300" size={24}/>
                                   <span className="font-bold text-gray-300 text-lg">2º Lugar</span>
                               </div>
                               <span className="bg-gray-500/50 px-2 py-1 rounded text-xs font-bold">{top3[1].weightedPercent.toFixed(1)}% Score</span>
                           </div>
                           <h4 className="text-xl font-bold">{top3[1].storeName}</h4>
                           <div className="mt-2 text-sm text-blue-200 font-mono">{top3[1].xp.toLocaleString()} XP</div>
                       </div>
                   )}

                   {/* 1st Place */}
                   {top3[0] && (
                       <div className="bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 backdrop-blur-md border border-yellow-400/50 p-6 rounded-xl flex-1 max-w-sm shadow-xl transform scale-105 z-20">
                           <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-2">
                                   <Crown className="text-yellow-400 fill-yellow-400 animate-pulse" size={28}/>
                                   <span className="font-black text-yellow-400 text-xl">1º LUGAR</span>
                               </div>
                               <span className="bg-yellow-500/30 px-3 py-1 rounded-full text-sm font-bold text-yellow-200 border border-yellow-500/50">{top3[0].weightedPercent.toFixed(1)}% Score</span>
                           </div>
                           <h4 className="text-2xl font-black">{top3[0].storeName}</h4>
                           <div className="mt-3 text-lg text-yellow-200 font-bold font-mono flex items-center gap-2">
                               <Star size={16} fill="currentColor"/> {top3[0].xp.toLocaleString()} XP
                           </div>
                       </div>
                   )}

                   {/* 3rd Place */}
                   {top3[2] && (
                       <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl flex-1 max-w-sm mt-4 md:mt-12">
                           <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-2">
                                   <Medal className="text-orange-400" size={24}/>
                                   <span className="font-bold text-orange-400 text-lg">3º Lugar</span>
                               </div>
                               <span className="bg-orange-500/30 px-2 py-1 rounded text-xs font-bold text-orange-200">{top3[2].weightedPercent.toFixed(1)}% Score</span>
                           </div>
                           <h4 className="text-xl font-bold">{top3[2].storeName}</h4>
                           <div className="mt-2 text-sm text-blue-200 font-mono">{top3[2].xp.toLocaleString()} XP</div>
                       </div>
                   )}
               </div>

               {/* Background Decorative */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -mr-16 -mt-16"></div>
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -ml-16 -mb-16"></div>
           </div>
       )}

       {/* Detailed Table (Switch between View and Edit) */}
       <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${isEditingGoals ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
          <div className={`p-6 border-b border-gray-100 flex justify-between items-center ${isEditingGoals ? 'bg-blue-50' : 'bg-white'}`}>
              <h3 className="font-bold text-lg text-gray-800">
                  {isEditingGoals ? `Editando Metas - ${formatMonthName(selectedMonth)}` : `Detalhamento por Loja (${formatMonthName(selectedMonth)})`}
              </h3>
              {isEditingGoals && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full animate-pulse">MODO EDIÇÃO</span>}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-900 font-semibold">
                    <tr>
                        {!isEditingGoals && <th className="p-4 w-12 text-center">#</th>}
                        <th className="p-4 min-w-[150px]">Loja</th>
                        
                        {!isEditingGoals && <th className="p-4 text-center bg-indigo-50 text-indigo-900">XP</th>}

                        {/* Headers change based on mode */}
                        <th className="p-4 text-center bg-blue-50 text-blue-900 border-r border-blue-100 min-w-[140px]">
                            {isEditingGoals ? 'Meta Venda (R$)' : 'Meta de Venda'}
                        </th>
                        
                        {!isEditingGoals && (
                            <>
                                <th className="p-4 text-center min-w-[140px]">Venda Realizada</th>
                                {/* Removed separate "% Ating." column */}
                            </>
                        )}
                        
                        <th className={`p-4 text-center min-w-[100px] ${isEditingGoals ? 'bg-blue-50 text-blue-900 border-r border-blue-100' : ''}`}>
                            {isEditingGoals ? 'Meta P.A.' : 'P.A.'}
                        </th>
                        <th className={`p-4 text-center min-w-[120px] ${isEditingGoals ? 'bg-blue-50 text-blue-900 border-r border-blue-100' : ''}`}>
                            {isEditingGoals ? 'Meta P.U. (R$)' : 'P.U.'}
                        </th>
                        <th className={`p-4 text-center min-w-[120px] ${isEditingGoals ? 'bg-blue-50 text-blue-900 border-r border-blue-100' : ''}`}>
                            {isEditingGoals ? 'Meta Ticket (R$)' : 'Ticket Médio'}
                        </th>
                        <th className={`p-4 text-center min-w-[100px] ${isEditingGoals ? 'bg-blue-50 text-blue-900 border-r border-blue-100' : ''}`}>
                            {isEditingGoals ? 'Meta Itens' : 'Itens Vendidos'}
                        </th>
                        <th className={`p-4 text-center min-w-[120px] ${isEditingGoals ? 'bg-blue-50 text-blue-900' : ''}`}>
                            {isEditingGoals ? 'Max Inadimp. (%)' : 'Inadimplência %'}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {/* If Editing, map active stores. If viewing, map currentMonthData */}
                    {(isEditingGoals ? activeStores : rankedStores).map((item, idx) => {
                         let store: Store | undefined;
                         let data: Partial<MonthlyPerformance> & { xp?: number, rank?: number };

                         if (isEditingGoals) {
                             store = item as Store;
                             data = editedGoals[store.id] || {};
                         } else {
                             const perf = item as any;
                             store = stores.find(s => s.id === perf.storeId);
                             data = perf;
                         }

                         if (!store) return null;

                         return (
                            <tr key={store.id} className={`hover:bg-gray-50 ${isEditingGoals ? 'hover:bg-blue-50/30' : ''}`}>
                                {!isEditingGoals && (
                                    <td className="p-4 text-center font-bold text-gray-400">
                                        {data.rank === 1 ? <Crown size={16} className="text-yellow-500 mx-auto"/> : data.rank}
                                    </td>
                                )}
                                
                                <td className="p-4 font-medium text-gray-900">{store.name}</td>
                                
                                {/* XP Column */}
                                {!isEditingGoals && (
                                    <td className="p-4 text-center font-mono font-bold text-indigo-700 bg-indigo-50/30">
                                        {data.xp?.toLocaleString()}
                                    </td>
                                )}

                                {/* REVENUE - Higher is Better */}
                                <td className={`p-4 text-right align-top ${isEditingGoals ? 'bg-blue-50/20' : ''}`}>
                                    {isEditingGoals ? (
                                        <div className="flex flex-col items-end">
                                            <div className="relative w-full max-w-[140px]">
                                                <span className="absolute left-2 top-2 text-gray-400 text-xs font-bold">R$</span>
                                                <input 
                                                    type="number"
                                                    value={data.revenueTarget || ''}
                                                    onChange={(e) => handleGoalChange(store!.id, 'revenueTarget', e.target.value)}
                                                    className="w-full pl-7 pr-2 py-2 bg-white border border-gray-300 rounded-lg text-right font-bold text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            {/* Show Actual for reference if editing */}
                                            <div className="text-[10px] text-gray-500 mt-1 flex justify-between w-full max-w-[140px] px-1">
                                                <span>Real:</span>
                                                <span className={getComparisonClass(data.revenueActual || 0, data.revenueTarget || 0, 'higher_better')}>
                                                    {formatCurrency(data.revenueActual || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="font-bold text-gray-700">{formatCurrency(data.revenueTarget || 0)}</span>
                                    )}
                                </td>

                                {/* REALIZED & PERCENT (View Only) */}
                                {!isEditingGoals && (
                                    <td className={`p-4 text-center align-top`}>
                                        <div className="flex flex-col w-full">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className={`text-sm font-bold ${getComparisonClass(data.revenueActual || 0, data.revenueTarget || 0, 'higher_better')}`}>
                                                    {formatCurrency(data.revenueActual || 0)}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    / {formatCurrency(data.revenueTarget || 0)}
                                                </span>
                                            </div>
                                            <MiniProgressBar current={data.revenueActual || 0} target={data.revenueTarget || 0} type="higher_better" />
                                        </div>
                                    </td>
                                )}

                                {/* PA - Higher is Better */}
                                <td className={`p-4 text-center align-top ${isEditingGoals ? 'bg-blue-50/20' : ''}`}>
                                    {isEditingGoals ? (
                                        <div className="flex flex-col items-center">
                                            <div className="relative w-full max-w-[80px]">
                                                <ShoppingBag size={12} className="absolute left-2 top-2.5 text-gray-400"/>
                                                <input 
                                                    type="number"
                                                    value={data.paTarget || ''}
                                                    onChange={(e) => handleGoalChange(store!.id, 'paTarget', e.target.value)}
                                                    className="w-full pl-6 pr-2 py-2 bg-white border border-gray-300 rounded-lg text-center text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className={`text-[10px] mt-1 ${getComparisonClass(data.itemsPerTicket || 0, data.paTarget || 0, 'higher_better')}`}>
                                                Real: {(data.itemsPerTicket || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col w-full">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className={`text-sm font-bold ${getComparisonClass(data.itemsPerTicket || 0, data.paTarget || 0, 'higher_better')}`}>
                                                    {(data.itemsPerTicket || 0).toFixed(2)}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    / {(data.paTarget || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <MiniProgressBar current={data.itemsPerTicket || 0} target={data.paTarget || 0} type="higher_better" />
                                        </div>
                                    )}
                                </td>

                                {/* PU - Lower is Better (Per Prompt) */}
                                <td className={`p-4 text-center align-top ${isEditingGoals ? 'bg-blue-50/20' : ''}`}>
                                    {isEditingGoals ? (
                                        <div className="flex flex-col items-center">
                                            <div className="relative w-full max-w-[100px]">
                                                <span className="absolute left-2 top-2 text-gray-400 text-xs font-bold">R$</span>
                                                <input 
                                                    type="number"
                                                    value={data.puTarget || ''}
                                                    onChange={(e) => handleGoalChange(store!.id, 'puTarget', e.target.value)}
                                                    className="w-full pl-6 pr-2 py-2 bg-white border border-gray-300 rounded-lg text-center text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className={`text-[10px] mt-1 ${getComparisonClass(data.unitPriceAverage || 0, data.puTarget || 0, 'lower_better')}`}>
                                                Real: {(data.unitPriceAverage || 0).toFixed(0)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col w-full">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className={`text-sm font-bold ${getComparisonClass(data.unitPriceAverage || 0, data.puTarget || 0, 'lower_better')}`}>
                                                    {formatCurrency(data.unitPriceAverage || 0)}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    / {formatCurrency(data.puTarget || 0)}
                                                </span>
                                            </div>
                                            <MiniProgressBar current={data.unitPriceAverage || 0} target={data.puTarget || 0} type="lower_better" />
                                        </div>
                                    )}
                                </td>

                                {/* TICKET - Higher is Better */}
                                <td className={`p-4 text-center align-top ${isEditingGoals ? 'bg-blue-50/20' : ''}`}>
                                    {isEditingGoals ? (
                                        <div className="flex flex-col items-center">
                                            <div className="relative w-full max-w-[100px]">
                                                <span className="absolute left-2 top-2 text-gray-400 text-xs font-bold">R$</span>
                                                <input 
                                                    type="number"
                                                    value={data.ticketTarget || ''}
                                                    onChange={(e) => handleGoalChange(store!.id, 'ticketTarget', e.target.value)}
                                                    className="w-full pl-6 pr-2 py-2 bg-white border border-gray-300 rounded-lg text-center text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className={`text-[10px] mt-1 ${getComparisonClass(data.averageTicket || 0, data.ticketTarget || 0, 'higher_better')}`}>
                                                Real: {(data.averageTicket || 0).toFixed(0)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col w-full">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className={`text-sm font-bold ${getComparisonClass(data.averageTicket || 0, data.ticketTarget || 0, 'higher_better')}`}>
                                                    {formatCurrency(data.averageTicket || 0)}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    / {formatCurrency(data.ticketTarget || 0)}
                                                </span>
                                            </div>
                                            <MiniProgressBar current={data.averageTicket || 0} target={data.ticketTarget || 0} type="higher_better" />
                                        </div>
                                    )}
                                </td>

                                {/* ITEMS - Higher is Better */}
                                <td className={`p-4 text-center align-top ${isEditingGoals ? 'bg-blue-50/20' : ''}`}>
                                    {isEditingGoals ? (
                                        <div className="flex flex-col items-center">
                                            <div className="relative w-full max-w-[80px]">
                                                <Package size={12} className="absolute left-2 top-2.5 text-gray-400"/>
                                                <input 
                                                    type="number"
                                                    value={data.itemsTarget || ''}
                                                    onChange={(e) => handleGoalChange(store!.id, 'itemsTarget', e.target.value)}
                                                    className="w-full pl-6 pr-2 py-2 bg-white border border-gray-300 rounded-lg text-center text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className={`text-[10px] mt-1 ${getComparisonClass(data.itemsActual || 0, data.itemsTarget || 0, 'higher_better')}`}>
                                                Real: {data.itemsActual || 0}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col w-full">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className={`text-sm font-bold ${getComparisonClass(data.itemsActual || 0, data.itemsTarget || 0, 'higher_better')}`}>
                                                    {data.itemsActual || 0}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    / {data.itemsTarget || 0}
                                                </span>
                                            </div>
                                            <MiniProgressBar current={data.itemsActual || 0} target={data.itemsTarget || 0} type="higher_better" />
                                        </div>
                                    )}
                                </td>

                                {/* INADIMPLENCIA - Lower is Better */}
                                <td className={`p-4 text-center align-top ${isEditingGoals ? 'bg-blue-50/20' : ''}`}>
                                    {isEditingGoals ? (
                                        <div className="flex flex-col items-center">
                                            <div className="relative w-full max-w-[80px]">
                                                <AlertCircle size={12} className="absolute left-2 top-2.5 text-red-400"/>
                                                <input 
                                                    type="number"
                                                    value={data.delinquencyTarget || ''}
                                                    onChange={(e) => handleGoalChange(store!.id, 'delinquencyTarget', e.target.value)}
                                                    className="w-full pl-6 pr-2 py-2 bg-white border border-red-200 rounded-lg text-center text-red-700 font-bold shadow-sm focus:ring-2 focus:ring-red-500 outline-none text-sm"
                                                    placeholder="2.0"
                                                />
                                            </div>
                                            <div className={`text-[10px] mt-1 ${getComparisonClass(data.delinquencyRate || 0, data.delinquencyTarget || 0, 'lower_better')}`}>
                                                Real: {(data.delinquencyRate || 0).toFixed(2)}%
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col w-full">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className={`text-sm font-bold ${getComparisonClass(data.delinquencyRate || 0, data.delinquencyTarget || 2, 'lower_better')}`}>
                                                    {data.delinquencyRate ? (data.delinquencyRate || 0).toFixed(2) + '%' : '-'}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    / {(data.delinquencyTarget || 2).toFixed(2)}%
                                                </span>
                                            </div>
                                            <MiniProgressBar current={data.delinquencyRate || 0} target={data.delinquencyTarget || 2} type="lower_better" />
                                        </div>
                                    )}
                                </td>
                            </tr>
                         );
                    })}
                    {!isEditingGoals && currentMonthData.length === 0 && (
                        <tr><td colSpan={11} className="p-8 text-center text-gray-400">Nenhum dado encontrado para este mês.</td></tr>
                    )}
                </tbody>
            </table>
          </div>
       </div>

       {/* Import Modal */}
       {showImportModal && (
           <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
               <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                           <Upload className="text-blue-600" size={24}/> Importar Relatório
                       </h3>
                       <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                   </div>

                   <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                       <button onClick={() => setImportType('excel')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${importType === 'excel' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}>
                           <FileSpreadsheet size={16}/> Excel
                       </button>
                       <button onClick={() => setImportType('pdf')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${importType === 'pdf' ? 'bg-white shadow text-red-700' : 'text-gray-500'}`}>
                           <FileText size={16}/> PDF (IA)
                       </button>
                   </div>

                   <div 
                        onClick={() => !isProcessing && fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center mb-6 cursor-pointer transition-colors group ${
                            selectedFile ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                   >
                        {selectedFile ? (
                            <>
                                <CheckCircle size={32} className="text-blue-500 mb-2" />
                                <span className="text-sm font-bold text-blue-700 break-all text-center">{selectedFile.name}</span>
                                <span className="text-xs text-blue-600 mt-1">Clique para alterar</span>
                            </>
                        ) : (
                            <>
                                <Upload size={32} className="text-gray-400 mb-2 group-hover:text-blue-500 transition-colors" />
                                <span className="text-sm text-gray-500 group-hover:text-gray-700">Clique para selecionar arquivo</span>
                                <span className="text-xs text-gray-400 mt-1">{importType === 'excel' ? '.xlsx, .xls' : '.pdf'}</span>
                            </>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept={importType === 'excel' ? ".xlsx, .xls" : ".pdf"}
                            onChange={handleFileChange} 
                        />
                   </div>

                   <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded mb-4">
                       <strong>Colunas Esperadas (Excel):</strong><br/>
                       1: Loja | 3: Itens | 4: P.A | 5: P.U | 6: Ticket | 7: Meta | 8: Realizado | 15: Mês Referência (Opcional) | 16: Inadimplência
                   </div>

                   {importStatus && (
                        <div className="mb-4 text-center text-sm font-medium text-blue-600 flex items-center justify-center gap-2">
                            {isProcessing && <Loader2 size={16} className="animate-spin"/>}
                            {importStatus}
                        </div>
                   )}

                   <button 
                        onClick={handleProcessImport}
                        disabled={!selectedFile || isProcessing}
                        className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all ${!selectedFile || isProcessing ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'}`}
                   >
                        Processar Arquivo
                   </button>
               </div>
           </div>
       )}

       {/* Criteria Info Modal */}
       {showCriteriaModal && (
           <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
               <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in duration-200">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                           <Info size={24} className="text-blue-600"/> Critérios de Pontuação
                       </h3>
                       <button onClick={() => setShowCriteriaModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                   </div>
                   
                   <div className="space-y-6">
                       <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                           <h4 className="font-bold text-blue-900 mb-2">Como o Ranking é definido?</h4>
                           <p className="text-sm text-gray-700 mb-3">
                               A pontuação (Score) é calculada através de uma <strong>Média Ponderada</strong> do percentual de atingimento de cada meta.
                           </p>
                           <div className="bg-white rounded border border-blue-100 p-2">
                               <table className="w-full text-xs text-left">
                                   <thead className="text-blue-800 border-b border-blue-100">
                                       <tr><th className="pb-1">Indicador</th><th className="pb-1 text-right">Peso</th></tr>
                                   </thead>
                                   <tbody className="text-gray-600">
                                       <tr className="border-b border-gray-50"><td className="py-1 font-bold">Meta Faturamento</td><td className="text-right">5</td></tr>
                                       <tr className="border-b border-gray-50"><td className="py-1">P.A. (Peças/Atend.)</td><td className="text-right">4</td></tr>
                                       <tr className="border-b border-gray-50"><td className="py-1">P.U. (Preço Médio)</td><td className="text-right">3</td></tr>
                                       <tr className="border-b border-gray-50"><td className="py-1">Ticket Médio</td><td className="text-right">2</td></tr>
                                       <tr><td className="py-1">Quantidade Itens</td><td className="text-right">1</td></tr>
                                   </tbody>
                               </table>
                           </div>
                       </div>

                       <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-500">
                           <h4 className="font-bold text-indigo-900 mb-2">Como ganho XP?</h4>
                           <p className="text-sm text-gray-700 mb-2">
                               XP é o reflexo direto da sua pontuação ponderada.
                           </p>
                           <code className="block bg-white p-2 rounded border border-indigo-100 text-xs font-mono text-indigo-700 mb-2">
                               XP = Score Ponderado x 100
                           </code>
                           <ul className="text-xs text-gray-600 list-disc list-inside">
                               <li>100% em todas as metas = <strong>10.000 XP</strong></li>
                               <li>Focar nas metas de maior peso (Venda e P.A.) gera mais XP.</li>
                           </ul>
                       </div>

                       <div>
                           <h4 className="font-bold text-gray-800 mb-3 text-sm">Classificação de Nível (Status)</h4>
                           <div className="space-y-2 text-xs">
                               <div className="flex justify-between items-center p-2 rounded bg-gradient-to-r from-yellow-100 to-white border border-yellow-200">
                                   <span className="font-bold text-yellow-800 flex items-center gap-1"><Crown size={12}/> DIAMANTE (Lendário)</span>
                                   <span>&gt; 100% Score</span>
                               </div>
                               <div className="flex justify-between items-center p-2 rounded bg-gradient-to-r from-gray-100 to-white border border-gray-300">
                                   <span className="font-bold text-gray-700 flex items-center gap-1"><Medal size={12}/> PLATINA (Elite)</span>
                                   <span>95% - 99.9%</span>
                               </div>
                               <div className="flex justify-between items-center p-2 rounded bg-gradient-to-r from-orange-100 to-white border border-orange-200">
                                   <span className="font-bold text-orange-800 flex items-center gap-1"><Medal size={12}/> OURO (Avançado)</span>
                                   <span>90% - 94.9%</span>
                               </div>
                               <div className="flex justify-between items-center p-2 rounded bg-gray-50 border border-gray-100 text-gray-500">
                                   <span>PRATA (Regular)</span>
                                   <span>&lt; 90%</span>
                               </div>
                           </div>
                       </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default DashboardAdmin;
