
import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency } from '../constants';
import { TrendingUp, Target, ShoppingBag, CreditCard, Tag, Upload, FileSpreadsheet, Loader2, CheckCircle, X, Save, Package, Trophy, Medal, Star, Crown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardAdminProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onImportData: (data: MonthlyPerformance[]) => Promise<void>; 
  onSaveGoals?: (goals: MonthlyPerformance[]) => Promise<void>;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, onImportData, onSaveGoals }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [editedGoals, setEditedGoals] = useState<Record<string, Partial<MonthlyPerformance>>>({});
  const [isSaving, setIsSaving] = useState(false);

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
      setIsEditingGoals(false);
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

  // DEDUPLICAÇÃO LOCAL PARA CÁLCULOS
  const currentMonthData = useMemo(() => {
      const data = performanceData.filter(p => p.month === selectedMonth);
      const uniqueMap = new Map();
      data.forEach(p => {
          if (!uniqueMap.has(p.storeId)) {
              uniqueMap.set(p.storeId, p);
          }
      });
      return Array.from(uniqueMap.values());
  }, [performanceData, selectedMonth]);

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
      return { totalRevenue, totalTarget, percentMeta, totalItemsActual, totalItemsTarget, percentItems, avgTicket, avgTicketTarget, percentTicket, avgPA, avgPATarget, percentPA, avgPU, avgPUTarget, percentPU };
  }, [currentMonthData]);

  const rankedStores = useMemo(() => {
      const withStats = currentMonthData.map(data => {
          const store = stores.find(s => s.id === data.storeId);
          const pctRevenue = data.revenueTarget > 0 ? (data.revenueActual / data.revenueTarget) : 0;
          const pctPA = (data.paTarget || 0) > 0 ? (data.itemsPerTicket / (data.paTarget || 1)) : 0;
          const pctPU = (data.puTarget || 0) > 0 ? (data.unitPriceAverage / (data.puTarget || 1)) : 0;
          const pctTicket = (data.ticketTarget || 0) > 0 ? (data.averageTicket / (data.ticketTarget || 1)) : 0;
          const pctItems = (data.itemsTarget || 0) > 0 ? ((data.itemsActual || 0) / (data.itemsTarget || 1)) : 0;
          let totalWeight = 0;
          let weightedSum = 0;
          if (data.revenueTarget > 0) { weightedSum += pctRevenue * 5; totalWeight += 5; }
          if ((data.paTarget || 0) > 0) { weightedSum += pctPA * 4; totalWeight += 4; }
          if ((data.puTarget || 0) > 0) { weightedSum += pctPU * 3; totalWeight += 3; }
          if ((data.ticketTarget || 0) > 0) { weightedSum += pctTicket * 2; totalWeight += 2; }
          if ((data.itemsTarget || 0) > 0) { weightedSum += pctItems * 1; totalWeight += 1; }
          const finalWeightedPercent = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
          const xp = Math.round(finalWeightedPercent * 10000);
          return { ...data, storeName: store?.name || 'Desconhecida', storeNumber: store?.number || '00', xp, weightedPercent: finalWeightedPercent * 100, status: store?.status };
      });
      return withStats.filter(s => s.status === 'active').sort((a, b) => b.xp - a.xp).map((item, index) => ({ ...item, rank: index + 1 }));
  }, [currentMonthData, stores]);

  const activeStores = useMemo(() => stores.filter(s => s.status === 'active').sort((a,b) => parseInt(a.number)-parseInt(b.number)), [stores]);

  const toggleEditMode = () => {
      if (!isEditingGoals) {
          const initialData: Record<string, Partial<MonthlyPerformance>> = {};
          activeStores.forEach(store => {
              const existing = performanceData.find(p => p.storeId === store.id && p.month === selectedMonth);
              initialData[store.id] = existing ? { ...existing } : { revenueTarget: 0, paTarget: 0, ticketTarget: 0, puTarget: 0, itemsTarget: 0, delinquencyTarget: 2.0 };
          });
          setEditedGoals(initialData);
      }
      setIsEditingGoals(!isEditingGoals);
  };

  const handleGoalChange = (storeId: string, field: keyof MonthlyPerformance, value: string) => {
      const numValue = parseFloat(value.replace(',', '.'));
      setEditedGoals(prev => ({ ...prev, [storeId]: { ...prev[storeId], [field]: isNaN(numValue) ? 0 : numValue } }));
  };

  const handleSaveGoals = async () => {
      setIsSaving(true);
      const changesToSave: MonthlyPerformance[] = [];
      Object.entries(editedGoals).forEach(([storeId, val]) => {
          const changes = val as Partial<MonthlyPerformance>;
          const existing = performanceData.find(p => p.storeId === storeId && p.month === selectedMonth);
          const record = existing ? { ...existing, ...changes, percentMeta: (changes.revenueTarget || 0) > 0 ? ((existing.revenueActual || 0) / (changes.revenueTarget || 1)) * 100 : 0, correctedDailyGoal: (changes.revenueTarget || 0) / 30 } : { storeId, month: selectedMonth, revenueTarget: changes.revenueTarget || 0, revenueActual: 0, itemsTarget: changes.itemsTarget || 0, itemsActual: 0, percentMeta: 0, itemsPerTicket: 0, unitPriceAverage: 0, averageTicket: 0, delinquencyRate: 0, paTarget: changes.paTarget || 0, ticketTarget: changes.ticketTarget || 0, puTarget: changes.puTarget || 0, delinquencyTarget: changes.delinquencyTarget || 0, trend: 'stable' as const, correctedDailyGoal: (changes.revenueTarget || 0) / 30 };
          changesToSave.push(record as MonthlyPerformance);
      });
      if (onSaveGoals) {
          await onSaveGoals(changesToSave);
          setIsEditingGoals(false);
          alert("Metas salvas!");
      }
      setIsSaving(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setImportStatus(''); }
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
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          let startRowIndex = -1;
          for (let r = 0; r < 30 && r < jsonData.length; r++) {
              if (jsonData[r]?.join(' ').toLowerCase().includes('loja')) { startRowIndex = r + 1; break; }
          }
          if (startRowIndex === -1) throw new Error("Cabeçalho não encontrado.");
          
          const changesMap = new Map<string, MonthlyPerformance>();
          for (let i = startRowIndex; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.length === 0) continue;
              const storeNumber = String(row[0] || '').replace(/\D/g, '');
              if (!storeNumber || String(row[0]).toLowerCase().includes('total')) continue;
              const store = stores.find(s => s.number === String(parseInt(storeNumber)));
              if (store) {
                  const revenueActual = parseNumber(row[7]);
                  const meta = parseNumber(row[6]);
                  const existingRecord = performanceData.find(p => p.storeId === store.id && p.month === selectedMonth);
                  const record: MonthlyPerformance = existingRecord ? { ...existingRecord, itemsPerTicket: parseNumber(row[3]), unitPriceAverage: parseNumber(row[4]), averageTicket: parseNumber(row[5]), revenueTarget: meta, revenueActual: Number(revenueActual.toFixed(2)), itemsActual: parseNumber(row[2]), delinquencyRate: parseNumber(row[14] || row[15]), percentMeta: meta > 0 ? (revenueActual / meta) * 100 : 0 } : { storeId: store.id, month: selectedMonth, itemsPerTicket: parseNumber(row[3]), unitPriceAverage: parseNumber(row[4]), averageTicket: parseNumber(row[5]), revenueTarget: meta, revenueActual: Number(revenueActual.toFixed(2)), itemsActual: parseNumber(row[2]), delinquencyRate: parseNumber(row[14] || row[15]), percentMeta: meta > 0 ? (revenueActual / meta) * 100 : 0, itemsTarget: 0, paTarget: 0, ticketTarget: 0, puTarget: 0, delinquencyTarget: 2.0, trend: 'stable', correctedDailyGoal: 0 };
                  // DEDUPLICAÇÃO NO MAPA POR ID DA LOJA
                  changesMap.set(store.id, record);
              }
          }
          const results = Array.from(changesMap.values());
          if (results.length > 0) {
              await onImportData(results);
              alert(`${results.length} lojas atualizadas!`);
              setShowImportModal(false);
              setSelectedFile(null);
          } else throw new Error("Nenhuma loja encontrada.");
      } catch (err: any) { alert(err.message); } finally { setIsProcessing(false); }
  };

  const NetworkStatCard = ({ title, value, target, percent, icon: Icon, colorClass, type = 'higher_better', prefix = '' }: any) => {
      const isSuccess = (parseFloat(value) >= parseFloat(target) && type === 'higher_better') || (parseFloat(value) <= parseFloat(target) && type === 'lower_better');
      return (
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
             <div>
                 <div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 text-sm font-bold uppercase">{title}</h3><div className={`p-2 rounded-lg ${colorClass}`}><Icon size={20}/></div></div>
                 <p className="text-3xl font-bold text-gray-900">{prefix}{typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: title.includes('Itens') ? 0 : 2, maximumFractionDigits: 2 }) : value}</p>
             </div>
             {target > 0 ? (
                 <div className="mt-4">
                     <div className="flex items-center gap-2"><div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min(percent, 100)}%` }}></div></div><span className={`text-xs font-bold ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>{percent.toFixed(1)}%</span></div>
                 </div>
             ) : <p className="text-[10px] text-gray-400 mt-4">Meta não definida</p>}
         </div>
      );
  };

  const getComparisonClass = (actual: number, target: number, type: 'higher_better' | 'lower_better') => {
      if (!target || target === 0 || !actual) return 'text-gray-500';
      const met = type === 'higher_better' ? actual >= target : actual <= target;
      return met ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div><h2 className="text-3xl font-bold text-gray-800">Visão Geral da Rede</h2><p className="text-gray-500">{isEditingGoals ? 'Definição e cadastro de metas das lojas.' : 'Monitoramento consolidado.'}</p></div>
          <div className="flex items-center gap-3">
             {!isEditingGoals && (
                 <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                    <select value={parseInt(selectedMonth.split('-')[1])} onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-medium outline-none cursor-pointer">
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select value={parseInt(selectedMonth.split('-')[0])} onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-medium outline-none cursor-pointer">
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                 </div>
             )}
             {isEditingGoals ? (
                 <>
                    <button onClick={() => setIsEditingGoals(false)} className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors shadow-sm font-bold"><X size={18} /> Cancelar</button>
                    <button onClick={handleSaveGoals} disabled={isSaving} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-bold disabled:opacity-50">{isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar</button>
                 </>
             ) : (
                 <>
                    <button onClick={toggleEditMode} className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors shadow-sm font-bold"><Target size={18} /> Definir Metas</button>
                    <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-bold"><Upload size={18} /> Importar Excel</button>
                 </>
             )}
          </div>
       </div>

       {!isEditingGoals && (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
               <NetworkStatCard title="Faturamento Total" value={networkStats.totalRevenue} target={networkStats.totalTarget} percent={networkStats.percentMeta} icon={ShoppingBag} colorClass="bg-green-50 text-green-600" type="higher_better" prefix="R$" />
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between"><div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 text-sm font-bold uppercase">Meta da Rede</h3><div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Target size={20}/></div></div><p className="text-3xl font-bold text-gray-900">{formatCurrency(networkStats.totalTarget)}</p></div>
               <NetworkStatCard title="Ticket Médio" value={networkStats.avgTicket} target={networkStats.avgTicketTarget} percent={networkStats.percentTicket} icon={CreditCard} colorClass="bg-purple-50 text-purple-600" type="higher_better" prefix="R$" />
               <NetworkStatCard title="P.A. Global" value={networkStats.avgPA} target={networkStats.avgPATarget} percent={networkStats.percentPA} icon={Tag} colorClass="bg-orange-50 text-orange-600" type="higher_better" />
               <NetworkStatCard title="Itens Vendidos" value={networkStats.totalItemsActual} target={networkStats.totalItemsTarget} percent={networkStats.percentItems} icon={Package} colorClass="bg-indigo-50 text-indigo-600" type="higher_better" />
               <NetworkStatCard title="P.U. Global" value={networkStats.avgPU} target={networkStats.avgPUTarget} percent={networkStats.percentPU} icon={DollarSign} colorClass="bg-yellow-50 text-yellow-600" type="lower_better" prefix="R$" />
           </div>
       )}

       <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${isEditingGoals ? 'ring-2 ring-blue-500' : ''}`}>
          <div className="p-6 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-lg text-gray-800">{isEditingGoals ? `Editando Todas as Metas - ${formatMonthName(selectedMonth)}` : `Detalhamento por Loja (${formatMonthName(selectedMonth)})`}</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-900 font-semibold">
                    <tr>
                        <th className="p-4 min-w-[150px]">Loja</th>
                        {!isEditingGoals && <th className="p-4 text-center">XP</th>}
                        <th className="p-4 text-center bg-blue-50">Meta Venda (R$)</th>
                        {!isEditingGoals && <th className="p-4 text-center">Realizado</th>}
                        <th className="p-4 text-center">Meta P.A.</th>
                        <th className="p-4 text-center">Meta P.U.</th>
                        <th className="p-4 text-center">Meta Ticket</th>
                        <th className="p-4 text-center">Meta Itens</th>
                        <th className="p-4 text-center">Max Inadimp. %</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {(isEditingGoals ? activeStores : rankedStores).map((item) => {
                         const store = isEditingGoals ? item as Store : stores.find(s => s.id === (item as any).storeId);
                         const data = isEditingGoals ? editedGoals[store!.id] || {} : item as any;
                         if (!store) return null;
                         return (
                            <tr key={store.id} className="hover:bg-gray-50">
                                <td className="p-4 font-medium text-gray-900">{store.name}</td>
                                {!isEditingGoals && <td className="p-4 text-center font-mono font-bold text-indigo-700">{data.xp?.toLocaleString()}</td>}
                                <td className="p-4 text-right">
                                    {isEditingGoals ? <input type="number" value={data.revenueTarget || ''} onChange={(e) => handleGoalChange(store.id, 'revenueTarget', e.target.value)} className="w-full py-1 border rounded text-right px-2" /> : formatCurrency(data.revenueTarget || 0)}
                                </td>
                                {!isEditingGoals && <td className="p-4 text-center font-bold">{formatCurrency(data.revenueActual || 0)}</td>}
                                <td className="p-4 text-center">{isEditingGoals ? <input type="number" value={data.paTarget || ''} onChange={(e) => handleGoalChange(store.id, 'paTarget', e.target.value)} className="w-20 py-1 border rounded text-center" /> : (data.itemsPerTicket || 0).toFixed(2)}</td>
                                <td className="p-4 text-center">{isEditingGoals ? <input type="number" value={data.puTarget || ''} onChange={(e) => handleGoalChange(store.id, 'puTarget', e.target.value)} className="w-24 py-1 border rounded text-right px-2" /> : formatCurrency(data.unitPriceAverage || 0)}</td>
                                <td className="p-4 text-center">{isEditingGoals ? <input type="number" value={data.ticketTarget || ''} onChange={(e) => handleGoalChange(store.id, 'ticketTarget', e.target.value)} className="w-24 py-1 border rounded text-right px-2" /> : formatCurrency(data.averageTicket || 0)}</td>
                                <td className="p-4 text-center">{isEditingGoals ? <input type="number" value={data.itemsTarget || ''} onChange={(e) => handleGoalChange(store.id, 'itemsTarget', e.target.value)} className="w-20 py-1 border rounded text-center" /> : data.itemsActual || 0}</td>
                                <td className="p-4 text-center">{isEditingGoals ? <input type="number" value={data.delinquencyTarget || ''} onChange={(e) => handleGoalChange(store.id, 'delinquencyTarget', e.target.value)} className="w-20 py-1 border rounded text-center text-red-600" /> : <span className={getComparisonClass(data.delinquencyRate, data.delinquencyTarget || 2, 'lower_better')}>{(data.delinquencyRate || 0).toFixed(2)}%</span>}</td>
                            </tr>
                         );
                    })}
                </tbody>
            </table>
          </div>
       </div>

       {showImportModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Upload size={24} className="text-blue-600"/> Importar Dados</h3><button onClick={() => {setShowImportModal(false); setSelectedFile(null); setImportStatus('');}} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                  <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center mb-6 cursor-pointer ${selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-gray-50'}`}>{selectedFile ? <><CheckCircle size={32} className="text-green-500 mb-2" /><span className="text-sm font-bold text-green-700">{selectedFile.name}</span></> : <><Upload size={32} className="text-gray-400 mb-2" /><span className="text-sm text-gray-500">Clique para selecionar Excel</span></>}</div>
                  {importStatus && <div className="mb-4 text-center text-sm font-medium text-blue-600">{importStatus}</div>}
                  <div className="flex gap-3"><button onClick={() => { setShowImportModal(false); setSelectedFile(null); }} className="flex-1 py-2 bg-gray-100 rounded-lg">Cancelar</button><button onClick={handleProcessImport} disabled={!selectedFile || isProcessing} className="flex-1 px-4 py-2 rounded-lg bg-blue-700 text-white font-medium shadow-md">Processar</button></div>
              </div>
          </div>
       )}
    </div>
  );
};

export default DashboardAdmin;
