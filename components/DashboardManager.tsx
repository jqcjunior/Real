
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
  
  const [sellerGoals, setSellerGoals] = useState<SellerGoal[]>([]);

  const myStore = useMemo(() => (stores || []).find(s => s.id === user.storeId), [stores, user.storeId]);
  
  // LOGICA DE COMPARTILHAMENTO: Busca dados pela unidade (número) e não apenas pelo ID do usuário logado
  const myData = useMemo(() => {
    if (!myStore) return null;
    return (performanceData || []).find(p => {
        const pStore = stores.find(s => s.id === p.storeId);
        return pStore?.number === myStore.number && p.month === selectedMonth;
    });
  }, [performanceData, selectedMonth, myStore, stores]);

  useEffect(() => {
    const fetchSellers = async () => {
        if (!myStore) return;
        // Para vendedores, buscamos também pelo número da loja para consolidar equipe
        // Nota: Assumindo que store_id no banco é o ID usado no cadastro de metas
        // Se houver múltiplos IDs para a mesma loja, Admin salvou em um deles.
        if (!myData?.storeId) return;

        const { data } = await supabase.from('seller_goals').select('*').eq('month', selectedMonth).eq('store_id', myData.storeId);
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
  }, [selectedMonth, myStore, myData]);

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
      // Consolidar ranking por número de loja para evitar duplicatas de gerentes no ranking
      const rankingMap = new Map();
      
      (performanceData || []).filter(p => p.month === selectedMonth).forEach(item => {
          const s = (stores || []).find(st => st.id === item.storeId);
          if (!s) return;
          
          if (!rankingMap.has(s.number)) {
              rankingMap.set(s.number, {
                  number: s.number,
                  name: s.name,
                  percent: Number(item.percentMeta) || 0,
                  isMine: s.number === myStore?.number
              });
          }
      });

      return Array.from(rankingMap.values()).sort((a, b) => b.percent - a.percent);
  }, [performanceData, selectedMonth, stores, myStore]);

  const sellerRanking = useMemo(() => {
      return (sellerGoals || [])
        .map(sg => {
            const rt = Number(sg.revenueTarget) || 0;
            const ra = Number(sg.revenueActual) || 0;
            return { ...sg, percent: rt > 0 ? (ra / rt) * 100 : 0 };
        })
        .sort((a, b) => b.percent - a.percent);
  }, [sellerGoals]);

  if (!myStore) return <div className="p-20 text-center font-black uppercase text-gray-400">Dados da loja indisponíveis.</div>;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex justify-between items-center">
            <h2 className="text-3xl font-black text-gray-900 uppercase italic leading-none flex items-center gap-3">
                <ShoppingBag size={28} className="text-blue-600" /> {myStore.name} <span className="text-gray-300 ml-2">#{myStore.number}</span>
            </h2>
            <div className="flex gap-2">
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-gray-50 p-2 rounded-xl text-xs font-black">
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
            <div className="p-20 text-center bg-white rounded-[40px] shadow-sm border-2 border-dashed border-gray-100">
                <AlertCircle className="mx-auto text-gray-200 mb-4" size={48} />
                <p className="text-gray-400 font-black uppercase text-xs tracking-widest">Aguardando definição de metas pelo Admin</p>
            </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2 italic"><Users className="text-blue-600"/> Equipe de Vendas</h3>
                {(sellerRanking || []).map((sg, idx) => (
                    <div key={idx} className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex justify-between font-black uppercase text-[10px] mb-2 tracking-widest">
                           <span className="text-gray-900">{sg.sellerName}</span>
                           <span className="text-blue-600">{sg.percent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${Math.min(sg.percent, 100)}%` }} />
                        </div>
                    </div>
                ))}
                {sellerRanking.length === 0 && <p className="text-center text-gray-300 font-bold uppercase text-[9px] py-10">Nenhum vendedor registrado para este mês</p>}
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2 italic"><Trophy className="text-yellow-500"/> Ranking Rede</h3>
                <div className="space-y-2 overflow-y-auto max-h-[400px] no-scrollbar">
                    {(networkRanking || []).map((item, idx) => (
                        <div key={item.number} className={`p-4 rounded-2xl flex justify-between items-center transition-all ${item.isMine ? 'bg-blue-600 text-white shadow-lg scale-[1.02]' : 'bg-gray-50 text-gray-900 border border-gray-100 hover:bg-gray-100'}`}>
                            <span className="font-black text-[10px] uppercase tracking-tighter">
                                <span className="opacity-50 mr-2">#{idx+1}</span>
                                {item.isMine ? 'SUA UNIDADE' : `UNIDADE ${item.number}`}
                            </span>
                            <span className={`font-black italic ${item.isMine ? 'text-white' : 'text-blue-600'}`}>{item.percent.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};

export default DashboardManager;
