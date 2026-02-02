import React, { useState, useMemo } from 'react';
import { User, Store, MonthlyPerformance, ProductPerformance } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { 
    ShoppingBag, DollarSign, Package, Hash, AlertCircle, Trophy, BarChart3, 
    TrendingUp, Target, Clock, BrainCircuit, Sparkles, Loader2, Zap, X 
} from 'lucide-react';
import { analyzePerformance } from '../services/geminiService';

interface DashboardManagerProps {
  user: User;
  stores: Store[];
  performanceData: MonthlyPerformance[];
  purchasingData: ProductPerformance[];
}

const GoalProgressBar = ({ percent }: { percent: number }) => {
  const safePercent = Math.min(Math.max(0, Number(percent) || 0), 120);
  const getBarColor = (p: number) => {
    if (p < 80) return 'bg-red-500';
    if (p < 95) return 'bg-yellow-500';
    if (p <= 105) return 'bg-green-500';
    return 'bg-blue-500';
  };
  return (
    <div className="space-y-1 mt-1.5">
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden shadow-inner">
        <div className={`h-full transition-all duration-1000 ease-out ${getBarColor(safePercent)}`} style={{ width: `${Math.min(safePercent, 100)}%` }} />
      </div>
      <div className={`text-right text-[9px] font-black italic text-blue-700`}>{safePercent.toFixed(1)}%</div>
    </div>
  );
};

const KPIHighlightCard = ({ label, value, target, icon: Icon, type = 'currency', invertColor = false }: { label: string, value: number, target?: number, icon: any, type?: 'currency' | 'decimal' | 'percent' | 'integer', invertColor?: boolean }) => {
  const safeValue = value || 0;
  const isSuccess = target ? (invertColor ? safeValue <= target : safeValue >= target) : true;
  const colorClass = target ? (isSuccess ? 'text-green-600' : 'text-red-600') : 'text-blue-900';
  
  const formatValue = (v: any) => {
    if (v === undefined || v === null) return '---';
    const num = Number(v);
    if (isNaN(num)) return '---';
    
    if (type === 'currency') return formatCurrency(num);
    if (type === 'percent') return `${num.toFixed(1)}%`;
    if (type === 'decimal') return formatDecimal(num);
    if (type === 'integer') return Math.round(num).toString();
    return formatDecimal(num);
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[32px] shadow-sm border border-gray-100 flex flex-col justify-between hover:border-blue-200 transition-all group min-h-[140px] md:min-h-[160px]">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2.5 bg-gray-50 ${colorClass} rounded-xl group-hover:scale-110 transition-transform shadow-sm`}><Icon size={18} /></div>
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
      </div>
      <div>
        <h3 className={`text-xl md:text-2xl font-black italic tracking-tighter leading-none ${colorClass}`}>
          {formatValue(safeValue)}
        </h3>
        {target !== undefined && (
          <div className="mt-2 pt-2 border-t border-gray-50 flex flex-col">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Meta: {formatValue(target)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardManager: React.FC<DashboardManagerProps> = ({ user, stores, performanceData }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const myStore = useMemo(() => {
    if (!stores || stores.length === 0) return null;
    return stores.find(s => s.id === user.storeId) || stores[0];
  }, [stores, user.storeId]);

  const myData = useMemo(() => {
    if (!performanceData || !myStore) return null;
    return performanceData.find(p => p.storeId === myStore.id && p.month === selectedMonth);
  }, [performanceData, selectedMonth, myStore]);

  const timeStats = useMemo(() => {
      const now = new Date();
      const isCurrentMonth = selectedMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const day = isCurrentMonth ? now.getDate() : 30; 
      const parts = selectedMonth.split('-');
      const totalDays = new Date(Number(parts[0]), Number(parts[1]), 0).getDate();
      const remaining = Math.max(0, totalDays - day);
      
      return { day, totalDays, remaining, isCurrentMonth };
  }, [selectedMonth]);

  const unitStats = useMemo(() => {
      if (!myData) return { currentRhythm: 0, neededRhythm: 0 };
      const currentRhythm = (myData.revenueActual || 0) / (timeStats.day || 1);
      const missing = Math.max(0, (myData.revenueTarget || 0) - (myData.revenueActual || 0));
      const neededRhythm = timeStats.remaining > 0 ? missing / timeStats.remaining : 0;
      return { currentRhythm, neededRhythm };
  }, [myData, timeStats]);

  const weightedRanking = useMemo(() => {
      if (!performanceData || !stores) return [];
      const results = performanceData
        .filter(p => p.month === selectedMonth)
        .map(item => {
            const s = stores.find(st => st.id === item.storeId);
            if (!s) return null;
            return {
                id: s.id,
                number: s.number,
                name: s.name,
                percentMeta: Number(item.percentMeta) || 0,
                revenueActual: Number(item.revenueActual) || 0,
                isMine: s.id === myStore?.id
            };
        })
        .filter(Boolean) as any[];
      return results.sort((a, b) => b.percentMeta - a.percentMeta).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [performanceData, selectedMonth, stores, myStore]);

  const handleGenerateInsight = async () => {
    if (!myStore) return;
    setIsLoadingAi(true);
    try {
        const insight = await analyzePerformance(performanceData, stores, 'MANAGER', myStore.id);
        setAiInsight(insight);
    } catch (e) { 
        alert("Erro ao conectar com o Gemini AI."); 
    } finally { 
        setIsLoadingAi(false); 
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-16 min-h-full">
        
        {/* RITMO DIÁRIO COMPACTO */}
        <div className="grid grid-cols-3 gap-1 bg-blue-950 p-1 rounded-2xl md:rounded-[24px] shadow-xl overflow-hidden border border-white/10">
           <div className="bg-white/5 px-3 py-3 rounded-xl flex flex-col items-center justify-center border border-white/5">
               <span className="text-[8px] font-black text-blue-300 uppercase tracking-widest leading-none mb-1">Ritmo Atual</span>
               <p className="text-sm md:text-base font-black text-white italic leading-none">{formatCurrency(unitStats.currentRhythm)}<span className="text-[8px] not-italic text-blue-400 ml-0.5">/dia</span></p>
           </div>
           
           <div className="bg-white/5 px-3 py-3 rounded-xl flex flex-col items-center justify-center border border-white/5">
               <span className="text-[8px] font-black text-blue-300 uppercase tracking-widest leading-none mb-1">Meta Faltante</span>
               <p className="text-sm md:text-base font-black text-white italic leading-none">{formatCurrency(unitStats.neededRhythm)}<span className="text-[8px] not-italic text-blue-400 ml-0.5">/dia</span></p>
           </div>

           <div className="bg-white/10 px-3 py-3 rounded-xl flex flex-col items-center justify-center border border-white/10">
               <span className="text-[8px] font-black text-blue-300 uppercase tracking-widest leading-none mb-1">Operação</span>
               <p className="text-sm md:text-base font-black text-white italic leading-none">{timeStats.remaining} <span className="text-[8px] not-italic text-blue-400 ml-0.5 uppercase">Dias</span></p>
           </div>
        </div>

        {/* CABEÇALHO COMPRIMIDO */}
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-700 rounded-2xl text-white shadow-md"><ShoppingBag size={24} /></div>
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 uppercase italic leading-none flex items-center gap-2">
                        {myStore?.name || 'Unidade'} <span className="text-red-600">#{myStore?.number || '---'}</span>
                    </h2>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1.5 leading-none">Dashboard Unidade Real</p>
                </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 shadow-inner flex flex-col items-center">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Período</span>
                <span className="text-[10px] font-black text-blue-900 uppercase italic">{selectedMonth}</span>
            </div>
        </div>

        {myData ? (
            <div className="space-y-4 md:space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                    <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[32px] shadow-sm border border-gray-100 group overflow-hidden relative flex flex-col justify-between min-h-[140px] md:min-h-[160px]">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={48}/></div>
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Faturamento</p>
                            <h3 className="text-xl md:text-2xl font-black text-gray-900 leading-none">{formatCurrency(myData.revenueActual)}</h3>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-gray-400 uppercase leading-none">Meta: {formatCurrency(myData.revenueTarget)}</p>
                            <GoalProgressBar percent={myData.percentMeta} />
                        </div>
                    </div>

                    <KPIHighlightCard label="Itens Vendidos" value={myData.itemsActual || 0} target={myData.itemsTarget} icon={Package} type="integer" />
                    <KPIHighlightCard label="P.A (Peças/Atend.)" value={myData.itemsPerTicket} target={myData.paTarget} icon={Hash} type="decimal" />
                    <KPIHighlightCard label="Ticket Médio" value={myData.averageTicket} target={myData.ticketTarget} icon={ShoppingBag} type="currency" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
                    <KPIHighlightCard label="Preço Médio" value={myData.unitPriceAverage} target={myData.puTarget} icon={DollarSign} type="currency" invertColor />
                    <KPIHighlightCard label="Inadimplência" value={myData.delinquencyRate} target={myData.delinquencyTarget} icon={AlertCircle} type="percent" invertColor />
                    
                    <div className="bg-gray-900 p-5 md:p-6 rounded-2xl md:rounded-[32px] shadow-2xl flex flex-col justify-center items-center text-center group cursor-pointer hover:bg-black transition-all border-b-4 border-blue-600" onClick={handleGenerateInsight}>
                        {isLoadingAi ? <Loader2 className="animate-spin text-white" size={24} /> : (
                            <>
                                <div className="p-2 bg-white/10 text-blue-400 rounded-xl mb-2 group-hover:scale-110 transition-transform"><Sparkles size={20}/></div>
                                <p className="text-[9px] font-black text-white uppercase tracking-widest leading-tight">Insight Gemini AI</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        ) : (
            <div className="p-12 text-center bg-white rounded-2xl md:rounded-[32px] shadow-sm border-2 border-dashed border-gray-100">
                <AlertCircle className="mx-auto text-gray-200 mb-4" size={48} />
                <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Aguardando dados de meta para {selectedMonth}</p>
            </div>
        )}
        
        {/* RANKING SLIM */}
        <div className="max-w-4xl mx-auto pt-4 md:pt-6">
            <div className="bg-white rounded-2xl md:rounded-[32px] shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-black uppercase italic text-gray-900 tracking-tighter flex items-center gap-2">
                        <Trophy className="text-yellow-500" size={20}/> Ranking <span className="text-blue-700">Corporativo</span>
                    </h3>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                <th className="px-6 py-4 text-center w-16">Rank</th>
                                <th className="px-6 py-4">Unidade</th>
                                <th className="px-6 py-4 text-right">Atingimento</th>
                                <th className="px-6 py-4 text-center">Faturamento</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {weightedRanking.map((item) => (
                                <tr key={item.id} className={`transition-all ${item.isMine ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                                    <td className="px-6 py-3 text-center">
                                        <span className={`text-lg font-black italic ${item.rank <= 3 ? 'text-yellow-500' : 'text-gray-300'}`}>#{item.rank}</span>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex flex-col">
                                            <span className={`text-[11px] font-black uppercase italic tracking-tight ${item.isMine ? 'text-blue-900 underline' : 'text-gray-900'}`}>{item.number} - {item.name}</span>
                                            {item.isMine && <span className="text-[7px] font-black text-blue-600 uppercase mt-0.5 tracking-widest bg-blue-100 w-fit px-1.5 rounded-sm">Sua Loja</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <span className={`text-base font-black italic tracking-tighter ${item.percentMeta >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.percentMeta.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <span className="text-[10px] font-black text-gray-700">{formatCurrency(item.revenueActual)}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* MODAL IA COMPRIMIDO */}
        {aiInsight && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
               <div className="bg-white rounded-3xl md:rounded-[40px] w-full max-w-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-4 border-blue-600">
                    <div className="p-5 bg-gray-950 text-white flex justify-between items-center">
                        <h3 className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2"><Sparkles className="text-blue-400" size={20} /> Diagnóstico <span className="text-blue-400">Gemini</span></h3>
                        <button onClick={() => setAiInsight('')} className="hover:text-red-400 transition-colors"><X size={24} /></button>
                    </div>
                    <div className="p-6">
                        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 text-blue-900 text-[11px] md:text-xs font-medium leading-relaxed shadow-inner max-h-[50vh] overflow-y-auto no-scrollbar">
                            {aiInsight.split('\n').map((line, i) => <p key={i} className="mb-3">{line}</p>)}
                        </div>
                    </div>
                    <div className="p-5 bg-gray-50 border-t flex justify-center">
                        <button onClick={() => setAiInsight('')} className="px-10 py-3 bg-gray-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Entendido</button>
                    </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default DashboardManager;