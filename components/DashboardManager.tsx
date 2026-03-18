import React, { useState, useMemo, useEffect } from 'react';
import { User, Store, ProductPerformance, IceCreamSangria, IceCreamStockMovement, IceCreamStock, UserRole } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { ShoppingBag, DollarSign, Package, Hash, AlertCircle, Trophy, BarChart3, TrendingUp, Target, Clock, BrainCircuit, Sparkles, Loader2, Zap, X, TrendingDown, Percent, Activity, Users, Medal, Gem, Minus } from 'lucide-react';
import { analyzePerformance } from '../services/geminiService';

interface DashboardManagerProps {
  user: User;
  stores: Store[];
  performanceData: any[]; 
  purchasingData: ProductPerformance[];
  sangrias: IceCreamSangria[];
  stockMovements: IceCreamStockMovement[];
  stock: IceCreamStock[];
}

const KPICard = ({ label, value, target, icon: Icon, type = 'currency', mode = 'higher' }: { label: string, value: number, target?: number, icon: any, type?: 'currency' | 'decimal' | 'integer', mode?: 'higher' | 'lower' }) => {
  const calcAttainment = (actual: number, target: number, mode: 'higher' | 'lower') => {
    if (!actual || !target) return 0;
    return mode === 'higher' ? (actual / target) * 100 : (target / actual) * 100;
  };

  const ating = target && target > 0 ? calcAttainment(value, target, mode) : 0;
  const isOk = mode === 'higher' ? value >= (target || 0) : value <= (target || 999999);
  const isWarning = mode === 'higher' ? ating < 80 : ating < 80; // Atingimento < 80% é sempre alerta
  
  let barColor = 'bg-blue-500';
  let textColor = 'text-blue-900';
  
  if (isOk) {
    barColor = 'bg-green-500';
    textColor = 'text-green-600';
  } else if (ating < 50) {
    barColor = 'bg-red-500';
    textColor = 'text-red-600';
  } else {
    barColor = 'bg-amber-500';
    textColor = 'text-amber-600';
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

const DashboardManager: React.FC<DashboardManagerProps> = ({ user, stores, performanceData, sangrias, stockMovements, stock }) => {
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    if (user.role === UserRole.ADMIN) {
      const saved = localStorage.getItem('admin_selected_store_id');
      if (saved) return saved;
    }
    return user.storeId || '';
  });
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  useEffect(() => {
    if (stores.length > 0 && selectedStoreId === '') {
      if (user.role === UserRole.ADMIN) {
        const store26 = stores.find(s => s.number === '26');
        if (store26) {
          setSelectedStoreId(store26.id);
          return;
        }
      }
      setSelectedStoreId(user.storeId || stores[0]?.id || '');
    }
  }, [stores, user.role, user.storeId, selectedStoreId]);

  const handleStoreSelect = (id: string) => {
    setSelectedStoreId(id);
    if (user.role === UserRole.ADMIN) {
      localStorage.setItem('admin_selected_store_id', id);
    }
  };

  const myStore = useMemo(() => stores.find(s => s.id === selectedStoreId) || stores[0], [stores, selectedStoreId]);

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

      // Usando indicadores vindos diretamente do banco (já calculados na planilha)
      const finalPA = Number(storeMonthData[0]?.paActual || 0);
      const finalPU = Number(storeMonthData[0]?.puActual || 0);
      const finalTicket = Number(storeMonthData[0]?.averageTicket || 0);

      // Para os targets de média, pegamos a média aritmética se houver mais de um registro
      const finalPATarget = aggregated.paTarget / storeMonthData.length;
      const finalPUTarget = aggregated.puTarget / storeMonthData.length;
      const finalTicketTarget = aggregated.ticketTarget / storeMonthData.length;

      // Sangrias da Loja no Mês
      const mySangrias = sangrias.filter(s => 
        String(s.store_id) === String(myStore.id) && 
        s.created_at.startsWith(selectedMonth)
      );
      const totalSangria = mySangrias.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

      // Avarias da Loja no Mês
      const myAvarias = stockMovements.filter(m => 
        String(m.store_id) === String(myStore.id) && 
        m.movement_type === 'AVARIA' &&
        m.created_at.startsWith(selectedMonth)
      );
      // Aqui as avarias são em quantidade, mas o DRE pedia valor. 
      // Como não temos o custo unitário fácil aqui, vamos mostrar a quantidade ou estimar.
      // O usuário pediu "Total Avarias" no resumo operacional anterior.
      const totalAvariasQty = myAvarias.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);

      // Lucro e Margem (Simplificado: Receita - Sangria)
      const profit = aggregated.revenueActual - totalSangria;
      const margin = aggregated.revenueActual > 0 ? (profit / aggregated.revenueActual) * 100 : 0;

      // Estoque Crítico
      const criticalStock = stock.filter(s => 
        String(s.store_id) === String(myStore.id) && 
        Number(s.stock_current || 0) <= 5 // Exemplo de limite crítico
      ).length;

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
  }, [performanceData, selectedMonth, myStore, sangrias, stockMovements, stock]);

  const scoreBasedRanking = useMemo(() => {
      const monthData = performanceData.filter(p => String(p.month) === selectedMonth);
      
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

      const ranked = Object.keys(storeAggregation).map(storeId => {
          const p = storeAggregation[storeId];
          const store = stores.find(s => String(s.id) === storeId);
          
          const calcPercent = (act: number, tgt: number, mode: 'higher' | 'lower') => {
              if (!tgt || tgt <= 0) return 0;
              const val = mode === 'higher' ? (act / tgt) * 100 : (tgt / act) * 100;
              return Math.min(val, 120);
          };

          const pF = calcPercent(p.revenueActual, p.revenueTarget, 'higher');
          const paActual = Number(monthData.find(md => String(md.storeId || md.store_id) === storeId)?.paActual || 0);
          const pPA = calcPercent(paActual, p.paTarget, 'higher');
          const tktActual = Number(monthData.find(md => String(md.storeId || md.store_id) === storeId)?.averageTicket || 0);
          const pT = calcPercent(tktActual, p.ticketTarget, 'higher');
          const puActual = Number(monthData.find(md => String(md.storeId || md.store_id) === storeId)?.puActual || 0);
          const pPU = calcPercent(puActual, p.puTarget, 'lower');

          const scoreFinal = (pF * 0.50) + (pPA * 0.40) + (pPU * 0.05) + (pT * 0.05);

          return {
              storeId,
              storeNumber: store?.number || '?',
              city: store?.city || '?',
              score: scoreFinal,
              revenueActual: p.revenueActual,
              revenueTarget: p.revenueTarget,
              paActual,
              paTarget: p.paTarget,
              ticketActual: tktActual,
              ticketTarget: p.ticketTarget,
              puActual,
              puTarget: p.puTarget,
              salesActual: p.salesActual,
              itemsActual: p.itemsActual
          };
      });

      return ranked.sort((a, b) => b.score - a.score);
  }, [performanceData, selectedMonth, stores]);

  const weightedRanking = useMemo(() => {
      if (user.role === UserRole.ADMIN) {
          return [...scoreBasedRanking].sort((a, b) => {
              const nameA = `${a.city} ${a.storeNumber}`;
              const nameB = `${b.city} ${b.storeNumber}`;
              return nameA.localeCompare(nameB);
          });
      }
      return scoreBasedRanking;
  }, [scoreBasedRanking, user.role]);

  const handleGenerateInsight = async () => {
    if (!myStore) return;
    setIsLoadingAi(true);
    try {
        const insight = await analyzePerformance(performanceData, stores, 'MANAGER', myStore.id);
        setAiInsight(insight);
    } catch (e) { alert("Erro IA"); } finally { setIsLoadingAi(false); }
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
    
    // Contar dias úteis restantes no mês (excluindo domingos)
    let remainingCount = 0;
    for (let d = startDay; d <= lastDay; d++) {
        const date = new Date(year, month - 1, d);
        if (date.getDay() !== 0) { // 0 é Domingo
            remainingCount++;
        }
    }

    // Se tivermos o storeId, podemos ajustar baseado nos dias úteis configurados na meta
    if (storeId) {
        const storePerf = performanceData.find(p => String(p.storeId || p.store_id) === String(storeId) && String(p.month) === monthStr);
        if (storePerf && storePerf.businessDays) {
            // Contar total de dias úteis no mês (excluindo domingos)
            let totalWorkDays = 0;
            for (let d = 1; d <= lastDay; d++) {
                const date = new Date(year, month - 1, d);
                if (date.getDay() !== 0) totalWorkDays++;
            }
            
            // Dias úteis que já passaram (excluindo domingos)
            const passedWorkDays = totalWorkDays - remainingCount;
            
            // Dias restantes baseados na meta configurada
            const adjustedRemaining = storePerf.businessDays - passedWorkDays;
            return Math.max(adjustedRemaining, 1);
        }
    }

    return Math.max(remainingCount, 1);
  };

  const getDetailedAdvice = (curr: any, next?: any) => {
    const remainingDays = getRemainingWorkDays(selectedMonth, curr.storeId);
    const targetStore = next || curr;
    
    // Se for o próprio curr, as metas são dele mesmo
    const revDiff = Math.max(targetStore.revenueTarget - curr.revenueActual, 0);
    const dailyRev = revDiff / remainingDays;
    
    let advice = [];
    
    if (revDiff > 0) {
        advice.push(`Venda R$ ${formatDecimal(dailyRev)}/dia para bater a meta.`);
    }

    if (curr.paActual < targetStore.paTarget) {
        const itemsNeeded = Math.ceil((targetStore.paTarget * curr.salesActual) - curr.itemsActual);
        if (itemsNeeded > 0) advice.push(`Venda +${itemsNeeded} itens no total para atingir P.A ${targetStore.paTarget.toFixed(2)}.`);
    }

    if (curr.ticketActual < targetStore.ticketTarget) {
        const tktDiff = targetStore.ticketTarget - curr.ticketActual;
        advice.push(`Aumente o Ticket Médio em R$ ${formatDecimal(tktDiff)}.`);
    }

    if (curr.puActual > targetStore.puTarget) {
        const puDiff = curr.puActual - targetStore.puTarget;
        advice.push(`Reduza o P.U em R$ ${formatDecimal(puDiff)} (foco em itens de menor valor).`);
    }

    return advice;
  };

  const getRevenueToPass = (curr: any, target: any) => {
    // Nova métrica: Meta 50%, P.A 40%, P.U 5%, Ticket 5%
    // Score = (Rev/Tgt * 0.5) + (PA/Tgt * 0.4) + (PUTgt/PU * 0.05) + (Tkt/Tgt * 0.05)
    
    if (!curr.revenueTarget || curr.revenueTarget <= 0) return null;

    const safeRatio = (act: number, tgt: number, mode: 'higher' | 'lower') => {
        if (!tgt || tgt <= 0) return 0;
        const val = mode === 'higher' ? (act / tgt) : (tgt / act);
        return Math.min(val, 1.2);
    };

    const otherMetricsWeight = (
        (safeRatio(curr.paActual, curr.paTarget, 'higher') * 0.40) +
        (safeRatio(curr.puActual, curr.puTarget, 'lower') * 0.05) +
        (safeRatio(curr.ticketActual, curr.ticketTarget, 'higher') * 0.05)
    );

    const targetScoreDecimal = target.score / 100;
    const neededRevRatio = (targetScoreDecimal - otherMetricsWeight) / 0.50;
    
    // Se neededRevRatio > 1.2, significa que mesmo atingindo 120% da meta de faturamento,
    // não será suficiente para passar a loja apenas com faturamento (devido ao cap de 120%).
    if (neededRevRatio > 1.2) return null;
    
    const neededTotalRev = neededRevRatio * curr.revenueTarget;
    const diff = neededTotalRev - curr.revenueActual;
    
    return diff > 0 ? diff : null;
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
                {user.role === UserRole.ADMIN && (
                    <select 
                        value={selectedStoreId}
                        onChange={e => handleStoreSelect(e.target.value)}
                        className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black text-blue-900 uppercase border-none outline-none cursor-pointer ml-2"
                    >
                        {stores.map(s => (
                            <option key={s.id} value={s.id}>{s.name} #{s.number}</option>
                        ))}
                    </select>
                )}
            </div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <select 
                        value={selectedMonth.split('-')[1]} 
                        onChange={e => {
                            const [year] = selectedMonth.split('-');
                            setSelectedMonth(`${year}-${e.target.value}`);
                        }}
                        className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black text-blue-900 uppercase border-none outline-none cursor-pointer"
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
                        className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black text-blue-900 uppercase border-none outline-none cursor-pointer"
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
                <button onClick={handleGenerateInsight} disabled={isLoadingAi} className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg active:scale-95 transition-all">
                    {isLoadingAi ? <Loader2 className="animate-spin" size={16} /> : <Sparkles className="text-amber-400" size={16} />}
                </button>
            </div>
        </div>

        {myPerformance ? (
            <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard label="Faturamento" value={myPerformance.revAct} target={myPerformance.revTgt} icon={DollarSign} />
                    <KPICard label="P.A Médio" value={myPerformance.paAct} target={myPerformance.paTgt} icon={ShoppingBag} type="decimal" />
                    <KPICard label="P.U Médio" value={myPerformance.puAct} target={myPerformance.puTgt} icon={Percent} type="decimal" />
                    <KPICard label="Ticket Médio" value={myPerformance.tktAct} target={myPerformance.tktTgt} icon={Users} type="currency" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[48px] shadow-sm border border-slate-100 order-2 lg:order-1">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><Trophy size={24} /></div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">Ranking <span className="text-blue-600">Ponderado</span></h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Equilíbrio de Metas (50/40/5/5)</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {weightedRanking.map((item, idx) => {
                                const isMe = user.storeId && item.storeId === user.storeId;
                                const isSelected = item.storeId === selectedStoreId;
                                const score = item.score;
                                 const getTier = (i: number) => {
                                    if (i === 0) return { label: 'Diamante', icon: <Gem className="text-cyan-400" size={16} />, color: 'bg-cyan-50 text-cyan-600 border-cyan-200', bar: 'bg-cyan-500' };
                                    if (i === 1) return { label: 'Esmeralda', icon: <Gem className="text-emerald-400" size={16} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-200', bar: 'bg-emerald-500' };
                                    if (i === 2) return { label: 'Ouro', icon: <Trophy className="text-amber-400" size={16} />, color: 'bg-amber-50 text-amber-600 border-amber-200', bar: 'bg-amber-500' };
                                    if (i === 3) return { label: 'Prata', icon: <Medal className="text-slate-400" size={16} />, color: 'bg-slate-50 text-slate-600 border-slate-200', bar: 'bg-slate-400' };
                                    if (i === 4) return { label: 'Bronze', icon: <Medal className="text-orange-400" size={16} />, color: 'bg-orange-50 text-orange-600 border-orange-200', bar: 'bg-orange-500' };
                                    if (i === 5) return { label: 'Ouro', icon: <Zap className="text-amber-400" size={16} />, color: 'bg-amber-50 text-amber-600 border-amber-100', bar: 'bg-amber-400' };
                                    if (i === 6) return { label: 'Prata', icon: <Zap className="text-slate-400" size={16} />, color: 'bg-slate-50 text-slate-600 border-slate-100', bar: 'bg-slate-300' };
                                    if (i === 7) return { label: 'Bronze', icon: <Zap className="text-orange-400" size={16} />, color: 'bg-orange-50 text-orange-600 border-orange-100', bar: 'bg-orange-300' };
                                    if (i >= 8 && i <= 12) return { label: 'Subindo', icon: <TrendingUp className="text-blue-400" size={16} />, color: 'bg-blue-50 text-blue-600 border-blue-100', bar: 'bg-blue-400' };
                                    if (i >= 13 && i <= 17) return { label: 'Neutro', icon: <Minus className="text-slate-400" size={16} />, color: 'bg-slate-50 text-slate-400 border-slate-100', bar: 'bg-slate-200' };
                                    if (i >= weightedRanking.length - 3) return { label: 'Rebaixamento', icon: <TrendingDown className="text-rose-400" size={16} />, color: 'bg-rose-50 text-rose-600 border-rose-100', bar: 'bg-rose-400' };
                                    return { label: 'Neutro', icon: <Minus className="text-slate-400" size={16} />, color: 'bg-slate-50 text-slate-400 border-slate-100', bar: 'bg-slate-200' };
                                };

                                const tier = getTier(idx);
                                const textColor = tier.color.split(' ')[1];
                                const advice = getDetailedAdvice(item, weightedRanking[idx - 1]);

                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => user.role === UserRole.ADMIN && handleStoreSelect(item.storeId)}
                                        className={`p-5 md:p-8 rounded-[32px] border transition-all duration-500 ${isSelected ? 'bg-white border-blue-200 ring-8 ring-blue-50 shadow-2xl shadow-blue-900/10 scale-[1.02] z-20' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-slate-100 hover:shadow-xl'} ${user.role === UserRole.ADMIN ? 'cursor-pointer' : ''}`}
                                    >
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                            <div className="flex items-center gap-6">
                                                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black italic text-xl shadow-lg ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-white' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                    <span className="text-[10px] uppercase not-italic font-bold opacity-60 mb-0.5">{String(idx + 1).padStart(2, '0')}</span>
                                                    {tier.icon}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <p className={`text-lg font-black uppercase italic ${isSelected ? 'text-blue-950 underline decoration-blue-500 decoration-4 underline-offset-4' : 'text-slate-900'}`}>Loja {item.storeNumber}</p>
                                                        <span className={`${tier.color} text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border`}>
                                                            {tier.label}
                                                        </span>
                                                        {isMe && (
                                                            <span className="bg-blue-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                                                                Sua Loja
                                                            </span>
                                                        )}
                                                        {isSelected && !isMe && user.role === UserRole.ADMIN && (
                                                            <span className="bg-slate-900 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                                Visualizando
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.city}</p>
                                                </div>
                                            </div>

                                            <div className="flex-1 w-full md:max-w-md">
                                                <div className="flex justify-between items-end mb-2">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Performance Global</p>
                                                    <p className={`text-xl font-black italic ${textColor}`}>{score.toFixed(1)}%</p>
                                                </div>
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner mb-4">
                                                    <div className={`h-full transition-all duration-1000 ${tier.bar}`} style={{ width: `${Math.min(score, 100)}%` }} />
                                                </div>

                                                <div className={`grid gap-4 justify-center ${isMe ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
                                                    {isMe && (
                                                        <div className="flex flex-col items-center md:items-end">
                                                            <p className="text-[7px] font-black text-slate-300 uppercase">Faturamento</p>
                                                            <div className="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter mb-1 border border-blue-100 shadow-sm">
                                                                Meta: {formatCurrency(item.revenueTarget)}
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-900 italic leading-none mb-1">{formatCurrency(item.revenueActual)}</p>
                                                            {item.revenueActual < item.revenueTarget && (
                                                                <p className="text-[7px] font-bold text-blue-500 uppercase">
                                                                    R$ {((item.revenueTarget - item.revenueActual) / getRemainingWorkDays(selectedMonth, item.storeId)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/dia
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col items-center">
                                                        <p className="text-[7px] font-black text-slate-300 uppercase">P.A</p>
                                                        <div className="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter mb-1 border border-blue-100 shadow-sm">
                                                            Meta: {item.paTarget.toFixed(2)}
                                                        </div>
                                                        <p className="text-[11px] font-black text-slate-900 italic leading-none mb-1">{item.paActual.toFixed(2)}</p>
                                                        <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-400" style={{ width: `${Math.min((item.paActual / item.paTarget) * 100, 100)}%` }} />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <p className="text-[7px] font-black text-slate-300 uppercase">P.U</p>
                                                        <div className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter mb-1 border border-emerald-100 shadow-sm">
                                                            Meta: {item.puTarget.toFixed(2)}
                                                        </div>
                                                        <p className="text-[11px] font-black text-slate-900 italic leading-none mb-1">{item.puActual.toFixed(2)}</p>
                                                        <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-400" style={{ width: `${Math.min((item.puTarget / item.puActual) * 100, 100)}%` }} />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <p className="text-[7px] font-black text-slate-300 uppercase">Ticket</p>
                                                        <div className="bg-indigo-50 text-indigo-600 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter mb-1 border border-indigo-100 shadow-sm">
                                                            Meta: {formatCurrency(item.ticketTarget)}
                                                        </div>
                                                        <p className="text-[11px] font-black text-slate-900 italic leading-none mb-1">{formatCurrency(item.ticketActual)}</p>
                                                        <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-400" style={{ width: `${Math.min((item.ticketActual / item.ticketTarget) * 100, 100)}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {advice.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-slate-100 space-y-1">
                                                {advice.map((line, i) => (
                                                    <div key={i} className="text-[9px] font-bold text-slate-500 flex items-center gap-2">
                                                        <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0" /> {line}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-1 space-y-6 order-1 lg:order-2">
                        {/* Card Plano de Ação */}
                        {(() => {
                            const myIdx = scoreBasedRanking.findIndex(item => myStore && item.storeNumber === myStore.number);
                            if (myIdx > 0) {
                                const curr = scoreBasedRanking[myIdx];
                                const nextStore = scoreBasedRanking[myIdx - 1];
                                const diff = nextStore.score - curr.score;
                                const advice = getDetailedAdvice(curr, nextStore);
                                
                                // Pegar as 3 lojas acima para mostrar quanto falta
                                const storesAbove = scoreBasedRanking.slice(Math.max(0, myIdx - 3), myIdx).reverse();

                                return (
                                    <div className="bg-blue-950 text-white p-8 rounded-[48px] shadow-xl flex flex-col gap-6 border border-blue-800/50 animate-in slide-in-from-right duration-700">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-blue-900 rounded-2xl shadow-inner"><TrendingUp size={24} className="text-blue-300" /></div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Plano de Ação</p>
                                                <h4 className="text-sm font-black italic uppercase">Próximo Nível</h4>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold leading-relaxed">
                                                    Para passar a <span className="italic text-blue-200 font-black">Loja {nextStore.storeNumber}</span>, melhore seu score em <span className="text-blue-300 font-black">{diff.toFixed(1)}%</span>.
                                                </p>
                                                
                                                <div className="bg-blue-900/40 p-5 rounded-3xl border border-blue-800/30 space-y-3">
                                                    {advice.map((line, i) => (
                                                        <p key={i} className="text-[10px] text-blue-100 font-medium leading-tight flex items-start gap-2">
                                                            <Zap size={10} className="text-amber-400 mt-0.5 shrink-0" /> {line}
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-blue-800/50 space-y-3">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-2">Metas de Ultrapassagem (Diário)</p>
                                                {storesAbove.map((s, i) => {
                                                    const neededRev = getRevenueToPass(curr, s);
                                                    const remainingDays = getRemainingWorkDays(selectedMonth, curr.storeId);
                                                    
                                                    if (neededRev === null) {
                                                        return (
                                                            <div key={i} className="flex justify-between items-center bg-blue-900/20 p-3 rounded-2xl border border-blue-800/20">
                                                                <p className="text-[10px] font-bold text-blue-100">Melhorar <span className="text-amber-400">P.A / P.U</span></p>
                                                                <p className="text-[8px] font-black uppercase text-blue-400">Passar Loja {s.storeNumber}</p>
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    const dailyNeeded = neededRev / remainingDays;
                                                    
                                                    return (
                                                        <div key={i} className="flex justify-between items-center bg-blue-900/20 p-3 rounded-2xl border border-blue-800/20">
                                                            <p className="text-[10px] font-bold text-blue-100">Vender <span className="text-emerald-400">R$ {formatDecimal(dailyNeeded)}/dia</span></p>
                                                            <p className="text-[8px] font-black uppercase text-blue-400">Passar Loja {s.storeNumber}</p>
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
                                    <div className="bg-emerald-600 text-white p-8 rounded-[48px] shadow-xl flex items-center gap-6 border border-emerald-500 animate-in slide-in-from-right duration-700">
                                        <div className="p-4 bg-emerald-500 rounded-3xl shadow-inner"><Trophy size={32} className="text-yellow-300" /></div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-1">Liderança Absoluta</p>
                                            <p className="text-sm font-black italic uppercase">Você é o #01 da Rede!</p>
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