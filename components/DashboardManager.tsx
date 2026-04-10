import React, { useState, useMemo } from 'react';
import { User, Store, MonthlyGoal, MonthlyPerformance, ProductPerformance, IceCreamSangria, IceCreamStockMovement, IceCreamStock, DetailedAdvice, MotivationalPhrase } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { ShoppingBag, DollarSign, Package, Hash, AlertCircle, Trophy, BarChart3, TrendingUp, Target, Clock, BrainCircuit, Sparkles, Loader2, Zap, X, TrendingDown, Percent, Activity, Users, Medal, Gem, Minus, Quote } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface DashboardManagerProps {
  user: User;
  stores: Store[];
  performanceData: any[]; 
  goalsData: MonthlyGoal[];
  purchasingData: ProductPerformance[];
  sangrias: IceCreamSangria[];
  stockMovements: IceCreamStockMovement[];
  stock: IceCreamStock[];
  weightRevenue?: number;
  weightPA?: number;
}

const KPICard = ({ label, value, target, icon: Icon, type = 'currency', mode = 'higher' }: { label: string, value: number, target?: number, icon: any, type?: 'currency' | 'decimal' | 'integer', mode?: 'higher' | 'lower' }) => {
  const calcAttainment = (actual: number, target: number, mode: 'higher' | 'lower') => {
    if (!actual || !target) return 0;
    return mode === 'higher' ? (actual / target) * 100 : (target / actual) * 100;
  };

  const ating = target && target > 0 ? calcAttainment(value, target, mode) : 0;
  const isOk = mode === 'higher' ? value >= (target || 0) : value <= (target || 999999);
  const isWarning = mode === 'higher' ? ating < 80 : ating < 80;
  
  let barColor = 'bg-blue-500';
  let textColor = 'text-blue-900';
  
  if (isOk) {
    barColor = 'bg-green-500';
    textColor = 'text-green-600';
  }

  const formatValue = (val: number) => {
    if (type === 'currency') return formatCurrency(val);
    if (type === 'integer') return Math.round(val).toLocaleString('pt-BR');
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 md:p-6 rounded-3xl sm:rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between hover:border-blue-200 dark:hover:border-blue-800 transition-all group min-h-[140px] sm:min-h-[160px]">
      <div className="flex justify-between items-start mb-2 sm:mb-3">
        <div className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl ${isOk ? 'bg-green-50 dark:bg-green-900/20' : isWarning ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'} ${isOk ? 'text-green-600 dark:text-green-400' : isWarning ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
          <Icon size={18} className="sm:hidden" />
          <Icon size={20} className="hidden sm:block" />
        </div>
      </div>
      
      <p className="text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 sm:mb-2">{label}</p>
      
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className={`text-xl sm:text-2xl font-black italic tracking-tighter ${isOk ? 'text-green-600 dark:text-green-400' : isWarning ? 'text-red-600 dark:text-red-400' : 'text-blue-900 dark:text-white'}`}>
          {formatValue(value)}
        </h3>
        {target !== undefined && target > 0 && (
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-300 dark:text-slate-600 italic hidden sm:inline">
            {formatValue(value)} / {formatValue(target)}
          </span>
        )}
      </div>
      
      {target !== undefined && target > 0 && (
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex-1 bg-slate-50 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${barColor}`} 
              style={{ width: `${Math.min(ating, 100)}%` }} 
            />
          </div>
          <span className={`text-[9px] sm:text-[10px] font-black min-w-[30px] sm:min-w-[35px] text-right ${isOk ? 'text-green-600 dark:text-green-400' : isWarning ? 'text-red-600 dark:text-red-400' : 'text-blue-900 dark:text-white'}`}>
            {ating.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

const DashboardManager: React.FC<DashboardManagerProps> = ({ user, stores, performanceData, goalsData, sangrias, stockMovements, stock, weightRevenue = 50, weightPA = 50 }) => {
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [localInsight, setLocalInsight] = useState<DetailedAdvice | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const myStore = useMemo(() => stores.find(s => String(s.id) === String(user.storeId)) || stores[0], [stores, user.storeId]);

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
      
      const storeMonthGoal = goalsData.find(g => {
        const gMonth = `${g.year}-${String(g.month).padStart(2, '0')}`;
        return gMonth === selectedMonth && String(g.storeId) === String(myStore.id);
      });

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

      // Fallback para metas se não houver no performanceData
      const finalRevenueTarget = aggregated.revenueTarget || Number(storeMonthGoal?.revenueTarget || 0);
      const finalItemsTarget = aggregated.itemsTarget || Number(storeMonthGoal?.itemsTarget || 0);
      const finalPATarget = (aggregated.paTarget / (storeMonthData.length || 1)) || Number(storeMonthGoal?.paTarget || 0);
      const finalPUTarget = (aggregated.puTarget / (storeMonthData.length || 1)) || Number(storeMonthGoal?.puTarget || 0);
      const finalTicketTarget = (aggregated.ticketTarget / (storeMonthData.length || 1)) || Number(storeMonthGoal?.ticketTarget || 0);

      const finalPA = Number(storeMonthData[0]?.paActual || 0);
      const finalPU = Number(storeMonthData[0]?.puActual || 0);
      const finalTicket = Number(storeMonthData[0]?.averageTicket || 0);

      return {
        revAct: aggregated.revenueActual,
        revTgt: finalRevenueTarget,
        paAct: finalPA,
        paTgt: finalPATarget,
        puAct: finalPU,
        puTgt: finalPUTarget,
        tktAct: finalTicket,
        tktTgt: finalTicketTarget,
        itemsAct: aggregated.itemsActual,
        itemsTgt: finalItemsTarget,
        ating: calcAttainment(aggregated.revenueActual, finalRevenueTarget, 'higher'),
        paAting: calcAttainment(finalPA, finalPATarget, 'higher'),
        puAting: calcAttainment(finalPU, finalPUTarget, 'lower'),
        tktAting: calcAttainment(finalTicket, finalTicketTarget, 'higher'),
        itemsAting: calcAttainment(aggregated.itemsActual, finalItemsTarget, 'higher')
      };
  }, [performanceData, goalsData, selectedMonth, myStore, sangrias, stockMovements, stock]);

  const weightedRanking = useMemo(() => {
      const monthData = performanceData.filter(p => String(p.month) === selectedMonth);
      const monthGoals = goalsData.filter(g => {
        const gMonth = `${g.year}-${String(g.month).padStart(2, '0')}`;
        return gMonth === selectedMonth;
      });
      
      const storeAggregation = monthData.reduce((acc, p) => {
          const id = String(p.storeId || p.store_id);
          if (!acc[id]) {
              acc[id] = { 
                  revenueActual: 0, revenueTarget: 0, itemsActual: 0, itemsTarget: 0, 
                  salesActual: 0, paTarget: 0, puTarget: 0, ticketTarget: 0, percentMeta: 0,
                  businessDays: 26
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
          acc[id].businessDays = Math.max(acc[id].businessDays, Number(p.businessDays || 26));
          return acc;
      }, {} as Record<string, any>);

      const ranked = stores.map(store => {
          const storeId = String(store.id);
          const p = storeAggregation[storeId];
          const goal = monthGoals.find(g => String(g.storeId) === storeId);
          
          const calcPercent = (act: number, tgt: number, mode: 'higher' | 'lower') => {
              if (!tgt || tgt <= 0) return 0;
              const val = mode === 'higher' ? (act / tgt) * 100 : (tgt / act) * 100;
              return Math.min(val, 120);
          };

          const revenueActual = Number(p?.revenueActual || 0);
          const revenueTarget = Number(p?.revenueTarget || goal?.revenueTarget || 0);
          const pF = calcPercent(revenueActual, revenueTarget, 'higher');
          
          const perfItem = monthData.find(md => String(md.storeId || md.store_id) === storeId);
          
          let paActual = Number(perfItem?.paActual || 0);
          const itemsActual = Number(p?.itemsActual || 0);
          const salesActual = Number(p?.salesActual || 0);
          if (paActual === 0 && salesActual > 0) paActual = itemsActual / salesActual;
          
          let tktActual = Number(perfItem?.averageTicket || 0);
          if (tktActual === 0 && salesActual > 0) tktActual = revenueActual / salesActual;
          
          let puActual = Number(perfItem?.puActual || 0);
          if (puActual === 0 && itemsActual > 0) puActual = revenueActual / itemsActual;

          const paTarget = Number(p?.paTarget || goal?.paTarget || 0);
          const pPA = calcPercent(paActual, paTarget, 'higher');
          
          const wRev = weightRevenue / 100;
          const wPA = weightPA / 100;
          const scoreFinal = (pF * wRev) + (pPA * wPA);

          return {
              storeId,
              storeNumber: store.number,
              city: store.city,
              score: scoreFinal,
              revenueActual,
              revenueTarget,
              paActual,
              paTarget,
              ticketActual: tktActual,
              ticketTarget: Number(p?.ticketTarget || goal?.ticketTarget || 0),
              puActual,
              puTarget: Number(p?.puTarget || goal?.puTarget || 0),
              salesActual,
              itemsActual
          };
      });

      return ranked.sort((a, b) => b.score - a.score);
  }, [performanceData, goalsData, selectedMonth, stores, weightRevenue, weightPA]);

  const handleGenerateInsight = async () => {
    if (!myStore) return;
    setIsLoadingAi(true);
    
    const myIdx = weightedRanking.findIndex(r => String(r.storeId) === String(myStore.id));
    const curr = weightedRanking[myIdx];
    const next = myIdx > 0 ? weightedRanking[myIdx - 1] : null;

    const advice = getDetailedAdvice(curr, next, myIdx);
    
    const attainment = (curr.revenueActual / (curr.revenueTarget || 1)) * 100;
    let category: 'atraso' | 'pressao' | 'meta_batida' | 'vendas' = 'vendas';
    if (attainment < 70) category = 'atraso';
    else if (attainment < 100) category = 'pressao';
    else category = 'meta_batida';

    try {
      const { data: phrases } = await supabase
        .from('Motivacional_frases')
        .select('*')
        .eq('categoria', category);

      if (phrases && phrases.length > 0) {
        const dayIndex = new Date().getDate() % phrases.length;
        advice.frase = phrases[dayIndex].frase;
      }
    } catch (e) {
      console.error("Erro ao buscar frases:", e);
    }

    setLocalInsight(advice);
    setIsLoadingAi(false);
  };

  const getRemainingWorkDays = (monthStr: string, storeId?: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const now = new Date();
    const lastDay = new Date(year, month, 0).getDate();
    
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    let startDay = 1;
    if (year === currentYear && month === currentMonth) {
        startDay = now.getDate();
    } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
        return 1;
    }
    
    let remainingCount = 0;
    for (let d = startDay; d <= lastDay; d++) {
        const date = new Date(year, month - 1, d);
        if (date.getDay() !== 0) {
            remainingCount++;
        }
    }

    if (storeId) {
        const storePerf = performanceData.find(p => String(p.storeId || p.store_id) === String(storeId) && String(p.month) === monthStr);
        if (storePerf && storePerf.businessDays) {
            let totalWorkDays = 0;
            for (let d = 1; d <= lastDay; d++) {
                const date = new Date(year, month - 1, d);
                if (date.getDay() !== 0) totalWorkDays++;
            }
            
            const passedWorkDays = totalWorkDays - remainingCount;
            const adjustedRemaining = storePerf.businessDays - passedWorkDays;
            return Math.max(adjustedRemaining, 1);
        }
    }

    return Math.max(remainingCount, 1);
  };

  const getDetailedAdvice = (curr: any, next: any, idx: number): DetailedAdvice => {
    const remainingDays = getRemainingWorkDays(selectedMonth, curr.storeId);
    const revDiff = Math.max(curr.revenueTarget - curr.revenueActual, 0);
    const dailyRev = revDiff / remainingDays;
    const attainment = (curr.revenueActual / (curr.revenueTarget || 1)) * 100;

    let prioridade = "🟢 No ritmo (100%+)";
    if (attainment < 70) prioridade = "🔴 Atrasado (abaixo de 70%)";
    else if (attainment < 100) prioridade = "🟡 Atenção (70% a 99%)";

    const meta = revDiff > 0 
      ? `Faltam R$ ${formatDecimal(revDiff)} • Venda R$ ${formatDecimal(dailyRev)}/dia`
      : "Meta de faturamento atingida!";

    const indicadores: string[] = [];
    if (curr.ticketActual < curr.ticketTarget) {
      indicadores.push(`Ticket abaixo (-R$ ${formatDecimal(curr.ticketTarget - curr.ticketActual)})`);
    }
    if (curr.paActual < curr.paTarget) {
      indicadores.push(`P.A baixo (${curr.paActual.toFixed(2)} vs ${curr.paTarget.toFixed(2)})`);
    }
    if (curr.puActual > curr.puTarget) {
      indicadores.push(`P.U alto (+R$ ${formatDecimal(curr.puActual - curr.puTarget)})`);
    }

    let ranking = "Você é o #01 da Rede!";
    if (next) {
      const neededRev = getRevenueToPass(curr, next);
      ranking = neededRev 
        ? `Faltam R$ ${formatDecimal(neededRev)} para ultrapassar a Loja ${next.storeNumber}`
        : `Melhore seu P.A para ultrapassar a Loja ${next.storeNumber}`;
    }

    const acoes: string[] = [];
    if (curr.paActual < curr.paTarget) {
      acoes.push("👉 Trabalhar venda adicional (2º item)");
      acoes.push("👉 Reforçar abordagem ativa com clientes");
    }
    if (curr.ticketActual < curr.ticketTarget) {
      acoes.push("👉 Criar combos ou kits promocionais");
    }
    if (curr.puActual > curr.puTarget) {
      acoes.push("👉 Incentivar produtos de giro (menor valor)");
      acoes.push("👉 Reduzir resistência de preço");
    }
    
    const finalAcoes = acoes.slice(0, 4);
    if (finalAcoes.length === 0) {
      finalAcoes.push("👉 Manter o ritmo e foco no atendimento");
      finalAcoes.push("👉 Revisar metas diárias com a equipe");
    }

    return { prioridade, meta, indicadores, ranking, acoes: finalAcoes };
  };

  const getRevenueToPass = (curr: any, target: any) => {
    if (!curr.revenueTarget || curr.revenueTarget <= 0) return null;

    const safeRatio = (act: number, tgt: number, mode: 'higher' | 'lower') => {
        if (!tgt || tgt <= 0) return 0;
        const val = mode === 'higher' ? (act / tgt) : (tgt / act);
        return Math.min(val, 1.2);
    };

    const otherMetricsWeight = (
        (safeRatio(curr.paActual, curr.paTarget, 'higher') * 0.50)
    );

    const targetScoreDecimal = target.score / 100;
    const neededRevRatio = (targetScoreDecimal - otherMetricsWeight) / 0.50;
    
    if (neededRevRatio > 1.2) return null;
    
    const neededTotalRev = neededRevRatio * curr.revenueTarget;
    const diff = neededTotalRev - curr.revenueActual;
    
    return diff > 0 ? diff : null;
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 pb-16 min-h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300 animate-in fade-in duration-500">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-2.5 bg-blue-700 rounded-xl text-white shadow-lg">
                    <ShoppingBag size={18} className="sm:hidden" />
                    <ShoppingBag size={20} className="hidden sm:block" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase italic leading-none truncate">
                        {myStore?.name} <span className="text-blue-700 dark:text-blue-400">#{myStore?.number}</span>
                    </h2>
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1 tracking-widest">Painel Gerencial Real</p>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 flex-1">
                    <select 
                        value={selectedMonth.split('-')[1]} 
                        onChange={e => {
                            const [year] = selectedMonth.split('-');
                            setSelectedMonth(`${year}-${e.target.value}`);
                        }}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black text-slate-900 dark:text-white uppercase border-none outline-none cursor-pointer"
                    >
                        <option value="01">Janeiro</option>
                        <option value="02">Fevereiro</option>
                        <option value="03">Março</option>
                        <option value="04">Abril</option>
                        <option value="05">Maio</option>
                        <option value="06">Junho</option>
                        <option value="07">Julho</option>
                        <option value="08">Agosto</option>
                        <option value="09">Setembro</option>
                        <option value="10">Outubro</option>
                        <option value="11">Novembro</option>
                        <option value="12">Dezembro</option>
                    </select>

                    <select 
                        value={selectedMonth.split('-')[0]} 
                        onChange={e => {
                            const [, month] = selectedMonth.split('-');
                            setSelectedMonth(`${e.target.value}-${month}`);
                        }}
                        className="w-20 sm:w-auto bg-slate-50 dark:bg-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black text-slate-900 dark:text-white uppercase border-none outline-none cursor-pointer"
                    >
                        {(() => {
                            const years = [];
                            const currentYear = new Date().getFullYear();
                            for (let y = currentYear + 1; y >= 2024; y--) {
                                years.push(<option key={y} value={y}>{y}</option>);
                            }
                            return years;
                        })()}
                    </select>
                </div>
                
                <button onClick={handleGenerateInsight} disabled={isLoadingAi} className="p-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl shadow-lg active:scale-95 transition-all self-end sm:self-auto">
                    {isLoadingAi ? <Loader2 className="animate-spin" size={16} /> : <Sparkles className="text-amber-400" size={16} />}
                </button>
            </div>
        </div>

        {myPerformance ? (
            <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <KPICard label="Faturamento" value={myPerformance.revAct} target={myPerformance.revTgt} icon={DollarSign} />
                    <KPICard label="P.A Médio" value={myPerformance.paAct} target={myPerformance.paTgt} icon={ShoppingBag} type="decimal" />
                    <KPICard label="P.U Médio" value={myPerformance.puAct} target={myPerformance.puTgt} icon={Percent} type="decimal" mode="lower" />
                    <KPICard label="Ticket Médio" value={myPerformance.tktAct} target={myPerformance.tktTgt} icon={Users} type="currency" />
                </div>

                {/* Ranking Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* Ranking List */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-10 rounded-3xl sm:rounded-[48px] shadow-sm border border-slate-100 dark:border-slate-800 order-2 lg:order-1">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-10">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl shadow-inner">
                                    <Trophy size={20} className="sm:hidden" />
                                    <Trophy size={24} className="hidden sm:block" />
                                </div>
                                <div>
                                    <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Ranking <span className="text-blue-600 dark:text-blue-400">Ponderado</span></h3>
                                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Equilíbrio de Metas (50/50)</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:gap-4">
                            {weightedRanking.map((item, idx) => {
                                const isMe = myStore && item.storeNumber === myStore.number;
                                const score = item.score;
                                const getTier = (i: number) => {
                                    if (i === 0) return { label: 'Diamante', icon: <Gem className="text-cyan-400" size={14} />, color: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800', bar: 'bg-cyan-500' };
                                    if (i === 1) return { label: 'Esmeralda', icon: <Gem className="text-emerald-400" size={14} />, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', bar: 'bg-emerald-500' };
                                    if (i === 2) return { label: 'Ouro', icon: <Trophy className="text-amber-400" size={14} />, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800', bar: 'bg-amber-500' };
                                    if (i === 3) return { label: 'Prata', icon: <Medal className="text-slate-400" size={14} />, color: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700', bar: 'bg-slate-400' };
                                    if (i === 4) return { label: 'Bronze', icon: <Medal className="text-orange-400" size={14} />, color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800', bar: 'bg-orange-500' };
                                    if (i >= 8 && i <= 12) return { label: 'Subindo', icon: <TrendingUp className="text-blue-400" size={14} />, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30', bar: 'bg-blue-400' };
                                    if (i >= weightedRanking.length - 3) return { label: 'Rebaixamento', icon: <TrendingDown className="text-rose-400" size={14} />, color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30', bar: 'bg-rose-400' };
                                    return { label: 'Neutro', icon: <Minus className="text-slate-400" size={14} />, color: 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700', bar: 'bg-slate-200' };
                                };

                                const tier = getTier(idx);
                                const textColor = tier.color.split(' ')[1];
                                const advice = getDetailedAdvice(item, weightedRanking[idx - 1], idx);

                                return (
                                    <div key={idx} className={`p-4 sm:p-5 md:p-8 rounded-2xl sm:rounded-[32px] border transition-all duration-500 ${isMe ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 ring-4 sm:ring-8 ring-blue-50 dark:ring-blue-900/20 shadow-2xl shadow-blue-900/10 dark:shadow-blue-950/40 scale-[1.01] sm:scale-[1.02] z-20' : 'bg-slate-50/50 dark:bg-slate-900/40 border-transparent hover:bg-white dark:hover:bg-slate-900 hover:border-slate-100 dark:hover:border-slate-800 hover:shadow-xl'}`}>
                                        <div className="flex flex-col gap-4 sm:gap-6">
                                            {/* Header */}
                                            <div className="flex items-center gap-3 sm:gap-6">
                                                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center font-black italic text-lg sm:text-xl shadow-lg ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-white' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700'}`}>
                                                    <span className="text-[9px] sm:text-[10px] uppercase not-italic font-bold opacity-60 mb-0.5">{String(idx + 1).padStart(2, '0')}</span>
                                                    {tier.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                                                        <p className={`text-base sm:text-lg font-black uppercase italic ${isMe ? 'text-blue-950 dark:text-white underline decoration-blue-500 decoration-4 underline-offset-4' : 'text-slate-900 dark:text-white'}`}>Loja {item.storeNumber}</p>
                                                        <span className={`${tier.color} text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-widest border`}>
                                                            {tier.label}
                                                        </span>
                                                        {isMe && (
                                                            <span className="bg-blue-600 text-white text-[7px] font-black px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                                                                Sua Loja
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{item.city}</p>
                                                </div>
                                            </div>

                                            {/* Performance Bar */}
                                            <div className="w-full">
                                                <div className="flex justify-between items-end mb-2">
                                                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Performance Global</p>
                                                    <p className={`text-lg sm:text-xl font-black italic ${textColor}`}>{score.toFixed(1)}%</p>
                                                </div>
                                                <div className="h-1.5 sm:h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner mb-3 sm:mb-4">
                                                    <div className={`h-full transition-all duration-1000 ${tier.bar}`} style={{ width: `${Math.min(score, 100)}%` }} />
                                                </div>

                                                {/* Metrics Grid */}
                                                <div className={`grid gap-3 sm:gap-4 ${isMe ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
                                                    {isMe && (
                                                        <div className="flex flex-col items-center">
                                                            <p className="text-[7px] font-black text-slate-300 dark:text-slate-600 uppercase">Faturamento</p>
                                                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-tighter mb-1 border border-blue-100 dark:border-blue-900/30 shadow-sm">
                                                                Meta: {formatCurrency(item.revenueTarget)}
                                                            </div>
                                                            <p className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-slate-100 italic leading-none mb-1">{formatCurrency(item.revenueActual)}</p>
                                                            {item.revenueActual < item.revenueTarget && (
                                                                <p className="text-[7px] font-bold text-blue-500 dark:text-blue-400 uppercase leading-none">
                                                                    R$ {((item.revenueTarget - item.revenueActual) / getRemainingWorkDays(selectedMonth, item.storeId)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/dia
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col items-center">
                                                        <p className="text-[7px] font-black text-slate-300 dark:text-slate-600 uppercase">P.A</p>
                                                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-tighter mb-1 border border-blue-100 dark:border-blue-900/30 shadow-sm">
                                                            Meta: {item.paTarget.toFixed(2)}
                                                        </div>
                                                        <p className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-slate-100 italic leading-none mb-1">{item.paActual.toFixed(2)}</p>
                                                        <div className="w-8 sm:w-10 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full ${item.paActual >= item.paTarget ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                                style={{ width: `${Math.min((item.paActual / item.paTarget) * 100, 100)}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <p className="text-[7px] font-black text-slate-300 dark:text-slate-600 uppercase">P.U</p>
                                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-tighter mb-1 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                                                            Meta: {item.puTarget.toFixed(2)}
                                                        </div>
                                                        <p className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-slate-100 italic leading-none mb-1">{item.puActual.toFixed(2)}</p>
                                                        <div className="w-8 sm:w-10 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full ${item.puActual <= item.puTarget ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                                style={{ width: `${Math.min((item.puTarget / item.puActual) * 100, 100)}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <p className="text-[7px] font-black text-slate-300 dark:text-slate-600 uppercase">Ticket</p>
                                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-tighter mb-1 border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                                                            Meta: {formatCurrency(item.ticketTarget)}
                                                        </div>
                                                        <p className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-slate-100 italic leading-none mb-1">{formatCurrency(item.ticketActual)}</p>
                                                        <div className="w-8 sm:w-10 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full ${item.ticketActual >= item.ticketTarget ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                                style={{ width: `${Math.min((item.ticketActual / item.ticketTarget) * 100, 100)}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Advice */}
                                            {advice.acoes.length > 0 && (
                                                <div className="pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
                                                    {advice.acoes.map((line, i) => (
                                                        <div key={i} className="text-[8px] sm:text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-start gap-2">
                                                            <Zap size={10} className="text-blue-400 shrink-0 mt-0.5" /> 
                                                            <span className="flex-1">{line}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Action Plan Sidebar */}
                    <div className="lg:col-span-1 space-y-4 sm:space-y-6 order-1 lg:order-2">
                        {(() => {
                            const myIdx = weightedRanking.findIndex(item => myStore && item.storeNumber === myStore.number);
                            if (myIdx > 0) {
                                const curr = weightedRanking[myIdx];
                                const nextStore = weightedRanking[myIdx - 1];
                                const diff = nextStore.score - curr.score;
                                const advice = getDetailedAdvice(curr, nextStore, myIdx);
                                const storesAbove = weightedRanking.slice(Math.max(0, myIdx - 3), myIdx).reverse();

                                return (
                                    <div className="bg-blue-950 text-white p-5 sm:p-6 md:p-8 rounded-3xl sm:rounded-[48px] shadow-xl flex flex-col gap-4 sm:gap-6 border border-blue-800/50 animate-in slide-in-from-right duration-700">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className="p-2 sm:p-3 bg-blue-900 rounded-xl sm:rounded-2xl shadow-inner">
                                                <TrendingUp size={20} className="text-blue-300 sm:hidden" />
                                                <TrendingUp size={24} className="text-blue-300 hidden sm:block" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-400">Plano de Ação</p>
                                                <h4 className="text-xs sm:text-sm font-black italic uppercase">Próximo Nível</h4>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4 sm:space-y-6">
                                            <div className="space-y-2">
                                                <p className="text-[11px] sm:text-xs font-bold leading-relaxed">
                                                    Para passar a <span className="italic text-blue-200 font-black">Loja {nextStore.storeNumber}</span>, melhore seu score em <span className="text-blue-300 font-black">{diff.toFixed(1)}%</span>.
                                                </p>
                                                
                                                <div className="bg-blue-900/40 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-blue-800/30 space-y-2 sm:space-y-3">
                                                    {advice.acoes.map((line, i) => (
                                                        <p key={i} className="text-[9px] sm:text-[10px] text-blue-100 font-medium leading-tight flex items-start gap-2">
                                                            <Zap size={10} className="text-amber-400 mt-0.5 shrink-0" /> 
                                                            <span className="flex-1">{line}</span>
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-3 sm:pt-4 border-t border-blue-800/50 space-y-2 sm:space-y-3">
                                                <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-blue-400 mb-2">Metas de Ultrapassagem</p>
                                                {storesAbove.map((s, i) => {
                                                    const neededRev = getRevenueToPass(curr, s);
                                                    if (neededRev === null) {
                                                        return (
                                                            <div key={i} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-blue-900/20 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-blue-800/20">
                                                                <p className="text-[9px] sm:text-[10px] font-bold text-blue-100">Melhorar <span className="text-amber-400">P.A / P.U</span></p>
                                                                <p className="text-[7px] sm:text-[8px] font-black uppercase text-blue-400">Passar Loja {s.storeNumber}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div key={i} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-blue-900/20 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-blue-800/20">
                                                            <p className="text-[9px] sm:text-[10px] font-bold text-blue-100">Vender <span className="text-emerald-400">{formatCurrency(neededRev)}</span></p>
                                                            <p className="text-[7px] sm:text-[8px] font-black uppercase text-blue-400">Passar Loja {s.storeNumber}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            if (myIdx === 0) {
                                return (
                                    <div className="bg-emerald-600 text-white p-5 sm:p-6 md:p-8 rounded-3xl sm:rounded-[48px] shadow-xl flex items-center gap-4 sm:gap-6 border border-emerald-500 animate-in slide-in-from-right duration-700">
                                        <div className="p-3 sm:p-4 bg-emerald-500 rounded-2xl sm:rounded-3xl shadow-inner">
                                            <Trophy size={28} className="text-yellow-300 sm:hidden" />
                                            <Trophy size={32} className="text-yellow-300 hidden sm:block" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-1">Liderança Absoluta</p>
                                            <p className="text-xs sm:text-sm font-black italic uppercase">Você é o #01 da Rede!</p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                </div>
            </>
        ) : (
            <div className="p-12 sm:p-20 text-center bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 opacity-30 grayscale">
                <AlertCircle className="mx-auto mb-2" size={40} />
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em]">Aguardando dados online do período</p>
            </div>
        )}
        
        {/* Local Insight Modal */}
        {localInsight && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-4">
               <div className="bg-white dark:bg-slate-900 rounded-3xl sm:rounded-[40px] w-full max-w-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden max-h-[90vh] flex flex-col">
                    <div className="p-4 sm:p-6 bg-slate-900 dark:bg-slate-800 text-white flex justify-between items-center shrink-0">
                        <h3 className="text-xs sm:text-sm font-black uppercase italic tracking-tighter flex items-center gap-2">
                            <BrainCircuit className="text-blue-500 sm:hidden" size={16} />
                            <BrainCircuit className="text-blue-500 hidden sm:block" size={18} />
                            Plano de Ação <span className="text-blue-500">Gerencial</span>
                        </h3>
                        <button onClick={() => setLocalInsight(null)} className="hover:text-red-400 transition-colors p-1">
                            <X size={18} className="sm:hidden" />
                            <X size={20} className="hidden sm:block" />
                        </button>
                    </div>
                    <div className="p-4 sm:p-8 overflow-y-auto space-y-6">
                        {/* Prioridade */}
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                            <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                                <Zap size={20} className="text-amber-500" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Prioridade</p>
                                <p className="text-xs sm:text-sm font-black italic uppercase text-slate-900 dark:text-white">{localInsight.prioridade}</p>
                            </div>
                        </div>

                        {/* Meta */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <Target size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Meta de Faturamento</span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100/50 dark:border-blue-800/30">
                                {localInsight.meta}
                            </p>
                        </div>

                        {/* Indicadores */}
                        {localInsight.indicadores.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                    <Activity size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Atenção nos Indicadores</span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {localInsight.indicadores.map((ind, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-900/10 p-2.5 rounded-xl border border-rose-100/50 dark:border-rose-800/30">
                                            <TrendingDown size={14} />
                                            {ind}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ranking */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                <Trophy size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Posicionamento</span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100/50 dark:border-emerald-800/30">
                                {localInsight.ranking}
                            </p>
                        </div>

                        {/* Frase Motivacional */}
                        {localInsight.frase && (
                            <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white shadow-lg relative overflow-hidden group">
                                <Quote className="absolute -right-2 -bottom-2 text-white/10 group-hover:scale-110 transition-transform" size={80} />
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-100 mb-2">Dica do Dia</p>
                                <p className="text-xs sm:text-sm font-bold italic leading-relaxed relative z-10">"{localInsight.frase}"</p>
                            </div>
                        )}

                        {/* Ações Práticas */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <Zap size={16} className="text-yellow-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Ações Práticas</span>
                            </div>
                            <div className="space-y-2">
                                {localInsight.acoes.map((acao, i) => (
                                    <div key={i} className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                                        {acao}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={() => setLocalInsight(null)} className="w-full py-3 sm:py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-widest active:scale-95 transition-all shadow-lg hover:bg-black dark:hover:bg-slate-600">Entendido</button>
                    </div>
               </div>
           </div>
        )}
    </div>
  );
};

export default DashboardManager;

// ===== DASHBOARD ADMIN RESPONSIVO ABAIXO =====
