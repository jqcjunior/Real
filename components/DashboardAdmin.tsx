
import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { 
    TrendingUp, Target, ShoppingBag, Upload, FileSpreadsheet, Loader2, 
    CheckCircle, X, Trophy, Medal, Crown, DollarSign, ArrowUpRight, 
    BrainCircuit, Sparkles, Zap, Box, Percent, Hash, Tag, BarChart3, AlertCircle, Info
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    Legend, ComposedChart, Line, Area, AreaChart 
} from 'recharts';
import * as XLSX from 'xlsx';
import { analyzePerformance } from '../services/geminiService';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const handleMonthYearChange = (type: 'month' | 'year', value: number) => {
      const [currentY, currentM] = selectedMonth.split('-');
      let newY = Number(currentY);
      let newM = Number(currentM);
      if (type === 'month') newM = value;
      if (type === 'year') newY = value;
      setSelectedMonth(`${newY}-${String(newM).padStart(2, '0')}`);
  };

  const availableYears = useMemo(() => {
      const years = new Set<number>();
      years.add(new Date().getFullYear());
      performanceData.forEach(d => years.add(Number(d.month.split('-')[0])));
      return Array.from(years).sort((a,b) => b - a);
  }, [performanceData]);

  // Lógica de Rede Total: Mapeia todas as lojas ativas para garantir exibição total no dashboard
  const currentMonthData = useMemo(() => {
      const activeStores = (stores || []).filter(s => s.status === 'active');
      const monthlyPerf = (performanceData || []).filter(p => p.month === selectedMonth);
      
      return activeStores.map(store => {
          const perf = monthlyPerf.find(p => p.storeId === store.id);
          return {
              id: perf?.id || store.id,
              storeId: store.id,
              storeName: store.name,
              storeNumber: store.number,
              revenueTarget: Number(perf?.revenueTarget || 0),
              revenueActual: Number(perf?.revenueActual || 0),
              percentMeta: Number(perf?.percentMeta || 0),
              itemsActual: Number(perf?.itemsActual || 0),
              itemsPerTicket: Number(perf?.itemsPerTicket || 0),
              unitPriceAverage: Number(perf?.unitPriceAverage || 0),
              averageTicket: Number(perf?.averageTicket || 0),
              delinquencyRate: Number(perf?.delinquencyRate || 0),
              month: selectedMonth
          };
      });
  }, [performanceData, selectedMonth, stores]);

  const rankedStores = useMemo(() => {
      return [...currentMonthData]
        .sort((a, b) => (Number(b.percentMeta) || 0) - (Number(a.percentMeta) || 0))
        .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [currentMonthData]);

  const networkStats = useMemo(() => {
      const totalRevenue = currentMonthData.reduce((acc, curr) => acc + (Number(curr.revenueActual) || 0), 0);
      const totalTarget = currentMonthData.reduce((acc, curr) => acc + (Number(curr.revenueTarget) || 0), 0);
      const percentMeta = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
      return { totalRevenue, totalTarget, percentMeta };
  }, [currentMonthData]);

  const chartData = useMemo(() => {
      return (rankedStores || []).slice(0, 10).map(s => ({
          name: s.storeNumber,
          Meta: Number(s.revenueTarget) || 0,
          Real: Number(s.revenueActual) || 0,
          XP: Number(s.percentMeta) || 0
      }));
  }, [rankedStores]);

  const handleGenerateNetworkInsight = async () => {
      setIsLoadingAi(true);
      try {
          const insight = await analyzePerformance(performanceData, stores, 'ADMIN');
          setAiInsight(insight);
      } catch (e) { alert("Erro ao gerar análise."); } finally { setIsLoadingAi(false); }
  };

  return (
    <div className="p-8 max-w-full mx-auto space-y-8 animate-in fade-in duration-700">
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none flex items-center gap-3">
                <BrainCircuit className="text-blue-700" size={40} />
                Rede <span className="text-red-600">Completa</span>
            </h2>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-3 ml-1">Monitoramento Administrativo de Todas as Unidades</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                <select value={parseInt(selectedMonth.split('-')[1])} onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-black outline-none cursor-pointer px-2 uppercase text-xs">
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="w-px h-4 bg-gray-200"></div>
                <select value={parseInt(selectedMonth.split('-')[0])} onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-black outline-none cursor-pointer px-2 text-xs">
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
             </div>
             <button onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'metas' }))} className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-2xl hover:bg-black transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-red-600">
                <Target size={16} /> Definir Metas
             </button>
             <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-2xl hover:bg-green-700 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-green-800">
                <Upload size={16} /> Importar Excel
             </button>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 group overflow-hidden relative">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><ShoppingBag size={80}/></div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Faturamento Rede</p>
               <h3 className="text-3xl font-black text-gray-900">{formatCurrency(networkStats.totalRevenue)}</h3>
               <div className="mt-4 flex items-center gap-2">
                   <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-600" style={{ width: `${Math.min(networkStats.percentMeta, 100)}%` }}></div>
                   </div>
                   <span className="text-[10px] font-black text-blue-700">{networkStats.percentMeta.toFixed(1)}%</span>
               </div>
           </div>
           <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 relative group overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Target size={80}/></div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Meta Global</p>
               <h3 className="text-3xl font-black text-gray-900">{formatCurrency(networkStats.totalTarget)}</h3>
           </div>
           <div className="bg-gradient-to-br from-blue-900 to-blue-950 p-8 rounded-[40px] shadow-2xl text-white relative group overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-10"><Zap size={80}/></div>
               <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Unidades Ativas</p>
               <h3 className="text-4xl font-black italic tracking-tighter">{currentMonthData.length} <span className="text-sm not-italic font-bold text-blue-400">LOJAS</span></h3>
           </div>
           <div className="bg-white p-4 rounded-[40px] shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center group cursor-pointer hover:border-blue-200 transition-all" onClick={handleGenerateNetworkInsight}>
               {isLoadingAi ? <Loader2 className="animate-spin text-blue-600" size={32} /> : (
                   <>
                       <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl mb-2 group-hover:scale-110 transition-transform"><Sparkles size={24}/></div>
                       <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Diagnóstico por IA</p>
                   </>
               )}
           </div>
       </div>

       {aiInsight && (
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border-t-8 border-blue-600 relative animate-in slide-in-from-bottom duration-500">
                <button onClick={() => setAiInsight('')} className="absolute top-6 right-6 text-gray-400 hover:text-red-600 transition-colors"><X size={24}/></button>
                <div className="flex items-start gap-6 mb-8">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl"><BrainCircuit size={32}/></div>
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Insights do <span className="text-blue-600">Consultor IA</span></h3>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Análise baseada em desempenho de rede</p>
                    </div>
                </div>
                <div className="prose prose-blue max-w-none text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">
                    {aiInsight}
                </div>
            </div>
       )}

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-3">
                        <BarChart3 className="text-blue-600" size={24} /> Desempenho <span className="text-blue-600">Top 10 Lojas</span>
                    </h3>
                </div>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontStyle="bold" dy={10} />
                            <YAxis axisLine={false} tickLine={false} fontSize={10} tickFormatter={(v) => `R$${v/1000}k`} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                formatter={(v: number) => formatCurrency(v)}
                            />
                            <Bar dataKey="Real" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={40} />
                            <Bar dataKey="Meta" fill="#e5e7eb" radius={[10, 10, 0, 0]} barSize={40} />
                            <Line type="monotone" dataKey="XP" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 4 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-[48px] shadow-2xl text-white">
                <h3 className="text-lg font-black uppercase italic tracking-tighter mb-8 flex items-center gap-3">
                    <Trophy className="text-yellow-500" size={24} /> Hall da <span className="text-yellow-500">Fama</span>
                </h3>
                <div className="space-y-6">
                    {rankedStores.slice(0, 3).map((s, i) => (
                        <div key={s.storeNumber} className={`p-6 rounded-[32px] border-2 flex items-center gap-6 transition-all hover:scale-105 ${i === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : i === 1 ? 'bg-gray-400/10 border-gray-400/30' : 'bg-orange-50/10 border-orange-500/30'}`}>
                            <div className="relative">
                                {i === 0 ? <Crown size={40} className="text-yellow-500" /> : <Medal size={40} className={i === 1 ? 'text-gray-400' : 'text-orange-500'} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Loja {s.storeNumber}</p>
                                <p className="text-lg font-black uppercase italic truncate">{s.storeName}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-yellow-500" style={{ width: `${Math.min(s.percentMeta, 100)}%` }}></div>
                                    </div>
                                    <span className="text-[10px] font-black text-yellow-500">{s.percentMeta.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-10 p-6 bg-white/5 rounded-[32px] border border-white/10 text-center">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Média da Rede</p>
                    <p className="text-3xl font-black italic">{networkStats.percentMeta.toFixed(1)}%</p>
                </div>
            </div>
       </div>

       <div className="bg-white rounded-[48px] shadow-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[1400px]">
                <thead>
                    <tr className="bg-white text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] border-b">
                        <th className="px-6 py-6 text-center">Rank</th>
                        <th className="px-6 py-6">Loja / Unidade</th>
                        <th className="px-6 py-6 text-right">Faturamento</th>
                        <th className="px-6 py-6 text-center">XP (%)</th>
                        <th className="px-6 py-6 text-center">Real Itens</th>
                        <th className="px-6 py-6 text-center">P.A</th>
                        <th className="px-6 py-6 text-center">P.U</th>
                        <th className="px-6 py-6 text-center">Ticket</th>
                        <th className="px-6 py-6 text-center">Inadimp..</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rankedStores.map((item, idx) => (
                        <tr key={item.storeNumber} className="hover:bg-blue-50/40 transition-all group">
                            <td className="px-6 py-6 text-center">
                                <span className={`text-base font-black ${idx < 3 && item.revenueActual > 0 ? 'text-gray-900' : 'text-gray-300'}`}>#{item.rank}</span>
                            </td>
                            <td className="px-6 py-6">
                                <span className="text-sm font-black text-gray-900 uppercase italic tracking-tight">{item.storeNumber} - {item.storeName}</span>
                            </td>
                            <td className="px-6 py-6 text-right font-black text-gray-900">{formatCurrency(item.revenueActual)}</td>
                            <td className={`px-6 py-6 text-center font-black italic ${item.percentMeta === 0 ? 'text-gray-300' : ''}`}>{item.percentMeta.toFixed(1)}%</td>
                            <td className="px-6 py-6 text-center">{item.itemsActual?.toLocaleString() || '-'}</td>
                            <td className="px-6 py-6 text-center">{item.itemsPerTicket?.toFixed(2) || '-'}</td>
                            <td className="px-6 py-6 text-center">{item.unitPriceAverage > 0 ? formatCurrency(item.unitPriceAverage) : '-'}</td>
                            <td className="px-6 py-6 text-center">{item.averageTicket > 0 ? formatCurrency(item.averageTicket) : '-'}</td>
                            <td className="px-6 py-6 text-center">{item.delinquencyRate > 0 ? `${item.delinquencyRate.toFixed(2)}%` : '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
       </div>

       {showImportModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
                  <div className="p-8 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Upload className="text-green-600" size={28}/> Importar Dados</h3>
                      <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-red-600"><X size={32}/></button>
                  </div>
                  <div className="p-10 space-y-6">
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                          <Info className="text-blue-600 flex-none" size={20}/>
                          <p className="text-[10px] font-bold text-blue-800 leading-tight uppercase">Utilize o arquivo padrão de exportação do sistema de retaguarda (Pares, PA, PU, Ticket, Faturamento, Inadimp).</p>
                      </div>
                      <input type="file" ref={fileInputRef} onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="hidden" accept=".xlsx, .xls" />
                      <div onClick={() => fileInputRef.current?.click()} className={`p-10 border-4 border-dashed rounded-[32px] flex flex-col items-center justify-center cursor-pointer transition-all ${selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'}`}>
                          {selectedFile ? <CheckCircle className="text-green-500 mb-2" size={48} /> : <FileSpreadsheet className="text-gray-300 mb-2" size={48} />}
                          <span className="text-xs font-black uppercase text-gray-500 text-center">{selectedFile ? selectedFile.name : 'Selecione a Planilha'}</span>
                      </div>
                      <button onClick={() => setShowImportModal(false)} disabled={!selectedFile} className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50">Iniciar Sincronização Inteligente</button>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default DashboardAdmin;
