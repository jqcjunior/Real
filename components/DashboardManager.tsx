
import React, { useState, useMemo, useEffect } from 'react';
import { User, Store, MonthlyPerformance, ProductPerformance, SellerGoal } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { 
  ShoppingBag, Target, Tag, CreditCard, TrendingUp, TrendingDown, 
  Calendar, Award, AlertCircle, ArrowUpRight, ArrowDownRight, Package, Loader2, Trophy, Medal, Crown, Users, UserCheck, Star, Zap, Clock, BarChart3, Hash, Percent, DollarSign, Box
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend 
} from 'recharts';
import { analyzePerformance } from '../services/geminiService';
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
    <div className="space-y-2 mt-4">
      <div className="w-full bg-gray-100 rounded-full h-3 md:h-4 overflow-hidden shadow-inner">
        <div 
          className={`h-full transition-all duration-1000 ease-out ${getBarColor(safePercent)}`} 
          style={{ width: `${Math.min(safePercent, 100)}%` }}
        />
      </div>
      <div className={`text-right text-xs md:text-sm font-black italic ${getTextColor(safePercent)}`}>
        {safePercent.toFixed(1)}%
      </div>
    </div>
  );
};

const GoalMetricCard = ({ 
  label, 
  target, 
  actual, 
  icon: Icon, 
  isCurrency = false, 
  isDecimal = false,
  isPercent = false
}: { 
  label: string, 
  target: number, 
  actual: number, 
  icon: React.ElementType,
  isCurrency?: boolean,
  isDecimal?: boolean,
  isPercent?: boolean
}) => {
  const nTarget = Number(target) || 0;
  const nActual = Number(actual) || 0;
  const percent = nTarget > 0 ? (nActual / nTarget) * 100 : 0;
  
  const formatValue = (val: number) => {
    if (isCurrency) return formatCurrency(val);
    if (isDecimal) return val.toFixed(2);
    if (isPercent) return `${val.toFixed(2)}%`;
    return val.toLocaleString('pt-BR');
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100 flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-start mb-6">
          <div className="p-3 bg-gray-50 text-blue-600 rounded-2xl"><Icon size={24} /></div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{label}</span>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Realizado</span>
            <span className="text-2xl md:text-3xl font-black text-gray-900 italic tracking-tighter">{formatValue(nActual)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t border-gray-50">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Meta</span>
            <span className="text-sm font-black text-blue-900">{formatValue(nTarget)}</span>
          </div>
        </div>
      </div>
      <GoalProgressBar percent={percent} />
    </div>
  );
};

const DashboardManager: React.FC<DashboardManagerProps> = ({ user, stores, performanceData, purchasingData }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [sellerGoals, setSellerGoals] = useState<SellerGoal[]>([]);

  useEffect(() => {
    const fetchSellers = async () => {
        if (!user.storeId) return;
        const { data } = await supabase.from('seller_goals').select('*').eq('month', selectedMonth).eq('store_id', user.storeId);
        if (data) setSellerGoals(data.map(d => ({
            storeId: d.store_id,
            sellerName: d.seller_name,
            month: d.month,
            revenueTarget: Number(d.revenue_target) || 0,
            revenueActual: Number(d.revenue_actual) || 0,
            commissionRate: Number(d.commission_rate || 0)
        })));
    };
    fetchSellers();
  }, [selectedMonth, user.storeId]);

  const myStore = (stores || []).find(s => s.id === user.storeId);
  const myData = (performanceData || []).find(p => p.storeId === user.storeId && p.month === selectedMonth);
  
  const salesPulse = useMemo(() => {
    if (!myData) return null;
    const now = new Date();
    const isCurrentMonth = selectedMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!isCurrentMonth) return null;

    const nTarget = Number(myData.revenueTarget) || 0;
    const nActual = Number(myData.revenueActual) || 0;
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = lastDayOfMonth - now.getDate() + 1; 
    const remainingGoal = Math.max(0, nTarget - nActual);
    const dailyTarget = remainingGoal / Math.max(1, remainingDays);
    const currentRitmo = nActual / Math.max(1, now.getDate());

    return { dailyTarget, remainingDays, remainingGoal, currentRitmo, projectedMonthEnd: currentRitmo * lastDayOfMonth };
  }, [myData, selectedMonth]);

  const networkRanking = useMemo(() => {
      return (performanceData || []).filter(p => p.month === selectedMonth)
          .map(item => {
              const s = (stores || []).find(st => st.id === item.storeId);
              return {
                  storeId: item.storeId,
                  name: s?.name || 'Unidade',
                  number: s?.number || '00',
                  percent: Number(item.percentMeta) || 0,
                  isMine: item.storeId === user.storeId
              };
          })
          .sort((a, b) => b.percent - a.percent);
  }, [performanceData, selectedMonth, stores, user.storeId]);

  const sellerRanking = useMemo(() => {
      return (sellerGoals || [])
        .map(sg => {
            const rt = Number(sg.revenueTarget) || 0;
            const ra = Number(sg.revenueActual) || 0;
            return { ...sg, percent: rt > 0 ? (ra / rt) * 100 : 0 };
        })
        .sort((a, b) => b.percent - a.percent);
  }, [sellerGoals]);

  if (!myStore) return <div className="p-8">Dados da loja indisponíveis.</div>;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex justify-between items-center">
            <h2 className="text-3xl font-black text-gray-900 uppercase italic leading-none flex items-center gap-3">
                <ShoppingBag size={28} className="text-blue-600" /> {myStore.name}
            </h2>
            <div className="flex gap-2">
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-gray-50 p-2 rounded-xl text-xs font-black">
                   {/* Fallback meses */}
                   {MONTHS.map(m => <option key={m.value} value={`${new Date().getFullYear()}-${String(m.value).padStart(2, '0')}`}>{m.label}</option>)}
                </select>
            </div>
        </div>

        {salesPulse && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-blue-900 p-8 rounded-[48px] text-white">
                <div>
                    <span className="text-[10px] font-black text-blue-300 uppercase block mb-2">Ritmo Atual</span>
                    <h3 className="text-3xl font-black italic">{formatCurrency(salesPulse.currentRitmo)}/dia</h3>
                </div>
                <div>
                    <span className="text-[10px] font-black text-red-400 uppercase block mb-2">Alvo Diário</span>
                    <h3 className="text-3xl font-black italic text-red-500">{formatCurrency(salesPulse.dailyTarget)}/dia</h3>
                </div>
                <div>
                    <span className="text-[10px] font-black text-blue-300 uppercase block mb-2">Prazo</span>
                    <h3 className="text-3xl font-black italic">{salesPulse.remainingDays} dias</h3>
                </div>
            </div>
        )}

        {myData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <GoalMetricCard label="Faturamento" target={myData.revenueTarget} actual={myData.revenueActual} icon={DollarSign} isCurrency />
                <GoalMetricCard label="P.A" target={myData.paTarget || 0} actual={myData.itemsPerTicket} icon={Hash} isDecimal />
                <GoalMetricCard label="Ticket Médio" target={myData.ticketTarget || 0} actual={myData.averageTicket} icon={Tag} isCurrency />
            </div>
        ) : (
            <div className="p-20 text-center bg-white rounded-3xl">Aguardando dados de performance do mês.</div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[40px]">
                <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Users className="text-blue-600"/> Equipe</h3>
                {(sellerRanking || []).map((sg, idx) => (
                    <div key={idx} className="mb-4 p-4 bg-gray-50 rounded-2xl">
                        <div className="flex justify-between font-black uppercase text-xs mb-1">
                           <span>{sg.sellerName}</span>
                           <span>{sg.percent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-600" style={{ width: `${Math.min(sg.percent, 100)}%` }} />
                        </div>
                    </div>
                ))}
            </div>
            <div className="bg-white p-8 rounded-[40px]">
                <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Ranking</h3>
                {(networkRanking || []).map((item, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl mb-2 flex justify-between items-center ${item.isMine ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <span className="font-black text-xs">#{idx+1} {item.isMine ? 'SUA LOJA' : `UNIDADE ${item.number}`}</span>
                        <span className="font-black text-blue-600">{item.percent.toFixed(1)}%</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default DashboardManager;
