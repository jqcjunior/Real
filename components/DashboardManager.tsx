import React, { useState, useMemo } from 'react';
import { User, Store, ProductPerformance } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { ShoppingBag, DollarSign, Package, Hash, AlertCircle, Trophy, BarChart3, TrendingUp, Target, Clock, BrainCircuit, Sparkles, Loader2, Zap, X } from 'lucide-react';
import { analyzePerformance } from '../services/geminiService';

interface DashboardManagerProps {
  user: User;
  stores: Store[];
  performanceData: any[]; 
  purchasingData: ProductPerformance[];
}

const KPICard = ({ label, value, target, icon: Icon, type = 'currency', mode = 'higher' }: { label: string, value: number, target?: number, icon: any, type?: 'currency' | 'decimal' | 'integer', mode?: 'higher' | 'lower' }) => {
  const calcAttainment = (actual: number, target: number, mode: 'higher' | 'lower') => {
    if (!actual || !target) return 0;
    return mode === 'higher' ? (actual / target) * 100 : (target / actual) * 100;
  };

  const ating = target && target > 0 ? calcAttainment(value, target, mode) : 0;
  const isOk = ating >= 100;
  const isWarning = ating < 50;
  
  let barColor = 'bg-blue-500';
  let textColor = 'text-blue-900';
  
  if (isOk) {
    barColor = 'bg-green-500';
    textColor = 'text-green-600';
  } else if (isWarning) {
    barColor = 'bg-red-300';
    textColor = 'text-red-600';
  }

  const formatValue = (val: number) => {
    if (type === 'currency') return formatCurrency(val);
    if (type === 'integer') return Math.round(val).toLocaleString('pt-BR');
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-100 flex flex-col justify-between hover:border-blue-200 transition-all group min-h-[160px]">
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-2xl ${isOk ? 'bg-green-50' : isWarning ? 'bg-red-50' : 'bg-blue-50'} ${isOk ? 'text-green-600' : isWarning ? 'text-red-600' : 'text-blue-600'}`}>
          <Icon size={20} />
        </div>
      </div>
      
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className={`text-2xl font-black italic tracking-tighter ${textColor}`}>
          {formatValue(value)}
        </h3>
        {target !== undefined && target > 0 && (
          <span className="text-[10px] font-bold text-slate-300 italic">
            {formatValue(value)} / {formatValue(target)}
          </span>
        )}
      </div>
      
      {target !== undefined && target > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-50 h-1 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${barColor}`} 
              style={{ width: `${Math.min(ating, 100)}%` }} 
            />
          </div>
          <span className={`text-[10px] font-black min-w-[35px] text-right ${textColor}`}>
            {ating.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

const DashboardManager: React.FC<DashboardManagerProps> = ({ user, stores, performanceData }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-02');
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const myStore = useMemo(() => stores.find(s => s.id === user.storeId) || stores[0], [stores, user.storeId]);

  const calcAttainment = (actual: number, target: number, mode: 'higher' | 'lower') => {
      if (!actual || !target) return 0;
      return mode === 'higher'
          ? (actual / target) * 100
          : (target / actual) * 100;
  };

  const myPerformance = useMemo(() => {
      if (!myStore) return null;
      const storeMonthData = performanceData.filter(pd => 
        String(pd.month) === selectedMonth && 
        String(pd.storeId || pd.store_id) === String(myStore.id)
      );
      
      if (storeMonthData.length === 0) return null;

      // Agregando valores caso existam múltiplos registros para a mesma loja/mês
      const aggregated = storeMonthData.reduce((acc, curr) => ({
        revenueActual: acc.revenueActual + Number(curr.revenueActual || 0),
        revenueTarget: acc.revenueTarget + Number(curr.revenueTarget || 0),
        itemsActual: acc.itemsActual + Number(curr.itemsActual || 0),
        itemsTarget: acc.itemsTarget + Number(curr.itemsTarget || 0),
        salesActual: acc.salesActual + Number(curr.salesActual || 0),
        paActual: acc.paActual + Number(curr.paActual || 0),
        paTarget: acc.paTarget + Number(curr.paTarget || 0),
        puActual: acc.puActual + Number(curr.puActual || 0),
        puTarget: acc.puTarget + Number(curr.puTarget || 0),
        averageTicket: acc.averageTicket + Number(curr.averageTicket || 0),
        ticketTarget: acc.ticketTarget + Number(curr.ticketTarget || 0),
      }), {
        revenueActual: 0, revenueTarget: 0, itemsActual: 0, itemsTarget: 0,
        salesActual: 0, paActual: 0, paTarget: 0, puActual: 0, puTarget: 0,
        averageTicket: 0, ticketTarget: 0
      });

      // Para indicadores de média (P.A, P.U, Ticket), se houver múltiplos registros, 
      // recalculamos com base nos totais agregados para evitar somar médias.
      const finalPA = aggregated.salesActual > 0 ? aggregated.itemsActual / aggregated.salesActual : 0;
      const finalPU = aggregated.itemsActual > 0 ? aggregated.revenueActual / aggregated.itemsActual : 0;
      const finalTicket = aggregated.salesActual > 0 ? aggregated.revenueActual / aggregated.salesActual : 0;

      // Para os targets de média, pegamos a média aritmética se houver mais de um registro
      const finalPATarget = aggregated.paTarget / storeMonthData.length;
      const finalPUTarget = aggregated.puTarget / storeMonthData.length;
      const finalTicketTarget = aggregated.ticketTarget / storeMonthData.length;

      return {
        revAct: aggregated.revenueActual,
        revTgt: aggregated.revenueTarget,
        paAct: finalPA,
        paTgt: finalPATarget,
        puAct: finalPU,
        puTgt: finalPUTarget,
        tktAct: finalTicket,
        tktTgt: finalTicketTarget,
        itemsAct: aggregated.itemsActual,
        itemsTgt: aggregated.itemsTarget,
        ating: calcAttainment(aggregated.revenueActual, aggregated.revenueTarget, 'higher'),
        paAting: calcAttainment(finalPA, finalPATarget, 'higher'),
        puAting: calcAttainment(finalPU, finalPUTarget, 'lower'),
        tktAting: calcAttainment(finalTicket, finalTicketTarget, 'higher'),
        itemsAting: calcAttainment(aggregated.itemsActual, aggregated.itemsTarget, 'higher')
      };
  }, [performanceData, selectedMonth, myStore]);

  const weightedRanking = useMemo(() => {
      const monthData = performanceData.filter(p => String(p.month) === selectedMonth);
      
      // Agrupar dados por loja antes de calcular o ranking
      const storeAggregation = monthData.reduce((acc, p) => {
          const id = String(p.storeId || p.store_id);
          if (!acc[id]) {
              acc[id] = { 
                  revenueActual: 0, revenueTarget: 0, itemsActual: 0, itemsTarget: 0, 
                  salesActual: 0, paTarget: 0, puTarget: 0, ticketTarget: 0, percentMeta: 0 
              };
          }
          acc[id].revenueActual += Number(p.revenueActual || 0);
          acc[id].itemsActual += Number(p.itemsActual || 0);
          acc[id].salesActual += Number(p.salesActual || 0);
          
          acc[id].revenueTarget = Math.max(acc[id].revenueTarget, Number(p.revenueTarget || 0));
          acc[id].itemsTarget = Math.max(acc[id].itemsTarget, Number(p.itemsTarget || 0));
          acc[id].paTarget = Math.max(acc[id].paTarget, Number(p.paTarget || 0));
          acc[id].puTarget = Math.max(acc[id].puTarget, Number(p.puTarget || 0));
          acc[id].ticketTarget = Math.max(acc[id].ticketTarget, Number(p.ticketTarget || 0));
          return acc;
      }, {} as Record<string, any>);

      const ranked = Object.keys(storeAggregation).map(storeId => {
          const p = storeAggregation[storeId];
          const store = stores.find(s => String(s.id) === storeId);
          
          const calcPercent = (act: number, tgt: number, mode: 'higher' | 'lower') => {
              if (!tgt || tgt <= 0) return 0;
              const val = mode === 'higher' ? (act / tgt) * 100 : (tgt / act) * 100;
              return Math.min(val, 120);
          };

          const pF = calcPercent(p.revenueActual, p.revenueTarget, 'higher');
          const pPA = calcPercent(p.salesActual > 0 ? p.itemsActual / p.salesActual : 0, p.paTarget, 'higher');
          const pPU = calcPercent(p.itemsActual > 0 ? p.revenueActual / p.itemsActual : 0, p.puTarget, 'lower');
          const pT = calcPercent(p.salesActual > 0 ? p.revenueActual / p.salesActual : 0, p.ticketTarget, 'higher');
          const pI = calcPercent(p.itemsActual, p.itemsTarget, 'higher');

          const scoreFinal = (pF * 0.40) + (pPA * 0.20) + (pPU * 0.15) + (pT * 0.15) + (pI * 0.10);

          return {
              storeNumber: store?.number || '?',
              score: scoreFinal
          };
      });

      return ranked.sort((a, b) => b.score - a.score);
  }, [performanceData, selectedMonth, stores]);

  const handleGenerateInsight = async () => {
    if (!myStore) return;
    setIsLoadingAi(true);
    try {
        const insight = await analyzePerformance(performanceData, stores, 'MANAGER', myStore.id);
        setAiInsight(insight);
    } catch (e) { alert("Erro IA"); } finally { setIsLoadingAi(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-16 min-h-full bg-[#F8FAFC] animate-in fade-in duration-500">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="p-2.5 bg-blue-700 rounded-xl text-white shadow-lg"><ShoppingBag size={20} /></div>
                <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase italic leading-none">
                        {myStore?.name} <span className="text-blue-700">#{myStore?.number}</span>
                    </h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Painel Gerencial Real</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black text-blue-900 uppercase border-none outline-none cursor-pointer">
                    <option value="2026-02">Fevereiro 2026</option>
                    <option value="2026-01">Janeiro 2026</option>
                </select>
                <button onClick={handleGenerateInsight} disabled={isLoadingAi} className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg active:scale-95 transition-all">
                    {isLoadingAi ? <Loader2 className="animate-spin" size={16} /> : <Sparkles className="text-amber-400" size={16} />}
                </button>
            </div>
        </div>

        {myPerformance ? (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard label="Faturamento" value={myPerformance.revAct} target={myPerformance.revTgt} icon={DollarSign} />
                    <KPICard label="Peças por Atendimento (P.A)" value={myPerformance.paAct} target={myPerformance.paTgt} icon={Hash} type="decimal" />
                    <KPICard label="Preço Unitário Médio (P.U)" value={myPerformance.puAct} target={myPerformance.puTgt} icon={Zap} mode="lower" />
                    <KPICard label="Ticket Médio" value={myPerformance.tktAct} target={myPerformance.tktTgt} icon={Target} />
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Trophy size={20} /></div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">Ranking Ponderado <span className="text-blue-600">Performance</span></h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Baseado no equilíbrio das metas</p>
                                </div>
                            </div>

                            {/* Card Próximo Nível */}
                            {(() => {
                                const myIdx = weightedRanking.findIndex(item => myStore && item.storeNumber === myStore.number);
                                if (myIdx > 0) {
                                    const nextStore = weightedRanking[myIdx - 1];
                                    const myScore = weightedRanking[myIdx].score;
                                    const diff = nextStore.score - myScore;
                                    
                                    // Cálculo simples de faturamento necessário para subir (estimativa baseada no peso de 40%)
                                    // Se 40% do score vem do faturamento, para subir 'diff' pontos, 
                                    // o faturamento precisa subir (diff / 0.4)% em relação à meta.
                                    const neededRevenuePercent = diff / 0.4;
                                    const neededRevenue = myPerformance ? (myPerformance.revTgt * (neededRevenuePercent / 100)) : 0;
                                    
                                    const now = new Date();
                                    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                                    const remainingDays = Math.max(daysInMonth - now.getDate(), 1);
                                    const dailyExtra = neededRevenue / remainingDays;

                                    return (
                                        <div className="bg-blue-900 text-white p-4 rounded-2xl shadow-lg flex items-center gap-4 border border-blue-700/50">
                                            <div className="p-2 bg-blue-800 rounded-lg"><TrendingUp size={16} className="text-blue-300" /></div>
                                            <div>
                                                <p className="text-[8px] font-black uppercase tracking-widest text-blue-300">Próximo Nível</p>
                                                <p className="text-[10px] font-bold">
                                                    Venda <span className="text-blue-200">{formatCurrency(dailyExtra)}</span> a mais por dia para passar a Loja {nextStore.storeNumber}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }
                                if (myIdx === 0) {
                                    return (
                                        <div className="bg-green-600 text-white p-4 rounded-2xl shadow-lg flex items-center gap-4 border border-green-500">
                                            <div className="p-2 bg-green-500 rounded-lg"><Trophy size={16} className="text-yellow-300" /></div>
                                            <div>
                                                <p className="text-[8px] font-black uppercase tracking-widest text-green-200">Liderança</p>
                                                <p className="text-[10px] font-bold">Você é o #01 da rede! Mantenha o ritmo.</p>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                            {weightedRanking.map((item, idx) => {
                                const isMe = myStore && item.storeNumber === myStore.number;
                                const score = item.score;
                                let barColor = 'bg-blue-500';
                                if (score >= 100) barColor = 'bg-green-500';
                                else if (score < 50) barColor = 'bg-red-300';

                                return (
                                    <div key={idx} className={`p-5 rounded-3xl border ${isMe ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-slate-50 border-slate-100'} transition-all`}>
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className={`text-sm font-black ${isMe ? 'text-blue-600' : 'text-slate-900'}`}>#{String(idx + 1).padStart(2, '0')}</span>
                                                <p className="text-sm font-black text-slate-900 uppercase italic">Loja {item.storeNumber}</p>
                                                {isMe && <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Sua Loja</span>}
                                            </div>
                                            <span className={`text-sm font-black italic ${score >= 100 ? 'text-green-600' : score < 50 ? 'text-red-600' : 'text-blue-900'}`}>
                                                {score.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-white h-2 rounded-full overflow-hidden shadow-inner">
                                            <div 
                                                className={`h-full transition-all duration-1000 ${barColor}`} 
                                                style={{ width: `${Math.min(score, 100)}%` }} 
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </>
        ) : (
            <div className="p-20 text-center bg-white rounded-3xl shadow-sm border border-slate-100 opacity-30 grayscale">
                <AlertCircle className="mx-auto mb-2" size={48} />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Aguardando dados online do período</p>
            </div>
        )}
        
        {aiInsight && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
               <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase italic tracking-tighter flex items-center gap-2"><BrainCircuit className="text-blue-500" size={18} /> Consultoria <span className="text-blue-500">Gemini Pro</span></h3>
                        <button onClick={() => setAiInsight('')} className="hover:text-red-400 transition-colors"><X size={20} /></button>
                    </div>
                    <div className="p-8">
                        <div className="bg-slate-50 p-6 rounded-2xl text-slate-700 text-xs font-medium leading-relaxed max-h-[50vh] overflow-y-auto no-scrollbar shadow-inner">
                            {aiInsight.split('\n').map((line, i) => <p key={i} className="mb-3">{line}</p>)}
                        </div>
                        <button onClick={() => setAiInsight('')} className="w-full mt-6 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Entendido</button>
                    </div>
               </div>
           </div>
        )}
    </div>
  );
};

export default DashboardManager;