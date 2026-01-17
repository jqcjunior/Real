
import React, { useState, useMemo, useEffect } from 'react';
import { User, Store, MonthlyPerformance, ProductPerformance, SellerGoal } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { 
  ShoppingBag, Target, Tag, CreditCard, TrendingUp, TrendingDown, 
  Calendar, Award, AlertCircle, ArrowUpRight, ArrowDownRight, Package, Loader2, Trophy, Medal, Crown, Users, UserCheck, Star, Zap, Clock, BarChart3, Hash, Percent, DollarSign, Box, Wifi, ChevronDown
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface DashboardManagerProps {
  user: User;
  stores: Store[];
  performanceData: MonthlyPerformance[];
  purchasingData: ProductPerformance[];
}

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const GoalProgressBar = ({ percent }: { percent: number }) => {
  const safePercent = Math.min(Math.max(0, Number(percent) || 0), 120);
  
  const getBarColor = (p: number) => {
    if (p < 80) return 'bg-red-500';
    if (p < 95) return 'bg-yellow-500';
    if (p <= 105) return 'bg-green-500';
    return 'bg-blue-500';
  };

  const getTextColor = (p: number) => {
    if (p < 80) return 'text-red-600';
    if (p < 95) return 'text-yellow-600';
    if (p <= 105) return 'text-green-600';
    return 'text-blue-600';
  };

  return (
    <div className="space-y-1.5 mt-2">
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
        <div 
          className={`h-full transition-all duration-1000 ease-out ${getBarColor(safePercent)}`} 
          style={{ width: `${Math.min(safePercent, 100)}%` }}
        />
      </div>
      <div className={`text-right text-[10px] font-black italic ${getTextColor(safePercent)}`}>
        {safePercent.toFixed(1)}%
      </div>
    </div>
  );
};

// Componente para QUADROS DE MÉTRICA INDIVIDUAL
const KPIHighlightCard = ({ 
  label, 
  value, 
  target, 
  icon: Icon, 
  type = 'currency', 
  invertColor = false 
}: { 
  label: string, 
  value: number, 
  target?: number, 
  icon: React.ElementType, 
  type?: 'currency' | 'decimal' | 'percent' | 'integer',
  invertColor?: boolean
}) => {
  const formattedValue = useMemo(() => {
    if (type === 'currency') return formatCurrency(value);
    if (type === 'decimal') return value.toFixed(2);
    if (type === 'percent') return `${value.toFixed(2)}%`;
    if (type === 'integer') return value.toLocaleString('pt-BR');
    return value;
  }, [value, type]);

  const formattedTarget = useMemo(() => {
    if (!target) return null;
    if (type === 'currency') return formatCurrency(target);
    if (type === 'decimal') return target.toFixed(2);
    if (type === 'percent') return `${target.toFixed(2)}%`;
    return target.toLocaleString('pt-BR');
  }, [target, type]);

  // Se invertColor for true, valor baixo é melhor (verde). Usado para Inadimplência e agora para P.U conforme solicitado.
  const isSuccess = target ? (invertColor ? value <= target : value >= target) : true;
  const colorClass = target ? (isSuccess ? 'text-green-600' : 'text-red-600') : 'text-blue-900';

  return (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col justify-between hover:border-blue-200 transition-all group min-h-[160px]">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 bg-gray-50 ${colorClass} rounded-2xl group-hover:scale-110 transition-transform`}><Icon size={24} /></div>
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
      </div>
      <div>
        <h3 className={`text-xl md:text-2xl font-black italic tracking-tighter ${colorClass}`}>{formattedValue}</h3>
        {target !== undefined && (
          <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
            <span className="text-[8px] font-black text-gray-400 uppercase">Objetivo:</span>
            {/* Texto da meta escurecido para melhor visualização conforme solicitado */}
            <span className="text-[10px] font-black text-gray-700">{formattedTarget}</span>
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

  const myStore = useMemo(() => (stores || []).find(s => s.id === user.storeId) || stores[0], [stores, user.storeId]);
  
  const myData = useMemo(() => (performanceData || []).find(p => p.storeId === myStore?.id && p.month === selectedMonth), [performanceData, selectedMonth, myStore]);

  const salesPulse = useMemo(() => {
    if (!myData) return null;
    const now = new Date();
    const isCurrentMonth = selectedMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!isCurrentMonth) return null;

    const nTarget = Number(myData.revenueTarget) || 0;
    const nActual = Number(myData.revenueActual) || 0;
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = lastDayOfMonth - now.getDate() + 1; 
    const dailyTarget = Math.max(0, nTarget - nActual) / Math.max(1, remainingDays);
    return { dailyTarget, remainingDays, currentRitmo: nActual / Math.max(1, now.getDate()) };
  }, [myData, selectedMonth]);

  // RANKING GLOBAL COM CRITÉRIOS DE PESO SOLICITADOS
  const weightedRanking = useMemo(() => {
      const results = (performanceData || [])
        .filter(p => p.month === selectedMonth)
        .map(item => {
            const s = (stores || []).find(st => st.id === item.storeId);
            if (!s) return null;

            // Normalização das métricas para o Score (Máximo 110% por KPI para evitar outliers gigantes)
            const getScore = (actual: number, target: number) => target > 0 ? Math.min((actual / target) * 100, 110) : 0;
            
            // Lógica inversa: menor que o target é melhor (verde)
            const getInvertedScore = (actual: number, target: number) => {
                if (target <= 0) return 0;
                if (actual <= target) return 100;
                return Math.max(0, 100 - ((actual - target) / target * 100));
            };

            const scoreMeta = getScore(item.revenueActual, item.revenueTarget);
            const scorePA = getScore(item.itemsPerTicket, item.paTarget || 2.0);
            
            // P.U agora segue lógica inversa (menor é melhor) conforme solicitado
            const scorePU = getInvertedScore(item.unitPriceAverage, item.puTarget || 60);
            
            const scoreTicket = getScore(item.averageTicket, item.ticketTarget || 120);
            const scoreItens = getScore(item.itemsActual || 0, item.itemsTarget || 1000);
            const scoreInad = getInvertedScore(item.delinquencyRate, item.delinquencyTarget || 2.0);

            // PESOS DEFINIDOS: Meta (50%), Outros (10% cada)
            const finalScore = (scoreMeta * 0.50) + (scorePA * 0.10) + (scorePU * 0.10) + (scoreTicket * 0.10) + (scoreItens * 0.10) + (scoreInad * 0.10);

            return {
                number: s.number,
                name: s.name,
                percentMeta: Number(item.percentMeta) || 0,
                finalScore,
                isMine: s.id === myStore?.id
            };
        })
        .filter(Boolean) as any[];

      return results.sort((a, b) => b.finalScore - a.finalScore);
  }, [performanceData, selectedMonth, stores, myStore]);

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-20">
        {/* HEADER */}
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
                <div className="p-4 bg-blue-600 rounded-[24px] text-white shadow-lg"><ShoppingBag size={28} /></div>
                <div>
                    <h2 className="text-3xl font-black text-gray-900 uppercase italic leading-none flex items-center gap-3">
                        {myStore?.name || 'Unidade Real'} <span className="text-gray-300 ml-2">#{myStore?.number || '---'}</span>
                    </h2>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-2">Dashboard de Unidade Estratégico</p>
                </div>
            </div>
            <div className="flex gap-3">
                <div className="bg-gray-50 p-1.5 rounded-2xl border border-gray-200 shadow-inner flex items-center gap-2">
                    <Calendar className="text-blue-600 ml-2" size={16} />
                    <select value={parseInt(selectedMonth.split('-')[1])} onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))} className="bg-transparent pr-2 py-2 rounded-xl text-xs font-black uppercase outline-none cursor-pointer">{MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                    <div className="w-px h-6 bg-gray-200"></div>
                    <select value={parseInt(selectedMonth.split('-')[0])} onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))} className="bg-transparent px-2 py-2 rounded-xl text-xs font-black outline-none cursor-pointer">{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
                </div>
            </div>
        </div>

        {/* RITMO DE VENDAS */}
        {salesPulse && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gradient-to-br from-blue-900 to-blue-950 p-10 rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><Target size={120} /></div>
                <div className="relative z-10"><span className="text-[10px] font-black text-blue-300 uppercase block mb-3 tracking-widest">Ritmo Atual</span><h3 className="text-4xl font-black italic tracking-tighter">{formatCurrency(salesPulse.currentRitmo)}<span className="text-sm font-bold text-blue-400 not-italic ml-2">/dia</span></h3></div>
                <div className="relative z-10"><span className="text-[10px] font-black text-red-400 uppercase block mb-3 tracking-widest">Meta Diária Restante</span><h3 className="text-4xl font-black italic tracking-tighter text-red-500">{formatCurrency(salesPulse.dailyTarget)}<span className="text-sm font-bold text-red-400 not-italic ml-2">/dia</span></h3></div>
                <div className="relative z-10"><span className="text-[10px] font-black text-blue-300 uppercase block mb-3 tracking-widest">Operação</span><h3 className="text-4xl font-black italic tracking-tighter">{salesPulse.remainingDays} <span className="text-sm font-bold text-blue-400 not-italic">DIAS RESTANTES</span></h3></div>
            </div>
        )}

        {/* GRADE DE QUADROS DE MÉTRICAS INDIVIDUAIS */}
        {myData ? (
            <div className="space-y-6">
                <div className="flex items-center gap-3 ml-4">
                    <BarChart3 className="text-blue-600" size={24} />
                    <h3 className="text-sm font-black uppercase text-gray-400 tracking-[0.3em]">Performance da Unidade</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <KPIHighlightCard label="Faturamento" value={myData.revenueActual} target={myData.revenueTarget} icon={DollarSign} type="currency" />
                    <KPIHighlightCard label="Itens Vendidos" value={myData.itemsActual || 0} target={myData.itemsTarget} icon={Package} type="integer" />
                    <KPIHighlightCard label="P.A (Peças por Atend.)" value={myData.itemsPerTicket} target={myData.paTarget} icon={Hash} type="decimal" />
                    
                    {/* P.U COM LÓGICA INVERSA (Verde se for baixo) conforme solicitado */}
                    <KPIHighlightCard label="P.U (Preço Unitário)" value={myData.unitPriceAverage} target={myData.puTarget} icon={Tag} type="currency" invertColor />
                    
                    <KPIHighlightCard label="Ticket Médio" value={myData.averageTicket} target={myData.ticketTarget} icon={ShoppingBag} type="currency" />
                    <KPIHighlightCard label="Inadimplência" value={myData.delinquencyRate} target={myData.delinquencyTarget} icon={AlertCircle} type="percent" invertColor />
                </div>
            </div>
        ) : (
            <div className="p-20 text-center bg-white rounded-[48px] shadow-sm border-2 border-dashed border-gray-100">
                <AlertCircle className="mx-auto text-gray-200 mb-6" size={64} />
                <p className="text-gray-400 font-black uppercase text-xs tracking-widest">Aguardando Lançamento de Metas</p>
            </div>
        )}
        
        {/* RANKING GLOBAL SIMPLIFICADO */}
        <div className="max-w-4xl mx-auto">
            <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-center mb-8 border-b pb-6">
                    <h3 className="text-xl font-black uppercase italic text-gray-900 tracking-tighter flex items-center gap-3">
                        <Trophy className="text-yellow-500"/> Ranking Rede <span className="text-gray-300 font-normal italic">Consolidado</span>
                    </h3>
                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-[0.2em] bg-gray-50 px-3 py-1.5 rounded-full">Cálculo Ponderado Corporativo</span>
                </div>
                
                <div className="space-y-4 overflow-y-auto max-h-[700px] no-scrollbar pr-2 flex-1">
                    {(weightedRanking || []).map((item, idx) => (
                        <div key={item.number} className={`p-6 rounded-[32px] flex flex-col transition-all border ${item.isMine ? 'bg-blue-50 border-blue-200 shadow-lg ring-4 ring-blue-50/50' : 'bg-gray-50 border-gray-100'}`}>
                            <div className="flex justify-between items-center gap-6">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <span className={`text-[11px] font-black w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${item.isMine ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>#{idx+1}</span>
                                    <div className="truncate">
                                        <span className="font-black text-xs md:text-sm uppercase tracking-tighter text-gray-900 block leading-none truncate">
                                            LOJA {item.number} - {item.name.toUpperCase()}
                                        </span>
                                        {item.isMine && <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest mt-1.5 inline-block">Sua Unidade</span>}
                                    </div>
                                </div>
                                <div className="w-32 md:w-56 shrink-0">
                                    <GoalProgressBar percent={item.percentMeta} />
                                </div>
                            </div>
                        </div>
                    ))}
                    {weightedRanking.length === 0 && (
                        <div className="py-20 text-center opacity-20">
                            <BarChart3 size={48} className="mx-auto mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Sem dados no período</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default DashboardManager;
