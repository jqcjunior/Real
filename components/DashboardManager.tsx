
import React, { useState, useMemo } from 'react';
import { User, Store, MonthlyPerformance, ProductPerformance } from '../types';
import { formatCurrency } from '../constants';
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
    <div className="space-y-1.5 mt-2">
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
        <div className={`h-full transition-all duration-1000 ease-out ${getBarColor(safePercent)}`} style={{ width: `${Math.min(safePercent, 100)}%` }} />
      </div>
      <div className={`text-right text-[10px] font-black italic text-blue-700`}>{safePercent.toFixed(1)}%</div>
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
    if (type === 'percent') return `${num.toFixed(2)}%`;
    if (type === 'decimal') return num.toFixed(2);
    return num.toString();
  };

  return (
    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col justify-between hover:border-blue-200 transition-all group min-h-[180px]">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-4 bg-gray-50 ${colorClass} rounded-3xl group-hover:scale-110 transition-transform shadow-sm`}><Icon size={24} /></div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
      </div>
      <div>
        <h3 className={`text-2xl md:text-3xl font-black italic tracking-tighter ${colorClass}`}>
          {formatValue(safeValue)}
        </h3>
        {target !== undefined && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">META: {formatValue(target)}</span>
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
        alert("Erro ao conectar com o motor de inteligência."); 
    } finally { 
        setIsLoadingAi(false); 
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700 pb-20 min-h-full">
        
        {/* RITMO DIÁRIO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1 bg-blue-950 p-1.5 rounded-[32px] shadow-2xl overflow-hidden border border-white/10">
           <div className="bg-white/5 backdrop-blur-md px-8 py-4 rounded-[26px] flex flex-col items-center justify-center border border-white/5 group hover:bg-white/10 transition-all">
               <div className="flex items-center gap-2 mb-1">
                   <TrendingUp size={14} className="text-green-400"/>
                   <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest">Ritmo Atual</span>
               </div>
               <p className="text-xl font-black text-white italic leading-none">{formatCurrency(unitStats.currentRhythm)}<span className="text-[10px] not-italic text-blue-400 ml-1">/dia</span></p>
           </div>
           
           <div className="bg-white/5 backdrop-blur-md px-8 py-4 rounded-[26px] flex flex-col items-center justify-center border border-white/5 group hover:bg-white/10 transition-all">
               <div className="flex items-center gap-2 mb-1">
                   <Target size={14} className="text-yellow-400"/>
                   <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest">Meta Diária Restante</span>
               </div>
               <p className="text-xl font-black text-white italic leading-none">{formatCurrency(unitStats.neededRhythm)}<span className="text-[10px] not-italic text-blue-400 ml-1">/dia</span></p>
           </div>

           <div className="bg-white/10 backdrop-blur-md px-8 py-4 rounded-[26px] flex flex-col items-center justify-center border border-white/10 group hover:bg-blue-600/20 transition-all">
               <div className="flex items-center gap-2 mb-1">
                   <Clock size={14} className="text-red-400"/>
                   <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest">Operação</span>
               </div>
               <p className="text-xl font-black text-white italic leading-none">{timeStats.remaining} <span className="text-[10px] not-italic text-blue-400 ml-1 uppercase">Dias Restantes</span></p>
           </div>
        </div>

        {/* CABEÇALHO */}
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-700 rounded-[24px] text-white shadow-lg"><ShoppingBag size={32} /></div>
                <div>
                    <h2 className="text-3xl font-black text-gray-900 uppercase italic leading-none flex items-center gap-3">
                        {myStore?.name || 'Unidade Real'} <span className="text-red-600 ml-2">#{myStore?.number || '---'}</span>
                    </h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3 ml-1">Dashboard de Unidade Estratégico</p>
                </div>
            </div>
            
            <div className="bg-gray-50 px-6 py-3 rounded-2xl border border-gray-200 shadow-inner flex flex-col items-center">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Mês de Referência</span>
                <span className="text-xs font-black text-blue-900 uppercase italic">{selectedMonth}</span>
            </div>
        </div>

        {myData ? (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 ml-4">
                    <BarChart3 className="text-blue-600" size={24} />
                    <h3 className="text-sm font-black uppercase italic text-gray-900 tracking-tighter">Performance <span className="text-blue-600">da Unidade</span></h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 group overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={80}/></div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Faturamento Atual</p>
                        <h3 className="text-3xl font-black text-gray-900">{formatCurrency(myData.revenueActual)}</h3>
                        <p className="text-[9px] font-black text-gray-400 mt-2 uppercase">META: {formatCurrency(myData.revenueTarget)}</p>
                        <GoalProgressBar percent={myData.percentMeta} />
                    </div>

                    <KPIHighlightCard label="Itens Vendidos" value={myData.itemsActual || 0} target={myData.itemsTarget} icon={Package} type="integer" />
                    <KPIHighlightCard label="P.A (Peças/Atend.)" value={myData.itemsPerTicket} target={myData.paTarget} icon={Hash} type="decimal" />
                    <KPIHighlightCard label="Ticket Médio" value={myData.averageTicket} target={myData.ticketTarget} icon={ShoppingBag} type="currency" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <KPIHighlightCard label="Preço Médio (P.U)" value={myData.unitPriceAverage} target={myData.puTarget} icon={DollarSign} type="currency" invertColor />
                    <KPIHighlightCard label="Inadimplência" value={myData.delinquencyRate} target={myData.delinquencyTarget} icon={AlertCircle} type="percent" invertColor />
                    
                    <div className="bg-gray-900 p-8 rounded-[40px] shadow-2xl flex flex-col justify-center items-center text-center group cursor-pointer hover:bg-black transition-all" onClick={handleGenerateInsight}>
                        {isLoadingAi ? <Loader2 className="animate-spin text-white" size={32} /> : (
                            <>
                                <div className="p-4 bg-white/10 text-blue-400 rounded-3xl mb-3 group-hover:scale-110 transition-transform shadow-lg"><Sparkles size={28}/></div>
                                <p className="text-[11px] font-black text-white uppercase tracking-widest leading-tight">Diagnóstico Inteligente <br/><span className="text-blue-400 text-[9px]">Gere agora via Gemini AI</span></p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        ) : (
            <div className="p-20 text-center bg-white rounded-[48px] shadow-sm border-2 border-dashed border-gray-100">
                <AlertCircle className="mx-auto text-gray-200 mb-6" size={64} />
                <p className="text-gray-400 font-black uppercase text-xs tracking-widest">Nenhuma meta configurada para o período {selectedMonth}</p>
            </div>
        )}
        
        {/* RANKING */}
        <div className="max-w-5xl mx-auto pt-8">
            <div className="bg-white rounded-[48px] shadow-2xl border border-gray-100 overflow-hidden">
                <div className="p-10 border-b bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-xl font-black uppercase italic text-gray-900 tracking-tighter flex items-center gap-4">
                        <Trophy className="text-yellow-500" size={32}/> Ranking <span className="text-blue-700">Corporativo Rede</span>
                    </h3>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b">
                                <th className="px-10 py-8 text-center w-24">Rank</th>
                                <th className="px-10 py-8">Unidade</th>
                                <th className="px-10 py-8 text-right">Atingimento (XP%)</th>
                                <th className="px-10 py-8 text-center">Faturamento Real</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {weightedRanking.map((item) => (
                                <tr key={item.id} className={`transition-all ${item.isMine ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                                    <td className="px-10 py-8 text-center">
                                        <span className={`text-2xl font-black italic ${item.rank <= 3 ? 'text-yellow-500' : 'text-gray-300'}`}>#{item.rank}</span>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex flex-col">
                                            <span className={`text-base font-black uppercase italic tracking-tight ${item.isMine ? 'text-blue-900 underline' : 'text-gray-900'}`}>{item.number} - {item.name}</span>
                                            {item.isMine && <span className="text-[8px] font-black text-blue-600 uppercase mt-1 tracking-widest bg-blue-100 w-fit px-2 py-0.5 rounded">Sua Loja</span>}
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        <span className={`text-2xl font-black italic tracking-tighter ${item.percentMeta >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.percentMeta.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-10 py-8 text-center">
                                        <span className="text-sm font-black text-gray-700">{formatCurrency(item.revenueActual)}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* MODAL IA */}
        {aiInsight && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
               <div className="bg-white rounded-[48px] w-full max-w-2xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-blue-600">
                    <div className="p-8 bg-gray-950 text-white flex justify-between items-center">
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3"><Sparkles className="text-blue-400" /> Diagnóstico <span className="text-blue-400">Inteligente</span></h3>
                        <button onClick={() => setAiInsight('')} className="hover:text-red-400 transition-colors"><X className="w-8 h-8" /></button>
                    </div>
                    <div className="p-10">
                        <div className="bg-blue-50 p-8 rounded-[32px] border border-blue-100 text-blue-900 font-medium leading-relaxed shadow-inner max-h-[60vh] overflow-y-auto no-scrollbar">
                            {aiInsight.split('\n').map((line, i) => <p key={i} className="mb-4">{line}</p>)}
                        </div>
                    </div>
                    <div className="p-8 bg-gray-50 border-t flex justify-center">
                        <button onClick={() => setAiInsight('')} className="px-16 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Fechar Análise</button>
                    </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default DashboardManager;
