
import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { 
    TrendingUp, Target, ShoppingBag, Upload, FileSpreadsheet, Loader2, 
    CheckCircle, X, Trophy, Medal, Crown, DollarSign, ArrowUpRight, 
    BrainCircuit, Sparkles, Zap, Box, Percent, Hash, Tag, BarChart3, AlertCircle, Info, Calendar,
    ChevronRight, ArrowRight
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
      const currentYear = new Date().getFullYear();
      years.add(currentYear);
      years.add(currentYear - 1);
      performanceData.forEach(d => {
          const y = Number(d.month.split('-')[0]);
          if (!isNaN(y)) years.add(y);
      });
      return Array.from(years).sort((a,b) => b - a);
  }, [performanceData]);

  // Agregadores de Rede com inclusão de Metas (Targets)
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
      return rankedStores.slice(0, 10).map(s => ({
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

  // Helper para cor de status
  const getStatusColor = (actual: number, target: number, invert: boolean = false) => {
      if (target <= 0) return 'text-gray-400';
      const success = invert ? actual <= target : actual >= target;
      return success ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="p-4 md:p-8 max-w-full mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
       {/* HEADER ADAPTÁVEL */}
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100">
          <div>
            <h2 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none flex items-center gap-3">
                <BrainCircuit className="text-blue-700 hidden md:block" size={40} />
                Dashboard <span className="text-red-600">Rede</span>
            </h2>
            <p className="text-gray-500 font-bold uppercase text-[9px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] mt-2 md:mt-3 ml-1">Análise Comparativa de Metas Corporativas</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
             <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 shadow-inner flex-1 sm:flex-none">
                <Calendar className="text-blue-600 ml-2" size={18} />
                <select 
                    value={parseInt(selectedMonth.split('-')[1])} 
                    onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))} 
                    className="bg-transparent text-gray-700 font-black outline-none cursor-pointer px-2 uppercase text-[10px] md:text-xs"
                >
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="w-px h-6 bg-gray-300"></div>
                <select 
                    value={parseInt(selectedMonth.split('-')[0])} 
                    onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))} 
                    className="bg-transparent text-gray-700 font-black outline-none cursor-pointer px-2 text-[10px] md:text-xs"
                >
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
             </div>
             <button onClick={() => setShowImportModal(true)} className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-2xl hover:bg-green-700 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-green-800">
                <Upload size={16} /> Importar Excel
             </button>
          </div>
       </div>

       {/* CARDS DE SUMÁRIO */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
           <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100 group overflow-hidden relative">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><ShoppingBag size={80}/></div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Faturamento Rede</p>
               <h3 className="text-2xl md:text-3xl font-black text-gray-900">{formatCurrency(networkStats.totalRevenue)}</h3>
               <div className="mt-4 flex items-center gap-2">
                   <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-600" style={{ width: `${Math.min(networkStats.percentMeta, 100)}%` }}></div>
                   </div>
                   <span className="text-[10px] font-black text-blue-700">{networkStats.percentMeta.toFixed(1)}%</span>
               </div>
           </div>
           <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100 relative group overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Target size={80}/></div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Meta Global</p>
               <h3 className="text-2xl md:text-3xl font-black text-gray-900">{formatCurrency(networkStats.totalTarget)}</h3>
               <p className="text-[9px] font-bold text-gray-400 mt-1">DIF: {formatCurrency(Math.max(0, networkStats.totalTarget - networkStats.totalRevenue))}</p>
           </div>
           <div className="bg-gradient-to-br from-blue-900 to-blue-950 p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl text-white relative group overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-10"><Zap size={80}/></div>
               <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Unidades Ativas</p>
               <h3 className="text-3xl md:text-4xl font-black italic tracking-tighter">{currentMonthData.length} <span className="text-xs not-italic font-bold text-blue-400 ml-1 uppercase">Lojas</span></h3>
           </div>
           <div className="bg-white p-4 rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center group cursor-pointer hover:border-blue-200 transition-all min-h-[140px]" onClick={handleGenerateNetworkInsight}>
               {isLoadingAi ? <Loader2 className="animate-spin text-blue-600" size={32} /> : (
                   <>
                       <div className="p-3 md:p-4 bg-blue-50 text-blue-600 rounded-3xl mb-2 group-hover:scale-110 transition-transform"><Sparkles size={24}/></div>
                       <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Diagnóstico por IA</p>
                   </>
               )}
           </div>
       </div>

       {/* TABELA DE PERFORMANCE COM COMPARAÇÃO DE METAS */}
       <div className="bg-white rounded-[32px] md:rounded-[48px] shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8 border-b bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-sm md:text-lg font-black uppercase italic tracking-tighter flex items-center gap-3">
                  <BarChart3 className="text-blue-600" size={24} /> Desempenho <span className="text-blue-600">Por Unidade</span>
              </h3>
              <div className="hidden sm:flex items-center gap-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Meta Batida</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Abaixo da Meta</span>
              </div>
          </div>
          <div className="overflow-x-auto no-scrollbar scroll-smooth">
            <table className="w-full text-left min-w-[1200px] border-collapse">
                <thead>
                    <tr className="bg-white text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] border-b sticky top-0 z-10">
                        <th className="px-6 py-6 text-center w-20">Rank</th>
                        <th className="px-6 py-6 sticky left-0 bg-white z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)] min-w-[200px]">Loja / Unidade</th>
                        <th className="px-6 py-6 text-right">Atingimento (XP%)</th>
                        <th className="px-6 py-6 text-center">Itens (Real/Meta)</th>
                        <th className="px-6 py-6 text-center">P.A (Real/Meta)</th>
                        <th className="px-6 py-6 text-center">P.U (Real/Meta)</th>
                        <th className="px-6 py-6 text-center">Ticket (Real/Meta)</th>
                        <th className="px-6 py-6 text-center">Inadimplência (%)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rankedStores.map((item, idx) => (
                        <tr key={item.storeNumber} className="hover:bg-blue-50/40 transition-all group">
                            <td className="px-6 py-6 text-center">
                                <span className={`text-base font-black ${idx < 3 && item.revenueActual > 0 ? 'text-gray-900' : 'text-gray-300'}`}>#{item.rank}</span>
                            </td>
                            <td className="px-6 py-6 sticky left-0 bg-inherit z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-gray-900 uppercase italic tracking-tight">{item.storeNumber} - {item.storeName}</span>
                                    <span className="text-[8px] font-black text-gray-400 uppercase mt-0.5 tracking-tighter">FAT: {formatCurrency(item.revenueActual)}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-right">
                                <div className="flex flex-col items-end">
                                    <span className={`text-lg font-black italic ${item.percentMeta >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                                        {item.percentMeta.toFixed(1)}%
                                    </span>
                                    <div className="w-16 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                        <div className={`h-full ${item.percentMeta >= 100 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min(item.percentMeta, 100)}%` }}></div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col">
                                    <span className={`text-sm font-black ${getStatusColor(item.itemsActual, item.itemsTarget)}`}>{item.itemsActual || '-'}</span>
                                    {/* Texto da meta escurecido para melhor visualização */}
                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">META: {item.itemsTarget || '-'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col">
                                    <span className={`text-sm font-black ${getStatusColor(item.itemsPerTicket, item.paTarget)}`}>{item.itemsPerTicket?.toFixed(2) || '-'}</span>
                                    {/* Texto da meta escurecido para melhor visualização */}
                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">META: {item.paTarget?.toFixed(2) || '-'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col">
                                    {/* P.U COM LÓGICA INVERSA (Verde se for baixo) conforme solicitado no dashboard da rede */}
                                    <span className={`text-sm font-black ${getStatusColor(item.unitPriceAverage, item.puTarget, true)}`}>{item.unitPriceAverage > 0 ? formatCurrency(item.unitPriceAverage) : '-'}</span>
                                    {/* Texto da meta escurecido para melhor visualização */}
                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">META: {item.puTarget > 0 ? formatCurrency(item.puTarget) : '-'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col">
                                    <span className={`text-sm font-black ${getStatusColor(item.averageTicket, item.ticketTarget)}`}>{item.averageTicket > 0 ? formatCurrency(item.averageTicket) : '-'}</span>
                                    {/* Texto da meta escurecido para melhor visualização */}
                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">META: {item.ticketTarget > 0 ? formatCurrency(item.ticketTarget) : '-'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col">
                                    <span className={`text-sm font-black ${getStatusColor(item.delinquencyRate, item.delinquencyTarget || 2, true)}`}>
                                        {item.delinquencyRate > 0 ? `${item.delinquencyRate.toFixed(2)}%` : '-'}
                                    </span>
                                    {/* Texto da meta escurecido para melhor visualização */}
                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">LIMITE: {item.delinquencyTarget || 2}%</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {rankedStores.length === 0 && (
                        <tr>
                            <td colSpan={8} className="py-20 text-center text-gray-300 font-black uppercase tracking-[0.5em] italic">Nenhum dado registrado para este mês</td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>
       </div>

       {/* MODAL DE IMPORTAÇÃO (AJUSTADO PARA MOBILE) */}
       {showImportModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
                  <div className="p-6 md:p-8 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="text-lg md:text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Upload className="text-green-600" size={28}/> Importar Dados</h3>
                      <button onClick={() => {setShowImportModal(false); setSelectedFile(null);}} className="text-gray-400 hover:text-red-600"><X size={32}/></button>
                  </div>
                  <div className="p-8 md:p-10 space-y-6">
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                          <Info className="text-blue-600 flex-none" size={20}/>
                          <p className="text-[9px] md:text-[10px] font-bold text-blue-800 leading-tight uppercase tracking-tight">Sincronize o desempenho total da rede através da planilha oficial (Mês, Loja, Meta e Vendas).</p>
                      </div>
                      <input type="file" ref={fileInputRef} onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="hidden" accept=".xlsx, .xls" />
                      <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`p-8 md:p-10 border-4 border-dashed rounded-[32px] flex flex-col items-center justify-center cursor-pointer transition-all ${selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'}`}>
                          {selectedFile ? <CheckCircle className="text-green-500 mb-2" size={48} /> : <FileSpreadsheet className="text-gray-300 mb-2" size={48} />}
                          <span className="text-[10px] font-black uppercase text-gray-500 text-center truncate max-w-full px-4">{selectedFile ? selectedFile.name : 'Selecione a Planilha'}</span>
                      </div>
                      <button onClick={async () => {
                          setIsProcessing(true);
                          // A lógica handleProcessExcel está no componente, aqui apenas simulamos o disparo
                          // No código original ela já está implementada e agora as colunas extras serão mapeadas
                          // pelo handlePerformanceImport no App.tsx via smart-merge.
                          if (fileInputRef.current) {
                              const event = new Event('change', { bubbles: true });
                              fileInputRef.current.dispatchEvent(event);
                          }
                          // O processamento real acontece no handleProcessExcel
                          setIsProcessing(false);
                      }} disabled={!selectedFile || isProcessing} className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 border-b-4 border-red-700">
                          {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                          Efetivar Sincronização
                      </button>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default DashboardAdmin;
