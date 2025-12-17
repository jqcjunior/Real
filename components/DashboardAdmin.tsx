
import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency } from '../constants';
import { TrendingUp, Target, ShoppingBag, CreditCard, Tag, Upload, FileSpreadsheet, Loader2, CheckCircle, X, Save, Package, Trophy, Medal, Star, Crown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardAdminProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onImportData: (data: MonthlyPerformance[]) => Promise<void>; // Changed to Promise for DB persistence
  onSaveGoals?: (goals: MonthlyPerformance[]) => Promise<void>;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, onImportData, onSaveGoals }) => {
  // State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Edit Mode State
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [editedGoals, setEditedGoals] = useState<Record<string, Partial<MonthlyPerformance>>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState('');

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
      years.add(currentYear);
      performanceData.forEach(d => years.add(parseInt(d.month.split('-')[0])));
      for (let y = currentYear; y <= 2030; y++) years.add(y);
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
          
          const pctRevenue = data.revenueTarget > 0 ? (data.revenueActual / data.revenueTarget) : 0;
          const pctPA = (data.paTarget || 0) > 0 ? (data.itemsPerTicket / (data.paTarget || 1)) : 0;
          const pctPU = (data.puTarget || 0) > 0 ? (data.unitPriceAverage / (data.puTarget || 1)) : 0;
          const pctTicket = (data.ticketTarget || 0) > 0 ? (data.averageTicket / (data.ticketTarget || 1)) : 0;
          const pctItems = (data.itemsTarget || 0) > 0 ? ((data.itemsActual || 0) / (data.itemsTarget || 1)) : 0;

          // WEIGHTS: Revenue(5), PA(4), PU(3), Ticket(2), Items(1)
          let totalWeight = 0;
          let weightedSum = 0;

          if (data.revenueTarget > 0) { weightedSum += pctRevenue * 5; totalWeight += 5; }
          if ((data.paTarget || 0) > 0) { weightedSum += pctPA * 4; totalWeight += 4; }
          if ((data.puTarget || 0) > 0) { weightedSum += pctPU * 3; totalWeight += 3; }
          if ((data.ticketTarget || 0) > 0) { weightedSum += pctTicket * 2; totalWeight += 2; }
          if ((data.itemsTarget || 0) > 0) { weightedSum += pctItems * 1; totalWeight += 1; }

          const finalWeightedPercent = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
          const xp = Math.round(finalWeightedPercent * 10000);

          return {
              ...data,
              storeName: store?.name || 'Desconhecida',
              storeNumber: store?.number || '00',
              xp,
              weightedPercent: finalWeightedPercent * 100,
              status: store?.status
          };
      });

      return withStats.filter(s => s.status === 'active').sort((a, b) => b.xp - a.xp).map((item, index) => ({
          ...item,
          rank: index + 1
      }));
  }, [currentMonthData, stores]);

  const top3 = rankedStores.slice(0, 3);

  // --- GOAL EDITING LOGIC ---
  const activeStores = useMemo(() => stores.filter(s => s.status === 'active').sort((a,b) => parseInt(a.number)-parseInt(b.number)), [stores]);

  const toggleEditMode = () => {
      if (!isEditingGoals) {
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
                      delinquencyTarget: 2.0
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
          [storeId]: { ...prev[storeId], [field]: isNaN(numValue) ? 0 : numValue }
      }));
  };

  const handleSaveGoals = async () => {
      setIsSaving(true);
      const changesToSave: MonthlyPerformance[] = [];

      Object.entries(editedGoals).forEach(([storeId, val]) => {
          const changes = val as Partial<MonthlyPerformance>;
          const existing = performanceData.find(p => p.storeId === storeId && p.month === selectedMonth);
          
          let record: MonthlyPerformance;
          if (existing) {
              record = {
                  ...existing,
                  ...changes,
                  percentMeta: (changes.revenueTarget || 0) > 0 ? ((existing.revenueActual || 0) / (changes.revenueTarget || 1)) * 100 : 0,
                  correctedDailyGoal: (changes.revenueTarget || 0) / 30
              };
          } else {
              record = {
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
              };
          }
          changesToSave.push(record as MonthlyPerformance);
      });

      if (onSaveGoals) {
          await onSaveGoals(changesToSave);
          setIsEditingGoals(false);
          alert("Metas atualizadas e salvas no banco de dados!");
      }
      setIsSaving(false);
  };

  // --- IMPORT LOGIC ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportStatus('');
    }
  };

  const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let clean = val.replace('%', '').trim();
        if (!clean || clean === '-') return 0;
        if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/\./g, '').replace(',', '.');
        else if (clean.includes(',')) clean = clean.replace(',', '.');
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

          let startRowIndex = -1;
          for (let r = 0; r < 30 && r < jsonData.length; r++) {
              const rowStr = jsonData[r]?.join(' ').toLowerCase();
              if (rowStr.includes('loja')) {
                  startRowIndex = r + 1;
                  break;
              }
          }

          if (startRowIndex === -1) throw new Error("Cabeçalho não encontrado (Coluna 'Loja' obrigatória).");

          const changesToSave: MonthlyPerformance[] = [];
          let successCount = 0;

          for (let i = startRowIndex; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.length === 0) continue;
              
              const rawStoreNumber = String(row[0] || ''); 
              if (rawStoreNumber.toLowerCase().includes('total')) continue;

              const storeNumber = rawStoreNumber.replace(/\D/g, '');
              const store = stores.find(s => s.number === String(parseInt(storeNumber || '0')));

              if (store) {
                  const salesQty = parseNumber(row[2]); 
                  const pa = parseNumber(row[3]);       
                  const pu = parseNumber(row[4]);       
                  const ticket = parseNumber(row[5]);   
                  const meta = parseNumber(row[6]);     
                  const revenueActual = parseNumber(row[7]); 
                  
                  let delinquencyRate = parseNumber(row[14]); 
                  if (delinquencyRate === 0 && row[15] !== undefined) delinquencyRate = parseNumber(row[15]);
                  if (delinquencyRate > 0 && delinquencyRate < 1) delinquencyRate = delinquencyRate * 100;

                  const existingRecord = performanceData.find(p => p.storeId === store.id && p.month === selectedMonth);
                  
                  const record: MonthlyPerformance = existingRecord ? {
                      ...existingRecord,
                      itemsPerTicket: pa,
                      unitPriceAverage: pu,
                      averageTicket: ticket,
                      revenueTarget: meta, 
                      revenueActual: Number(revenueActual.toFixed(2)),
                      itemsActual: salesQty, 
                      delinquencyRate: Number(delinquencyRate.toFixed(2)),
                      percentMeta: meta > 0 ? (revenueActual / meta) * 100 : 0
                  } : {
                      storeId: store.id,
                      month: selectedMonth, 
                      itemsPerTicket: pa,
                      unitPriceAverage: pu,
                      averageTicket: ticket,
                      revenueTarget: meta, 
                      revenueActual: Number(revenueActual.toFixed(2)),
                      itemsActual: salesQty, 
                      delinquencyRate: Number(delinquencyRate.toFixed(2)),
                      percentMeta: meta > 0 ? (revenueActual / meta) * 100 : 0,
                      itemsTarget: 0, paTarget: 0, ticketTarget: 0, puTarget: 0, delinquencyTarget: 2.0,
                      trend: 'stable', correctedDailyGoal: 0
                  };
                  changesToSave.push(record);
                  successCount++;
              }
          }

          if (successCount > 0) {
              setImportStatus(`Salvando ${successCount} registros...`);
              await onImportData(changesToSave); // Call parent handler which calls Supabase
              alert(`${successCount} lojas atualizadas com sucesso!`);
              setShowImportModal(false);
              setSelectedFile(null);
          } else {
              throw new Error("Nenhuma loja correspondente encontrada.");
          }

      } catch (err: any) {
          console.error(err);
          setImportStatus(`Erro: ${err.message}`);
      } finally {
          setIsProcessing(false);
      }
  };

  const NetworkStatCard = ({ title, value, target, percent, icon: Icon, colorClass, type = 'higher_better', prefix = '' }: any) => {
      const isSuccess = (parseFloat(value) >= parseFloat(target) && type === 'higher_better') || (parseFloat(value) <= parseFloat(target) && type === 'lower_better');
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

  const MiniProgressBar = ({ current, target, type }: { current: number, target: number, type: 'higher_better' | 'lower_better' }) => {
      if (!target || target === 0) return null;
      const met = isGoalMet(current, target, type);
      const colorClass = met ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600';
      let pct = (current / target) * 100;
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

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
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
                    <button onClick={() => setIsEditingGoals(false)} className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors shadow-sm font-bold"><X size={18} /> Cancelar</button>
                    <button onClick={handleSaveGoals} disabled={isSaving} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-bold disabled:opacity-50">
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {isSaving ? 'Salvando...' : 'Salvar Metas'}
                    </button>
                 </>
             ) : (
                 <>
                    <button onClick={toggleEditMode} className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors shadow-sm font-bold"><Target size={18} /> Definir Metas</button>
                    <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-bold"><Upload size={18} /> Importar Excel</button>
                 </>
             )}
          </div>
       </div>

       {/* Network KPI Cards */}
       {!isEditingGoals && (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
               <NetworkStatCard title="Faturamento Total" value={networkStats.totalRevenue} target={networkStats.totalTarget} percent={networkStats.percentMeta} icon={ShoppingBag} colorClass="bg-green-50 text-green-600" type="higher_better" prefix="R$" />
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                   <div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 text-sm font-bold uppercase">Meta da Rede</h3><div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Target size={20}/></div></div>
                   <p className="text-3xl font-bold text-gray-900">{formatCurrency(networkStats.totalTarget)}</p>
                   <p className="text-xs text-gray-400 mt-auto pt-4">Somatório consolidado</p>
               </div>
               <NetworkStatCard title="Ticket Médio" value={networkStats.avgTicket} target={networkStats.avgTicketTarget} percent={networkStats.percentTicket} icon={CreditCard} colorClass="bg-purple-50 text-purple-600" type="higher_better" prefix="R$" />
               <NetworkStatCard title="P.A. Global" value={networkStats.avgPA} target={networkStats.avgPATarget} percent={networkStats.percentPA} icon={Tag} colorClass="bg-orange-50 text-orange-600" type="higher_better" />
               <NetworkStatCard title="Itens Vendidos" value={networkStats.totalItemsActual} target={networkStats.totalItemsTarget} percent={networkStats.percentItems} icon={Package} colorClass="bg-indigo-50 text-indigo-600" type="higher_better" />
               <NetworkStatCard title="P.U. Global" value={networkStats.avgPU} target={networkStats.avgPUTarget} percent={networkStats.percentPU} icon={DollarSign} colorClass="bg-yellow-50 text-yellow-600" type="lower_better" prefix="R$" />
           </div>
       )}

       {/* GAMIFICATION & RANKING SECTION */}
       {!isEditingGoals && rankedStores.length > 0 && (
           <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
               <div className="flex justify-between items-start mb-6 relative z-10">
                   <div>
                       <h3 className="text-2xl font-bold flex items-center gap-2"><Trophy className="text-yellow-400" size={28}/> Ranking & Gamificação</h3>
                       <p className="text-blue-200 text-sm mt-1">Destaques da rede baseados na pontuação ponderada.</p>
                   </div>
               </div>
               <div className="flex flex-wrap md:flex-nowrap justify-center gap-6 relative z-10">
                   {top3[1] && (<div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl flex-1 max-w-sm mt-4 md:mt-8"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Medal className="text-gray-300" size={24}/><span className="font-bold text-gray-300 text-lg">2º Lugar</span></div><span className="bg-gray-500/50 px-2 py-1 rounded text-xs font-bold">{top3[1].weightedPercent.toFixed(1)}% Score</span></div><h4 className="text-xl font-bold">{top3[1].storeName}</h4><div className="mt-2 text-sm text-blue-200 font-mono">{top3[1].xp.toLocaleString()} XP</div></div>)}
                   {top3[0] && (<div className="bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 backdrop-blur-md border border-yellow-400/50 p-6 rounded-xl flex-1 max-w-sm shadow-xl transform scale-105 z-20"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Crown className="text-yellow-400 fill-yellow-400 animate-pulse" size={28}/><span className="font-black text-yellow-400 text-xl">1º LUGAR</span></div><span className="bg-yellow-500/30 px-3 py-1 rounded-full text-sm font-bold text-yellow-200 border border-yellow-500/50">{top3[0].weightedPercent.toFixed(1)}% Score</span></div><h4 className="text-2xl font-black">{top3[0].storeName}</h4><div className="mt-3 text-lg text-yellow-200 font-bold font-mono flex items-center gap-2"><Star size={16} fill="currentColor"/> {top3[0].xp.toLocaleString()} XP</div></div>)}
                   {top3[2] && (<div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl flex-1 max-w-sm mt-4 md:mt-12"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Medal className="text-orange-400" size={24}/><span className="font-bold text-orange-400 text-lg">3º Lugar</span></div><span className="bg-orange-500/30 px-2 py-1 rounded text-xs font-bold text-orange-200">{top3[2].weightedPercent.toFixed(1)}% Score</span></div><h4 className="text-xl font-bold">{top3[2].storeName}</h4><div className="mt-2 text-sm text-blue-200 font-mono">{top3[2].xp.toLocaleString()} XP</div></div>)}
               </div>
           </div>
       )}

       {/* Detailed Table */}
       <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${isEditingGoals ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
          <div className={`p-6 border-b border-gray-100 flex justify-between items-center ${isEditingGoals ? 'bg-blue-50' : 'bg-white'}`}>
              <h3 className="font-bold text-lg text-gray-800">{isEditingGoals ? `Editando Metas - ${formatMonthName(selectedMonth)}` : `Detalhamento por Loja (${formatMonthName(selectedMonth)})`}</h3>
              {isEditingGoals && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full animate-pulse">MODO EDIÇÃO</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-900 font-semibold">
                    <tr>
                        {!isEditingGoals && <th className="p-4 w-12 text-center">#</th>}
                        <th className="p-4 min-w-[150px]">Loja</th>
                        {!isEditingGoals && <th className="p-4 text-center bg-indigo-50 text-indigo-900">XP</th>}
                        <th className="p-4 text-center bg-blue-50 text-blue-900 border-r border-blue-100 min-w-[140px]">{isEditingGoals ? 'Meta Venda (R$)' : 'Meta de Venda'}</th>
                        {!isEditingGoals && <th className="p-4 text-center min-w-[140px]">Venda Realizada</th>}
                        <th className="p-4 text-center min-w-[100px]">{isEditingGoals ? 'Meta P.A.' : 'P.A.'}</th>
                        <th className="p-4 text-center min-w-[120px]">{isEditingGoals ? 'Meta P.U. (R$)' : 'P.U.'}</th>
                        <th className="p-4 text-center min-w-[120px]">{isEditingGoals ? 'Meta Ticket (R$)' : 'Ticket Médio'}</th>
                        <th className="p-4 text-center min-w-[100px]">{isEditingGoals ? 'Meta Itens' : 'Itens Vendidos'}</th>
                        <th className="p-4 text-center min-w-[120px]">{isEditingGoals ? 'Max Inadimp. (%)' : 'Inadimplência %'}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
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
                                {!isEditingGoals && <td className="p-4 text-center font-bold text-gray-400">{data.rank === 1 ? <Crown size={16} className="text-yellow-500 mx-auto"/> : data.rank}</td>}
                                <td className="p-4 font-medium text-gray-900">{store.name}</td>
                                {!isEditingGoals && <td className="p-4 text-center font-mono font-bold text-indigo-700 bg-indigo-50/30">{data.xp?.toLocaleString()}</td>}
                                <td className={`p-4 text-right align-top ${isEditingGoals ? 'bg-blue-50/20' : ''}`}>
                                    {isEditingGoals ? <input type="number" value={data.revenueTarget || ''} onChange={(e) => handleGoalChange(store!.id, 'revenueTarget', e.target.value)} className="w-full pl-2 pr-2 py-2 bg-white border border-gray-300 rounded-lg text-right font-bold text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="0.00"/> : <span className="font-bold text-gray-700">{formatCurrency(data.revenueTarget || 0)}</span>}
                                </td>
                                {!isEditingGoals && <td className="p-4 text-center align-top"><div className="flex flex-col w-full"><div className="flex justify-between items-baseline mb-1"><span className={`text-sm font-bold ${getComparisonClass(data.revenueActual || 0, data.revenueTarget || 0, 'higher_better')}`}>{formatCurrency(data.revenueActual || 0)}</span></div><MiniProgressBar current={data.revenueActual || 0} target={data.revenueTarget || 0} type="higher_better" /></div></td>}
                                <td className="p-4 text-center align-top">{isEditingGoals ? <input type="number" value={data.paTarget || ''} onChange={(e) => handleGoalChange(store!.id, 'paTarget', e.target.value)} className="w-full text-center py-2 bg-white border border-gray-300 rounded-lg" /> : <div className="flex flex-col"><span className={`text-sm font-bold ${getComparisonClass(data.itemsPerTicket || 0, data.paTarget || 0, 'higher_better')}`}>{(data.itemsPerTicket || 0).toFixed(2)}</span><MiniProgressBar current={data.itemsPerTicket || 0} target={data.paTarget || 0} type="higher_better" /></div>}</td>
                                <td className="p-4 text-center align-top">{isEditingGoals ? <input type="number" value={data.puTarget || ''} onChange={(e) => handleGoalChange(store!.id, 'puTarget', e.target.value)} className="w-full text-center py-2 bg-white border border-gray-300 rounded-lg" /> : <span className={`text-sm font-bold ${getComparisonClass(data.unitPriceAverage || 0, data.puTarget || 0, 'lower_better')}`}>{formatCurrency(data.unitPriceAverage || 0)}</span>}</td>
                                <td className="p-4 text-center align-top">{isEditingGoals ? <input type="number" value={data.ticketTarget || ''} onChange={(e) => handleGoalChange(store!.id, 'ticketTarget', e.target.value)} className="w-full text-center py-2 bg-white border border-gray-300 rounded-lg" /> : <span className={`text-sm font-bold ${getComparisonClass(data.averageTicket || 0, data.ticketTarget || 0, 'higher_better')}`}>{formatCurrency(data.averageTicket || 0)}</span>}</td>
                                <td className="p-4 text-center align-top">{isEditingGoals ? <input type="number" value={data.itemsTarget || ''} onChange={(e) => handleGoalChange(store!.id, 'itemsTarget', e.target.value)} className="w-full text-center py-2 bg-white border border-gray-300 rounded-lg" /> : <span className={`text-sm font-bold ${getComparisonClass(data.itemsActual || 0, data.itemsTarget || 0, 'higher_better')}`}>{data.itemsActual || 0}</span>}</td>
                                <td className="p-4 text-center align-top">{isEditingGoals ? <input type="number" value={data.delinquencyTarget || ''} onChange={(e) => handleGoalChange(store!.id, 'delinquencyTarget', e.target.value)} className="w-full text-center py-2 bg-white border border-red-200 rounded-lg text-red-700" /> : <span className={`text-sm font-bold ${getComparisonClass(data.delinquencyRate || 0, data.delinquencyTarget || 2, 'lower_better')}`}>{(data.delinquencyRate || 0).toFixed(2)}%</span>}</td>
                            </tr>
                         );
                    })}
                </tbody>
            </table>
          </div>
       </div>

       {/* IMPORT MODAL */}
       {showImportModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Upload size={24} className="text-blue-600"/> Importar Dados</h3><button onClick={() => {setShowImportModal(false); setSelectedFile(null); setImportStatus('');}} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6"><p className="text-sm text-blue-800 font-semibold mb-2 flex items-center gap-2"><FileSpreadsheet size={16}/> Instruções:</p><ul className="text-xs text-blue-700 space-y-1 list-disc list-inside"><li>Arquivo Excel (.xlsx)</li><li>Coluna Obrigatória: 'Loja'</li><li>Dados: Venda, PA, PU, Ticket, Itens, Inadimplência</li></ul></div>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                  <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center mb-6 cursor-pointer transition-colors group ${selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-gray-50'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>{selectedFile ? (<><CheckCircle size={32} className="text-green-500 mb-2" /><span className="text-sm font-bold text-green-700 break-all text-center">{selectedFile.name}</span></>) : (<><Upload size={32} className="text-gray-400 mb-2 group-hover:text-blue-500 transition-colors" /><span className="text-sm text-gray-500 group-hover:text-gray-700">Clique para selecionar arquivo</span></>)}</div>
                  {importStatus && (<div className="mb-4 text-center text-sm font-medium text-blue-600 flex items-center justify-center gap-2">{isProcessing && <Loader2 size={16} className="animate-spin"/>}{importStatus}</div>)}
                  <div className="flex gap-3"><button onClick={() => { setShowImportModal(false); setSelectedFile(null); setImportStatus(''); }} disabled={isProcessing} className="flex-1 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 font-medium">Cancelar</button><button onClick={handleProcessImport} disabled={!selectedFile || isProcessing} className={`flex-1 px-4 py-2 rounded-lg font-medium shadow-md transition-all flex items-center justify-center gap-2 ${!selectedFile || isProcessing ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-700 text-white hover:bg-blue-800 hover:shadow-lg'}`}>{isProcessing && <Loader2 size={16} className="animate-spin"/>} Processar</button></div>
              </div>
          </div>
       )}
    </div>
  );
};

export default DashboardAdmin;
