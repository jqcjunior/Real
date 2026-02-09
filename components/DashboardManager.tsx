import React, { useState, useMemo } from 'react';
import { User, Store, ProductPerformance } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { 
    ShoppingBag, DollarSign, Package, Hash, AlertCircle, Trophy, BarChart3, 
    TrendingUp, Target, Clock, BrainCircuit, Sparkles, Loader2, Zap, X, 
    TrendingDown, Minus
} from 'lucide-react';
import { analyzePerformance } from '../services/geminiService';

interface DashboardManagerProps {
  user: User;
  stores: Store[];
  performanceData: any[]; 
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
  const safeTarget = target || 0;
  const percentAtingimento = safeTarget > 0 ? (safeValue / safeTarget) * 100 : 0;
  const isSuccess = invertColor ? safeValue <= safeTarget : safeValue >= safeTarget;
  const colorClass = target ? (isSuccess ? 'text-green-600' : 'text-red-600') : 'text-blue-900';
  
  const formatValue = (v: any) => {
    const num = Number(v) || 0;
    if (type === 'currency') return formatCurrency(num);
    if (type === 'percent') return `${num.toFixed(1)}%`;
    if (type === 'decimal') return formatDecimal(num);
    if (type === 'integer') return Math.round(num).toString();
    return formatDecimal(num);
  };

  return (
    <div className="bg-white p-5 rounded-2xl md:rounded-[32px] shadow-sm border border-gray-100 flex flex-col justify-between hover:border-blue-200 transition-all group min-h-[140px]">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2.5 bg-gray-50 ${colorClass} rounded-xl group-hover:scale-110 transition-transform shadow-sm`}><Icon size={18} /></div>
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
      </div>
      <div>
        <h3 className={`text-xl md:text-2xl font-black italic tracking-tighter leading-none ${colorClass}`}>
          {formatValue(safeValue)}
        </h3>
        {target !== undefined && target > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
            <span className="text-[8px] font-black text-gray-400 uppercase">Meta: {formatValue(target)}</span>
            <span className={`text-[9px] font-black ${isSuccess ? 'text-green-500' : 'text-amber-500'}`}>{percentAtingimento.toFixed(0)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardManager: React.FC<DashboardManagerProps> = ({ user, stores, performanceData }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-02');
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const myStore = useMemo(() => {
    if (!stores) return null;
    return stores.find(s => s.id === user.storeId) || stores[0];
  }, [stores, user.storeId]);

  const timeStats = useMemo(() => {
      const now = new Date();
      const [y, m] = selectedMonth.split('-');
      const isCurrentMonth = selectedMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const totalDays = new Date(Number(y), Number(m), 0).getDate();
      const day = isCurrentMonth ? now.getDate() : totalDays;
      return { day, totalDays, remaining: Math.max(0, totalDays - day), isCurrentMonth };
  }, [selectedMonth]);

  const rankingScores = useMemo(() => {
      return (performanceData || [])
        .filter(p => String(p.month) === selectedMonth) // FILTRO ESTREITO DE MÊS
        .map(p => {
          const s = stores.find(st => String(st.id) === String(p.storeId || p.store_id));
          if (!s) return null;

          const revAct = Number(p.revenueActual || 0);
          const revTgt = Number(p.revenueTarget || 0);
          const paAct = Number(p.itemsPerTicket || 0);
          const paTgt = Number(p.paTarget || 0);
          const puAct = Number(p.unitPriceAverage || 0);
          const puTgt = Number(p.puTarget || 0);
          const ticketAct = Number(p.averageTicket || 0);
          const ticketTgt = Number(p.ticketTarget || 0);
          const itemsAct = Number(p.itemsActual || 0);
          const itemsTgt = Number(p.itemsTarget || 0);

          const aMeta = revTgt > 0 ? (revAct / revTgt) : 0;
          const aPA = paTgt > 0 ? (paAct / paTgt) : 0;
          const aPU = puTgt > 0 ? (puAct / puTgt) : 0;
          const aTicket = ticketTgt > 0 ? (ticketAct / ticketTgt) : 0;
          const aItems = itemsTgt > 0 ? (itemsAct / itemsTgt) : 0;

          const score = (aMeta * 0.40) + (aPA * 0.30) + (aPU * 0.10) + (aTicket * 0.10) + (aItems * 0.10);

          return {
            storeId: s.id,
            storeName: s.name,
            storeNumber: s.number,
            score,
            revenueActual: revAct,
            percentMeta: aMeta * 100,
            isMine: s.id === myStore?.id,
            rawData: {
              ...p,
              revenueTarget: revTgt,
              paTarget: paTgt,
              puTarget: puTgt,
              ticketTarget: ticketTgt,
              itemsTarget: itemsTgt
            },
            metaDiariaCorr: timeStats.remaining > 0 ? Math.max(0, revTgt - revAct) / timeStats.remaining : 0,
            mediaDiaria: revAct / Math.max(timeStats.day, 1)
          };
        })
        .filter(Boolean)
        .sort((a, b) => b!.score - a!.score)
        .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [performanceData, selectedMonth, stores, myStore, timeStats]);

  const myPerformance = useMemo(() => rankingScores.find(r => r.isMine), [rankingScores]);

  const handleGenerateInsight = async () => {
    if (!myStore) return;
    setIsLoadingAi(true);
    try {
        const insight = await analyzePerformance(performanceData, stores, 'MANAGER', myStore.id);
        setAiInsight(insight);
    } catch (e) { alert("Erro ao conectar com Gemini AI."); } finally { setIsLoadingAi(false); }
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 pb-16 min-h-full bg-gray-50">
        <div className="grid grid-cols-3 gap-2 bg-slate-900 p-2 rounded-3xl shadow-xl border border-white/10">
           <div className="bg-white/5 p-4 rounded-2xl flex flex-col items-center border border-white/5">
               <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Média Diária</span>
               <p className="text-sm md:text-lg font-black text-white italic">{formatCurrency(myPerformance?.mediaDiaria || 0)}</p>
           </div>
           <div className="bg-white/5 p-4 rounded-2xl flex flex-col items-center border border-white/5">
               <span className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1">Meta Corrigida</span>
               <p className="text-sm md:text-lg font-black text-white italic">{formatCurrency(myPerformance?.metaDiariaCorr || 0)}</p>
           </div>
           <div className="bg-red-600 p-4 rounded-2xl flex flex-col items-center shadow-lg">
               <span className="text-[8px] font-black text-white uppercase tracking-widest mb-1">Ranking Rede</span>
               <p className="text-sm md:text-lg font-black text-white italic">#{myPerformance?.rank || '--'}</p>
           </div>
        </div>

        <div className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-700 rounded-2xl text-white shadow-lg shadow-blue-100"><ShoppingBag size={24} /></div>
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase italic leading-none">
                        {myStore?.name} <span className="text-blue-700">#{myStore?.number}</span>
                    </h2>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 tracking-widest">Dashboard Gerencial Real</p>
                </div>
            </div>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-100 px-4 py-2 rounded-2xl text-[10px] font-black text-blue-900 uppercase italic border-none outline-none cursor-pointer"
            >
              <option value="2026-02">Fevereiro 2026</option>
              <option value="2026-01">Janeiro 2026</option>
            </select>
        </div>

        {myPerformance ? (
            <div className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                        <div className="absolute -top-2 -right-2 opacity-5"><DollarSign size={80}/></div>
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Faturamento Realizado</p>
                            <h3 className="text-2xl font-black text-slate-900 italic">{formatCurrency(myPerformance.revenueActual)}</h3>
                        </div>
                        <div>
                            <p className="text-[8px] font-bold text-gray-400 uppercase">Meta Alvo: {formatCurrency(myPerformance.rawData.revenueTarget)}</p>
                            <GoalProgressBar percent={myPerformance.percentMeta} />
                        </div>
                    </div>
                    <KPIHighlightCard label="P.A (Peças/Atend)" value={myPerformance.rawData.itemsPerTicket} target={myPerformance.rawData.paTarget} icon={Hash} type="decimal" />
                    <KPIHighlightCard label="P.U (Preço Médio)" value={myPerformance.rawData.unitPriceAverage} target={myPerformance.rawData.puTarget} icon={Zap} type="currency" />
                    <KPIHighlightCard label="Ticket Médio" value={myPerformance.rawData.averageTicket} target={myPerformance.rawData.ticketTarget} icon={Target} type="currency" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KPIHighlightCard label="Total Itens" value={myPerformance.rawData.itemsActual} target={myPerformance.rawData.itemsTarget} icon={Package} type="integer" />
                    <KPIHighlightCard label="Inadimplência" value={myPerformance.rawData.delinquencyRate} target={myPerformance.rawData.delinquencyTarget} icon={AlertCircle} type="percent" invertColor />
                    <button onClick={handleGenerateInsight} className="bg-gray-950 p-6 rounded-[32px] shadow-xl flex flex-col justify-center items-center text-center group hover:bg-blue-700 transition-all border-b-4 border-blue-800">
                        {isLoadingAi ? <Loader2 className="animate-spin text-white" size={24} /> : (
                            <>
                                <Sparkles className="text-amber-400 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                                <p className="text-[10px] font-black text-white uppercase tracking-widest">Plano Gemini AI</p>
                            </>
                        )}
                    </button>
                </div>

                <div className="bg-white rounded-[32px] shadow-lg border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xs font-black uppercase italic text-gray-900 tracking-tighter flex items-center gap-2">
                            <Trophy className="text-amber-500" size={18}/> Top 10 <span className="text-blue-700">Performance Corporativa</span>
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-gray-50">
                                {rankingScores.slice(0, 10).map((item) => (
                                    <tr key={item.storeId} className={`${item.isMine ? 'bg-blue-50' : ''} transition-colors`}>
                                        <td className="px-6 py-4 text-center w-16">
                                            <span className={`text-lg font-black italic ${item.rank <= 3 ? 'text-amber-500' : 'text-gray-300'}`}>#{item.rank}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className={`text-[11px] font-black uppercase italic ${item.isMine ? 'text-blue-700' : 'text-gray-900'}`}>{item.storeNumber} - {item.storeName}</span>
                                                {item.isMine && <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Sua Unidade</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-sm font-black italic ${item.percentMeta >= 100 ? 'text-green-600' : 'text-gray-400'}`}>{item.percentMeta.toFixed(1)}%</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        ) : (
            <div className="p-12 text-center bg-white rounded-[32px] shadow-sm border-2 border-dashed border-gray-100">
                <AlertCircle className="mx-auto text-gray-200 mb-4" size={48} />
                <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Nenhum dado real importado para {selectedMonth}</p>
            </div>
        )}
        
        {aiInsight && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
               <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-blue-600">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                        <h3 className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2"><BrainCircuit className="text-blue-500" size={20} /> Estratégia de <span className="text-blue-500">Recuperação</span></h3>
                        <button onClick={() => setAiInsight('')} className="hover:text-red-400 transition-colors"><X size={24} /></button>
                    </div>
                    <div className="p-8">
                        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 text-gray-700 text-xs md:text-sm font-medium leading-relaxed max-h-[50vh] overflow-y-auto no-scrollbar shadow-inner">
                            {aiInsight.split('\n').map((line, i) => <p key={i} className="mb-3">{line}</p>)}
                        </div>
                        <button onClick={() => setAiInsight('')} className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">Fechar Consultoria</button>
                    </div>
               </div>
           </div>
        )}
    </div>
  );
};

export default DashboardManager;