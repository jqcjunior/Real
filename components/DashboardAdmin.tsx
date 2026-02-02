
import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance, MonthlyGoal } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { 
    LayoutDashboard, Calculator, DollarSign, Calendar, TrendingUp, TrendingDown, 
    Upload, FileSpreadsheet, X, Search, Info, BarChart3, Users, Zap, 
    ChevronRight, BrainCircuit, Sparkles, Loader2, ShoppingBag, Target, AlertTriangle,
    Clock, ArrowUpRight, ShieldCheck, CheckCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

interface DashboardAdminProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  goalsData: MonthlyGoal[]; // Nova prop para sincronização
  onImportData: (data: MonthlyPerformance[]) => Promise<void>; 
}

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, goalsData, onImportData }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const timeStats = useMemo(() => {
      const now = new Date();
      const isCurrentMonth = selectedMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const day = isCurrentMonth ? now.getDate() : 30;
      const totalDays = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate();
      const remaining = Math.max(0, totalDays - day);
      return { day, totalDays, remaining, isCurrentMonth };
  }, [selectedMonth]);

  const handleMonthYearChange = (type: 'month' | 'year', value: number) => {
      const [currentY, currentM] = selectedMonth.split('-');
      let newY = Number(currentY);
      let newM = Number(currentM);
      if (type === 'month') newM = value;
      if (type === 'year') newY = value;
      setSelectedMonth(`${newY}-${String(newM).padStart(2, '0')}`);
  };

  const currentMonthData = useMemo(() => {
      const activeStores = (stores || []).filter(s => s.status === 'active');
      const monthlyPerf = (performanceData || []).filter(p => p.month === selectedMonth);
      
      return activeStores.map(store => {
          const perf = monthlyPerf.find(p => p.storeId === store.id);
          
          // Busca a meta correspondente para garantir sincronismo de dias úteis e valores base
          const goal = (goalsData || []).find(g => 
            g.storeId === store.id && 
            `${g.year}-${String(g.month).padStart(2, '0')}` === selectedMonth
          );

          const revenueActual = Number(perf?.revenueActual || 0);
          const revenueTarget = Number(goal?.revenueTarget || perf?.revenueTarget || 0);
          const gap = revenueTarget - revenueActual;

          return {
              id: perf?.id || store.id,
              storeId: store.id,
              storeName: store.name,
              storeNumber: store.number,
              revenueTarget,
              revenueActual,
              gap,
              percentMeta: revenueTarget > 0 ? (revenueActual / revenueTarget) * 100 : 0,
              itemsActual: Number(perf?.itemsActual || 0),
              itemsTarget: Number(goal?.itemsTarget || perf?.itemsTarget || 0),
              itemsPerTicket: Number(perf?.itemsPerTicket || 0),
              paTarget: Number(goal?.paTarget || perf?.paTarget || 0),
              unitPriceAverage: Number(perf?.unitPriceAverage || 0),
              puTarget: Number(goal?.puTarget || perf?.puTarget || 0),
              averageTicket: Number(perf?.averageTicket || 0),
              ticketTarget: Number(goal?.ticketTarget || perf?.ticketTarget || 0),
              delinquencyRate: Number(perf?.delinquencyRate || 0),
              delinquencyTarget: Number(goal?.delinquencyTarget || perf?.delinquencyTarget || 2.0),
              // CORREÇÃO: Prioriza os dias da meta (ex: 22) sobre o padrão
              businessDays: Number(goal?.businessDays || perf?.businessDays || 26),
              month: selectedMonth,
              trend: goal?.trend || perf?.trend || 'stable'
          };
      });
  }, [performanceData, goalsData, selectedMonth, stores]);

  const networkStats = useMemo(() => {
      const totalRevenue = currentMonthData.reduce((acc, curr) => acc + curr.revenueActual, 0);
      const totalTarget = currentMonthData.reduce((acc, curr) => acc + curr.revenueTarget, 0);
      const diff = totalTarget - totalRevenue;
      const percentMeta = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
      const currentRhythm = totalRevenue / Math.max(timeStats.day, 1);
      const neededRhythm = timeStats.remaining > 0 ? Math.max(0, diff) / timeStats.remaining : 0;
      return { totalRevenue, totalTarget, diff, percentMeta, currentRhythm, neededRhythm, activeCount: currentMonthData.length };
  }, [currentMonthData, timeStats]);

  const rankedStores = useMemo(() => {
      return [...currentMonthData]
        .sort((a, b) => b.percentMeta - a.percentMeta)
        .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [currentMonthData]);

  const handleProcessImport = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as any[][];

        let headerIdx = -1;
        for (let i = 0; i < Math.min(40, jsonData.length); i++) {
            const rowStr = jsonData[i].join(' ').toLowerCase();
            if (rowStr.includes('loja') || rowStr.includes('filial') || rowStr.includes('unidade') || rowStr.includes('id')) { 
                headerIdx = i; 
                break; 
            }
        }

        if (headerIdx === -1) throw new Error("Não localizei o cabeçalho. Certifique-se que a coluna 'LOJA' existe.");

        const headerRow = jsonData[headerIdx].map(h => String(h || '').toLowerCase().trim());
        const findCol = (keys: string[]) => headerRow.findIndex(h => keys.some(k => h.includes(k)));

        const idxStore = findCol(['loja', 'filial', 'unidade', 'id']);
        const idxRevenue = findCol(['faturamento', 'venda bruta', 'realizado', 'fat', 'venda']);
        const idxItems = findCol(['itens', 'pares', 'quant', 'qtd', 'volume']);
        const idxPA = findCol(['pa', 'peças/atend', 'atend', 'peças por atend']);
        const idxPU = findCol(['pu', 'preço médio', 'preço unitário', 'unitario']);
        const idxTicket = findCol(['ticket', 'ticket médio', 'medio']);
        const idxInadimp = findCol(['inadimp', 'atraso', 'inad', 'devedor']);
        const idxDays = findCol(['dias', 'úteis', 'uteis', 'calendario']); 

        const parsedData: MonthlyPerformance[] = [];

        // Busca metas para auxiliar no preenchimento
        const { data: monthlyGoals } = await supabase
            .from('monthly_goals')
            .select('*')
            .eq('year', parseInt(selectedMonth.split('-')[0]))
            .eq('month', parseInt(selectedMonth.split('-')[1]));

        for (let i = headerIdx + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0 || !row[idxStore]) continue;

            const storeRaw = String(row[idxStore]).trim();
            const storeNumFromExcel = storeRaw.replace(/\D/g, '').replace(/^0+/, '');
            
            const targetStore = stores.find(s => {
                const sNum = (s.number || '').replace(/\D/g, '').replace(/^0+/, '');
                return sNum === storeNumFromExcel;
            });

            if (targetStore) {
                const cleanNum = (val: any) => {
                    if (val === undefined || val === null || val === '') return 0;
                    let str = String(val).replace(/R\$|\s|%/g, '');
                    if (str.includes(',') && str.includes('.')) {
                        str = str.replace(/\./g, '').replace(',', '.');
                    } else if (str.includes(',')) {
                        str = str.replace(',', '.');
                    }
                    const num = parseFloat(str);
                    return isNaN(num) ? 0 : num;
                };

                const revenueActual = cleanNum(row[idxRevenue]);
                const goal = monthlyGoals?.find(g => g.store_id === targetStore.id);
                
                const revenueTarget = Number(goal?.revenue_target || 0);
                const itemsTarget = Number(goal?.items_target || 0);
                const paTarget = Number(goal?.pa_target || 0);
                const puTarget = Number(goal?.pu_target || 0);
                const ticketTarget = Number(goal?.ticket_target || 0);
                const delinquencyTarget = Number(goal?.delinquency_target || 2.0);

                const businessDaysImported = idxDays !== -1 ? parseInt(String(row[idxDays])) : Number(goal?.business_days || 26);

                parsedData.push({
                    storeId: targetStore.id,
                    month: selectedMonth,
                    revenueActual,
                    revenueTarget,
                    itemsActual: cleanNum(row[idxItems]),
                    itemsTarget,
                    itemsPerTicket: cleanNum(row[idxPA]), 
                    paTarget,
                    unitPriceAverage: cleanNum(row[idxPU]), 
                    puTarget,
                    averageTicket: cleanNum(row[idxTicket]), 
                    ticketTarget,
                    delinquencyRate: cleanNum(row[idxInadimp]),
                    delinquencyTarget,
                    percentMeta: revenueTarget > 0 ? (revenueActual / revenueTarget) * 100 : 0,
                    trend: goal?.trend || 'stable',
                    correctedDailyGoal: 0,
                    businessDays: isNaN(businessDaysImported) ? 26 : businessDaysImported
                });
            }
        }

        if (parsedData.length > 0) {
            await onImportData(parsedData);
            setShowImportModal(false);
            setSelectedFile(null);
            alert(`Sucesso! ${parsedData.length} unidades atualizadas.`);
        } else {
            alert("Nenhuma loja encontrada na planilha que coincida com os números cadastrados no sistema.");
        }
    } catch (err: any) {
        console.error("Erro no processamento:", err);
        alert("Erro no processamento da planilha: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-16">
       {/* Cards de KPIs */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
           <div className="bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
               <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-xl"><TrendingUp size={16}/></div>
                    <span className="text-[8px] md:text-[9px] font-black text-blue-400 uppercase tracking-widest text-right leading-none">Realizado</span>
               </div>
               <div>
                   <h3 className="text-xl md:text-2xl font-black italic text-gray-900 tracking-tighter leading-none">{formatCurrency(networkStats.totalRevenue)}</h3>
                   <div className="mt-1 flex items-center gap-2">
                       <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${networkStats.percentMeta >= 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                           {networkStats.percentMeta.toFixed(1)}%
                       </span>
                   </div>
               </div>
           </div>
           <div className="bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
               <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-red-50 text-red-600 rounded-xl"><Target size={16}/></div>
                    <span className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest text-right leading-none">Meta Rede</span>
               </div>
               <div>
                   <h3 className="text-xl md:text-2xl font-black italic text-gray-900 tracking-tighter leading-none">{formatCurrency(networkStats.totalTarget)}</h3>
                   <p className="text-[8px] font-black text-red-500 mt-1 uppercase">Gap: {formatCurrency(Math.max(0, networkStats.diff))}</p>
               </div>
           </div>
           <div className="bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
               <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-green-50 text-green-600 rounded-xl"><Users size={16}/></div>
                    <span className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Unidades</span>
               </div>
               <div>
                   <h3 className="text-xl md:text-2xl font-black italic text-gray-900 tracking-tighter leading-none">{networkStats.activeCount} Lojas</h3>
               </div>
           </div>
           <div className="bg-gray-900 p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-xl flex flex-col justify-between text-white border-t-2 border-blue-500">
               <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-white/10 text-blue-400 rounded-xl"><Zap size={16}/></div>
                    <span className="text-[8px] md:text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none">Ritmo</span>
               </div>
               <div>
                   <h3 className="text-xl md:text-2xl font-black italic tracking-tighter text-blue-400 leading-none">{formatCurrency(networkStats.currentRhythm)}</h3>
                   <p className="text-[8px] font-black text-gray-500 mt-1 uppercase">Falta: {formatCurrency(networkStats.neededRhythm)}/dia</p>
               </div>
           </div>
       </div>

       {/* Barra de Ações */}
       <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-4 md:p-5 rounded-2xl md:rounded-[32px] shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-blue-700 hidden sm:block" size={24} />
            <h2 className="text-xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">
                Confronto <span className="text-red-600">Performance</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
             <div className="flex-1 sm:flex-none flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                <select value={parseInt(selectedMonth.split('-')[1])} onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))} className="bg-transparent text-gray-800 font-black outline-none cursor-pointer px-1 uppercase text-[10px]">
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="w-px h-3 bg-gray-300"></div>
                <select value={parseInt(selectedMonth.split('-')[0])} onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))} className="bg-transparent text-gray-800 font-black outline-none cursor-pointer px-1 text-[10px]">
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
             </div>
             <button onClick={() => setShowImportModal(true)} className="flex items-center justify-center gap-1.5 bg-green-600 text-white px-4 py-2.5 rounded-xl hover:bg-green-700 shadow-md font-black uppercase text-[9px] tracking-widest transition-all">
                <Upload size={12} /> Importar Excel
             </button>
          </div>
       </div>

       {/* Tabela de Resultados */}
       <div className="bg-white rounded-2xl md:rounded-[32px] shadow-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[1100px] border-collapse">
                <thead>
                    <tr className="bg-gray-50/50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                        <th className="px-5 py-3 w-16 text-center">Rank</th>
                        <th className="px-5 py-3 sticky left-0 bg-gray-50/90 backdrop-blur z-20">Unidade</th>
                        <th className="px-4 py-3 text-right">Realizado</th>
                        <th className="px-4 py-3 text-right">Meta</th>
                        <th className="px-4 py-3 text-center">Atingimento</th>
                        <th className="px-4 py-3 text-center">P.A.</th>
                        <th className="px-4 py-3 text-center">P.U.</th>
                        <th className="px-4 py-3 text-center">Ticket</th>
                        <th className="px-4 py-3 text-center">Dias</th>
                        <th className="px-4 py-3 text-center">Inad.</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rankedStores.map((item, idx) => (
                        <tr key={item.storeId} className="hover:bg-blue-50/30 transition-all group">
                            <td className="px-5 py-3 text-center">
                                <span className={`text-base font-black italic ${idx < 3 ? 'text-yellow-500' : 'text-gray-300'}`}>#{item.rank}</span>
                            </td>
                            <td className="px-5 py-3 sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 shadow-sm">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-gray-900 uppercase italic tracking-tighter leading-none">LOJA {item.storeNumber}</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase truncate max-w-[120px]">{item.storeName}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-right font-black text-blue-900 text-[11px]"> {formatCurrency(item.revenueActual)} </td>
                            <td className="px-4 py-3 text-right font-black text-gray-400 text-[11px] italic"> {formatCurrency(item.revenueTarget)} </td>
                            <td className="px-4 py-3 text-center"> <span className={`text-sm font-black italic tracking-tighter ${item.percentMeta >= 100 ? 'text-green-600' : 'text-red-600'}`}> {item.percentMeta.toFixed(1)}% </span> </td>
                            <td className="px-4 py-3 text-center"> <span className="text-[11px] font-black text-gray-700">{formatDecimal(item.itemsPerTicket)}</span> </td>
                            <td className="px-4 py-3 text-center"> <span className="text-[11px] font-black text-gray-700">{formatCurrency(item.unitPriceAverage)}</span> </td>
                            <td className="px-4 py-3 text-center"> <span className="text-[11px] font-black text-gray-700">{formatCurrency(item.averageTicket)}</span> </td>
                            <td className="px-4 py-3 text-center"> <span className="text-[11px] font-black text-gray-500">{item.businessDays}</span> </td>
                            <td className="px-4 py-3 text-center"> <span className={`text-[11px] font-black ${item.delinquencyRate > item.delinquencyTarget ? 'text-red-600' : 'text-green-600'}`}>{item.delinquencyRate.toFixed(1)}%</span> </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
       </div>

       {/* Modal de Importação */}
       {showImportModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300 border-t-4 border-green-600">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Importar <span className="text-green-600">Dados Reais</span></h3>
                        <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-red-600 transition-all"><X size={20}/></button>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                    <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center mb-6 cursor-pointer transition-all ${selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50 hover:bg-white hover:border-blue-300'}`}>
                        {selectedFile ? <CheckCircle size={32} className="text-green-500 mb-2" /> : <FileSpreadsheet size={32} className="text-gray-200 mb-2" />}
                        <span className="text-[9px] font-black uppercase text-gray-500 text-center">{selectedFile ? selectedFile.name : 'Selecionar Planilha'}</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowImportModal(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-black uppercase text-[9px] text-gray-500 hover:bg-gray-200 transition-all">Sair</button>
                        <button onClick={handleProcessImport} disabled={!selectedFile || isProcessing} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50 transition-all">
                            {isProcessing ? <Loader2 className="animate-spin" size={14}/> : 'Processar'}
                        </button>
                    </div>
                </div>
            </div>
       )}
    </div>
  );
};

export default DashboardAdmin;
