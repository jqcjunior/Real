
import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { 
    LayoutDashboard, Calculator, DollarSign, Calendar, TrendingUp, TrendingDown, 
    Upload, FileSpreadsheet, X, Search, Info, BarChart3, Users, Zap, 
    ChevronRight, BrainCircuit, Sparkles, Loader2, ShoppingBag, Target, AlertTriangle,
    Clock, ArrowUpRight, ShieldCheck, CheckCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardAdminProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onImportData: (data: MonthlyPerformance[]) => Promise<void>; 
}

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, onImportData }) => {
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
          const revenueActual = Number(perf?.revenueActual || 0);
          const revenueTarget = Number(perf?.revenueTarget || 0);
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
              itemsTarget: Number(perf?.itemsTarget || 0),
              itemsPerTicket: Number(perf?.itemsPerTicket || 0),
              paTarget: Number(perf?.paTarget || 0),
              unitPriceAverage: Number(perf?.unitPriceAverage || 0),
              puTarget: Number(perf?.puTarget || 0),
              averageTicket: Number(perf?.averageTicket || 0),
              ticketTarget: Number(perf?.ticketTarget || 0),
              delinquencyRate: Number(perf?.delinquencyRate || 0),
              delinquencyTarget: Number(perf?.delinquencyTarget || 0),
              month: selectedMonth
          };
      });
  }, [performanceData, selectedMonth, stores]);

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
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
            const rowStr = jsonData[i].join(' ').toLowerCase();
            if (rowStr.includes('loja') || rowStr.includes('filial')) { headerIdx = i; break; }
        }

        if (headerIdx === -1) throw new Error("Cabeçalho não identificado.");

        const headerRow = jsonData[headerIdx].map(h => String(h || '').toLowerCase().trim());
        const findCol = (keys: string[]) => headerRow.findIndex(h => keys.some(k => h.includes(k)));

        const idxStore = findCol(['loja', 'filial', 'unidade']);
        const idxRevenue = findCol(['faturamento', 'venda', 'fat']);
        const idxItems = findCol(['itens', 'qtd', 'pares']);
        const idxPA = findCol(['pa', 'peças', 'atend']);
        const idxPU = findCol(['pu', 'preço unitário', 'preço médio']);
        const idxTicket = findCol(['ticket', 'médio']);
        const idxInadimp = findCol(['inadimp', 'atraso']);

        const parsedData: MonthlyPerformance[] = [];

        for (let i = headerIdx + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !row[idxStore]) continue;

            const storeRaw = String(row[idxStore]);
            const storeNum = storeRaw.replace(/\D/g, '').replace(/^0+/, '');
            const targetStore = stores.find(s => s.number === storeNum);

            if (targetStore) {
                const cleanNum = (val: any) => {
                    if (val === undefined || val === null || val === '') return 0;
                    const str = String(val).replace('R$', '').replace('%', '').replace(/\./g, '').replace(',', '.').trim();
                    const num = parseFloat(str);
                    return isNaN(num) ? 0 : num;
                };

                const revenueActual = cleanNum(row[idxRevenue]);
                const existing = performanceData.find(p => p.storeId === targetStore.id && p.month === selectedMonth);
                const revenueTarget = Number(existing?.revenueTarget || 0);

                parsedData.push({
                    storeId: targetStore.id,
                    month: selectedMonth,
                    revenueActual,
                    revenueTarget,
                    itemsActual: cleanNum(row[idxItems]),
                    itemsTarget: existing?.itemsTarget || 0,
                    itemsPerTicket: cleanNum(row[idxPA]),
                    paTarget: existing?.paTarget || 0,
                    unitPriceAverage: cleanNum(row[idxPU]),
                    puTarget: existing?.puTarget || 0,
                    averageTicket: cleanNum(row[idxTicket]),
                    ticketTarget: existing?.ticketTarget || 0,
                    delinquencyRate: cleanNum(row[idxInadimp]),
                    delinquencyTarget: existing?.delinquencyTarget || 2.0,
                    percentMeta: revenueTarget > 0 ? (revenueActual / revenueTarget) * 100 : 0,
                    trend: 'stable',
                    correctedDailyGoal: 0
                });
            }
        }

        if (parsedData.length > 0) {
            await onImportData(parsedData);
            setShowImportModal(false);
            setSelectedFile(null);
            alert("Dados confrontados com sucesso!");
        }
    } catch (err: any) {
        alert("Erro ao processar: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700 pb-20">
       
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col justify-between group hover:border-blue-200 transition-all">
               <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl"><TrendingUp size={20}/></div>
                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest text-right">Faturamento Realizado</span>
               </div>
               <div>
                   <h3 className="text-2xl font-black italic text-gray-900 tracking-tighter">{formatCurrency(networkStats.totalRevenue)}</h3>
                   <div className="mt-2 flex items-center gap-2">
                       <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${networkStats.percentMeta >= 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                           {networkStats.percentMeta.toFixed(1)}% da Meta
                       </span>
                   </div>
               </div>
           </div>

           <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col justify-between">
               <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-2xl"><Target size={20}/></div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Meta Definida Rede</span>
               </div>
               <div>
                   <h3 className="text-2xl font-black italic text-gray-900 tracking-tighter">{formatCurrency(networkStats.totalTarget)}</h3>
                   <p className="text-[9px] font-black text-red-500 mt-2 uppercase">Falta: {formatCurrency(Math.max(0, networkStats.diff))}</p>
               </div>
           </div>

           <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col justify-between">
               <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-2xl"><Users size={20}/></div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Unidades Ativas</span>
               </div>
               <div>
                   <h3 className="text-2xl font-black italic text-gray-900 tracking-tighter">{networkStats.activeCount} Lojas</h3>
                   <p className="text-[9px] font-black text-green-500 mt-2 uppercase tracking-widest">Rede em Operação</p>
               </div>
           </div>

           <div className="bg-gray-900 p-6 rounded-[32px] shadow-xl flex flex-col justify-between text-white border-t-4 border-blue-500">
               <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white/10 text-blue-400 rounded-2xl"><Zap size={20}/></div>
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Ritmo Realizado</span>
               </div>
               <div>
                   <h3 className="text-2xl font-black italic tracking-tighter text-blue-400">{formatCurrency(networkStats.currentRhythm)}</h3>
                   <p className="text-[9px] font-black text-gray-500 mt-2 uppercase">Necessário p/ bater meta: {formatCurrency(networkStats.neededRhythm)}/dia</p>
               </div>
           </div>
       </div>

       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic leading-none flex items-center gap-4">
                <BarChart3 className="text-blue-700" size={36} />
                Confronto de <span className="text-red-600">Resultados</span>
            </h2>
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-3 ml-1">Análise de Performance Meta x Real</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
             <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 shadow-inner">
                <Calendar className="text-blue-600 ml-2" size={18} />
                <select 
                    value={parseInt(selectedMonth.split('-')[1])} 
                    onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))} 
                    className="bg-transparent text-gray-800 font-black outline-none cursor-pointer px-2 uppercase text-xs"
                >
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                <select 
                    value={parseInt(selectedMonth.split('-')[0])} 
                    onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))} 
                    className="bg-transparent text-gray-800 font-black outline-none cursor-pointer px-2 text-xs"
                >
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
             </div>
             <button onClick={() => setShowImportModal(true)} className="flex items-center justify-center gap-2 bg-green-600 text-white px-8 py-3.5 rounded-2xl hover:bg-green-700 shadow-lg font-black uppercase text-[10px] tracking-widest border-b-4 border-green-800">
                <Upload size={16} /> Confrontar Planilha
             </button>
          </div>
       </div>

       <div className="bg-white rounded-[40px] shadow-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[1200px] border-collapse">
                <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                        <th className="px-8 py-6 w-20 text-center">Rank</th>
                        <th className="px-8 py-6 sticky left-0 bg-gray-50/90 backdrop-blur z-20 shadow-sm">Unidade / Loja</th>
                        <th className="px-6 py-6 text-right">Faturamento Real</th>
                        <th className="px-6 py-6 text-right">Meta Definida</th>
                        <th className="px-6 py-6 text-right text-red-600">Gap (Diferença)</th>
                        <th className="px-6 py-6 text-center">XP% Atingimento</th>
                        <th className="px-6 py-6 text-center">Peças/Atend.</th>
                        <th className="px-6 py-6 text-center">Inadimplência</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rankedStores.map((item, idx) => (
                        <tr key={item.storeId} className="hover:bg-blue-50/30 transition-all group">
                            <td className="px-8 py-6 text-center">
                                <span className={`text-xl font-black italic ${idx < 3 ? 'text-yellow-500' : 'text-gray-300'}`}>#{item.rank}</span>
                            </td>
                            <td className="px-8 py-6 sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 shadow-sm">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-gray-900 uppercase italic tracking-tighter leading-none mb-1">LOJA {item.storeNumber}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase truncate max-w-[150px]">{item.storeName}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-right font-black text-blue-900 text-sm">
                                {formatCurrency(item.revenueActual)}
                            </td>
                            <td className="px-6 py-6 text-right font-black text-gray-400 text-sm italic">
                                {formatCurrency(item.revenueTarget)}
                            </td>
                            <td className="px-6 py-6 text-right font-black text-red-600 text-sm">
                                {item.gap > 0 ? `-${formatCurrency(item.gap)}` : <span className="text-green-600">Meta Batida</span>}
                            </td>
                            <td className="px-6 py-6 text-center">
                                <span className={`text-lg font-black italic tracking-tighter ${item.percentMeta >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.percentMeta.toFixed(1)}%
                                </span>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <span className="text-sm font-black text-gray-700">{formatDecimal(item.itemsPerTicket)}</span>
                                <span className="block text-[8px] font-bold text-gray-300 uppercase">META: {formatDecimal(item.paTarget)}</span>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <span className={`text-sm font-black ${item.delinquencyRate > item.delinquencyTarget ? 'text-red-600' : 'text-green-600'}`}>{item.delinquencyRate.toFixed(2)}%</span>
                                <span className="block text-[8px] font-bold text-gray-300 uppercase">LIMITE: {item.delinquencyTarget}%</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
       </div>

       {showImportModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
                <div className="bg-white rounded-[48px] p-10 max-w-md w-full shadow-2xl animate-in zoom-in duration-300 border-t-8 border-green-600">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Importar <span className="text-green-600">Performance</span></h3>
                        <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                    
                    <div 
                        onClick={() => !isProcessing && fileInputRef.current?.click()}
                        className={`border-4 border-dashed rounded-[32px] p-12 flex flex-col items-center justify-center mb-8 cursor-pointer transition-all ${selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50 hover:bg-white hover:border-blue-300'}`}
                    >
                        {selectedFile ? <CheckCircle size={48} className="text-green-500 mb-2" /> : <FileSpreadsheet size={48} className="text-gray-200 mb-2" />}
                        <span className="text-[10px] font-black uppercase text-gray-500 text-center">
                            {selectedFile ? selectedFile.name : 'Selecione a planilha de faturamento (BI)'}
                        </span>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setShowImportModal(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-black uppercase text-[10px] text-gray-500">Cancelar</button>
                        <button 
                            onClick={handleProcessImport} 
                            disabled={!selectedFile || isProcessing} 
                            className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <Loader2 className="animate-spin" size={16}/> : 'Processar Agora'}
                        </button>
                    </div>
                </div>
            </div>
       )}
    </div>
  );
};

export default DashboardAdmin;
