
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

// Componente de Barra de Progresso com lógica de cores solicitada
const GoalProgressBar = ({ percent }: { percent: number }) => {
  const safePercent = Math.min(Math.max(0, percent), 120);
  
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
      <div className="flex justify-between items-end">
        <div className="w-full bg-gray-100 rounded-full h-3 md:h-4 overflow-hidden shadow-inner">
          <div 
            className={`h-full transition-all duration-1000 ease-out ${getBarColor(safePercent)}`} 
            style={{ width: `${Math.min(safePercent, 100)}%` }}
          />
        </div>
      </div>
      <div className={`text-right text-xs md:text-sm font-black italic ${getTextColor(safePercent)}`}>
        {percent.toFixed(1)}%
      </div>
    </div>
  );
};

// Componente de Card de Métrica Individual
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
  const percent = target > 0 ? (actual / target) * 100 : 0;
  
  const formatValue = (val: number) => {
    if (isCurrency) return formatCurrency(val);
    if (isDecimal) return val.toFixed(2);
    if (isPercent) return `${val.toFixed(2)}%`;
    return val.toLocaleString('pt-BR');
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-start mb-6">
          <div className="p-3 bg-gray-50 text-blue-600 rounded-2xl">
            <Icon size={24} />
          </div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{label}</span>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Realizado</span>
            <span className="text-2xl md:text-3xl font-black text-gray-900 italic tracking-tighter">
              {formatValue(actual)}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-t border-gray-50">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Meta</span>
            <span className="text-sm font-black text-blue-900">
              {formatValue(target)}
            </span>
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

  const handleMonthYearChange = (type: 'month' | 'year', value: number) => {
      const [currentY, currentM] = selectedMonth.split('-');
      let newY = parseInt(currentY);
      let newM = parseInt(currentM);
      if (type === 'month') newM = value;
      if (type === 'year') newY = value;
      const newStr = `${newY}-${String(newM).padStart(2, '0')}`;
      setSelectedMonth(newStr);
      setAiAnalysis('');
  };

  useEffect(() => {
    const fetchSellers = async () => {
        const { data } = await supabase.from('seller_goals').select('*').eq('month', selectedMonth).eq('store_id', user.storeId);
        if (data) setSellerGoals(data.map(d => ({
            storeId: d.store_id,
            sellerName: d.seller_name,
            month: d.month,
            revenueTarget: Number(d.revenue_target),
            revenueActual: Number(d.revenue_actual),
            commissionRate: Number(d.commission_rate || 0)
        })));
    };
    fetchSellers();
  }, [selectedMonth, user.storeId]);

  const myStore = stores.find(s => s.id === user.storeId);
  const myData = performanceData.find(p => p.storeId === user.storeId && p.month === selectedMonth);
  
  const salesPulse = useMemo(() => {
    if (!myData) return null;
    const now = new Date();
    const isCurrentMonth = selectedMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    if (!isCurrentMonth) return null;

    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = lastDayOfMonth - now.getDate() + 1; 
    const remainingGoal = Math.max(0, myData.revenueTarget - myData.revenueActual);
    const dailyTarget = remainingGoal / Math.max(1, remainingDays);
    const currentRitmo = myData.revenueActual / (now.getDate() || 1);

    return { 
        dailyTarget, 
        remainingDays, 
        remainingGoal, 
        currentRitmo,
        projectedMonthEnd: currentRitmo * lastDayOfMonth
    };
  }, [myData, selectedMonth]);

  const networkRanking = useMemo(() => {
      const currentMonthItems = performanceData.filter(p => p.month === selectedMonth);
      return currentMonthItems
          .map(item => {
              const s = stores.find(st => st.id === item.storeId);
              return {
                  storeId: item.storeId,
                  name: s?.name || 'Unidade',
                  number: s?.number || '00',
                  percent: item.percentMeta || 0,
                  isMine: item.storeId === user.storeId
              };
          })
          .sort((a, b) => b.percent - a.percent);
  }, [performanceData, selectedMonth, stores, user.storeId]);

  const sellerRanking = useMemo(() => {
      return [...sellerGoals]
        .map(sg => ({ ...sg, percent: sg.revenueTarget > 0 ? (sg.revenueActual / sg.revenueTarget) * 100 : 0 }))
        .sort((a, b) => b.percent - a.percent);
  }, [sellerGoals]);

  const handleGenerateInsight = async () => {
      if (!myData) return;
      setLoadingAi(true);
      const text = await analyzePerformance(performanceData, stores, 'MANAGER', user.storeId);
      setAiAnalysis(text);
      setLoadingAi(false);
  };

  const years = useMemo(() => {
      const y = new Set<number>();
      y.add(new Date().getFullYear());
      performanceData.forEach(d => y.add(parseInt(d.month.split('-')[0])));
      return Array.from(y).sort((a,b) => b-a);
  }, [performanceData]);

  if (!myStore) return <div className="p-8">Loja não vinculada ao usuário.</div>;

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 overflow-x-hidden">
        
        {/* Header Profissional */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 md:p-8 rounded-[40px] shadow-sm border border-gray-100">
            <div className="text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 uppercase italic tracking-tighter leading-none flex flex-col md:flex-row items-center gap-3">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
                        <ShoppingBag size={28} />
                    </div>
                    {myStore.name}
                </h2>
                <p className="text-gray-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-4 italic ml-1">Painel Gerencial de Performance</p>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-200 shadow-inner">
                <Calendar size={20} className="text-blue-600 ml-1" />
                <div className="flex gap-2">
                    <select value={parseInt(selectedMonth.split('-')[1])} onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-black outline-none cursor-pointer text-xs uppercase px-2">
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select value={parseInt(selectedMonth.split('-')[0])} onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-black outline-none cursor-pointer text-xs px-2">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>
        </div>

        {/* Sales Pulse (Ritmo) */}
        {salesPulse && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gradient-to-r from-blue-900 to-black p-8 md:p-10 rounded-[48px] shadow-2xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10"><Zap size={120} /></div>
                
                <div className="relative z-10 flex flex-col justify-center text-center md:text-left">
                    <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-4 flex items-center justify-center md:justify-start gap-2">
                        <Clock size={14}/> Ritmo de Vendas
                    </span>
                    <h3 className="text-3xl md:text-4xl font-black italic tracking-tighter">
                        {formatCurrency(salesPulse.currentRitmo)} 
                        <span className="text-xs not-italic font-bold text-blue-400 ml-2">/ DIA</span>
                    </h3>
                    <p className="text-[10px] text-blue-500 font-black uppercase mt-4 tracking-widest">
                        Projeção Final: {formatCurrency(salesPulse.projectedMonthEnd)}
                    </p>
                </div>

                <div className="relative z-10 flex flex-col justify-center border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-10 text-center md:text-left">
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-4 flex items-center justify-center md:justify-start gap-2">
                        <Target size={14}/> Alvo Diário
                    </span>
                    <h3 className="text-3xl md:text-4xl font-black italic text-red-500 tracking-tighter">
                        {formatCurrency(salesPulse.dailyTarget)} 
                        <span className="text-xs not-italic font-bold text-red-400 ml-2">/ DIA</span>
                    </h3>
                    <p className="text-[10px] text-gray-400 font-black uppercase mt-4 tracking-widest">Para atingir 100% da Meta</p>
                </div>

                <div className="relative z-10 flex flex-col justify-center border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-10 text-center md:text-left">
                    <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-4">Prazo Restante</span>
                    <h3 className="text-4xl md:text-5xl font-black italic tracking-tighter">
                        {salesPulse.remainingDays} 
                        <span className="text-xs not-italic font-bold text-blue-400 ml-2 uppercase">Dias</span>
                    </h3>
                    <div className="w-full bg-white/10 h-2 rounded-full mt-6 overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(30 - salesPulse.remainingDays) / 30 * 100}%` }}></div>
                    </div>
                </div>
            </div>
        )}

        {/* Dashboard de Metas Grid Fluid */}
        {myData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                <GoalMetricCard 
                    label="Faturamento" 
                    icon={DollarSign} 
                    target={myData.revenueTarget} 
                    actual={myData.revenueActual} 
                    isCurrency 
                />
                <GoalMetricCard 
                    label="Itens Vendidos" 
                    icon={Box} 
                    target={myData.itemsTarget || 0} 
                    actual={myData.itemsActual || 0} 
                />
                <GoalMetricCard 
                    label="P.A. (Peças/Atend)" 
                    icon={Hash} 
                    target={myData.paTarget || 0} 
                    actual={myData.itemsPerTicket} 
                    isDecimal 
                />
                <GoalMetricCard 
                    label="Ticket Médio" 
                    icon={Tag} 
                    target={myData.ticketTarget || 0} 
                    actual={myData.averageTicket} 
                    isCurrency 
                />
                <GoalMetricCard 
                    label="P.U. (Preço Unit)" 
                    icon={CreditCard} 
                    target={myData.puTarget || 0} 
                    actual={myData.unitPriceAverage} 
                    isCurrency 
                />
                <GoalMetricCard 
                    label="Inadimplência" 
                    icon={Percent} 
                    target={myData.delinquencyTarget || 0} 
                    actual={myData.delinquencyRate} 
                    isPercent 
                />
            </div>
        ) : (
            <div className="bg-white rounded-[40px] p-20 text-center border-2 border-dashed border-gray-200">
                <Calendar className="mx-auto text-gray-300 mb-6" size={64} />
                <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest">Aguardando Registro de Metas Mensais</h3>
                <p className="text-sm text-gray-400 mt-2 font-medium">Contate o administrador para definir as metas de {MONTHS.find(m => m.value === selectedMonth.split('-')[1])?.label}.</p>
            </div>
        )}

        {/* Seção Inferior: Equipe e Ranking */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
                <div className="bg-white rounded-[40px] p-8 md:p-10 shadow-sm border border-gray-100 overflow-hidden h-full">
                    <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter mb-10 flex items-center gap-4">
                        <Users className="text-blue-600" size={32} /> Performance <span className="text-red-600">Equipe de Vendas</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {sellerRanking.map((sg, idx) => (
                            <div key={idx} className={`p-6 md:p-8 rounded-[32px] border-2 transition-all flex flex-col justify-between ${sg.percent >= 100 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-md ${idx === 0 ? 'bg-yellow-500' : 'bg-blue-600'}`}>
                                            {sg.sellerName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-black uppercase text-sm md:text-base italic leading-none">{sg.sellerName}</p>
                                            <p className="text-[9px] font-black text-gray-400 uppercase mt-1 tracking-widest">Consultor de Vendas</p>
                                        </div>
                                    </div>
                                    {sg.percent >= 100 && <Star className="text-yellow-500 fill-yellow-500" size={20}/>}
                                </div>
                                <div className="mt-auto">
                                    <div className="flex justify-between items-end mb-3">
                                        <span className="text-sm font-black text-blue-900 italic">{formatCurrency(sg.revenueActual)}</span>
                                        <span className={`text-xs font-black ${sg.percent >= 100 ? 'text-green-600' : 'text-blue-600'}`}>{sg.percent.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                        <div className={`h-full transition-all duration-1000 ${sg.percent >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(sg.percent, 100)}%` }}/>
                                    </div>
                                    <div className="flex justify-between items-center mt-3">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Meta: {formatCurrency(sg.revenueTarget)}</p>
                                        {sg.commissionRate > 0 && (
                                            <p className="text-[8px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg uppercase">Comissão: {sg.commissionRate}%</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {sellerRanking.length === 0 && (
                            <div className="col-span-full py-16 text-center">
                                <Users size={48} className="mx-auto text-gray-200 mb-4" />
                                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Nenhuma meta individual definida</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 flex flex-col overflow-hidden h-fit">
                <div className="p-8 bg-gray-900 text-white">
                    <h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                        <Trophy size={28} className="text-yellow-400"/> Ranking Rede
                    </h3>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-2 opacity-60">Eficiência (Atingimento da Meta)</p>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4 max-h-[600px]">
                    {networkRanking.map((item, idx) => (
                        <div key={item.storeId} className={`flex items-center gap-5 p-5 rounded-3xl transition-all border ${item.isMine ? 'bg-blue-50 border-blue-200 ring-4 ring-blue-500/5' : 'bg-gray-50 border-gray-100 opacity-90'}`}>
                            <div className="w-10 flex flex-col items-center">
                                {idx === 0 ? <Crown className="text-yellow-500 mb-1" size={20}/> : idx === 1 ? <Medal className="text-gray-400 mb-1" size={18}/> : idx === 2 ? <Medal className="text-orange-400 mb-1" size={18}/> : null}
                                <span className="font-black text-gray-400 text-xs">#{idx + 1}</span>
                            </div>
                            <div className="flex-1">
                                <p className={`text-xs font-black uppercase tracking-tight mb-2 ${item.isMine ? 'text-blue-900' : 'text-gray-600'}`}>
                                    {item.isMine ? `${item.number} - ${item.name}` : `Unidade Competidora`}
                                </p>
                                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                    <div className={`h-full ${item.percent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(item.percent, 100)}%` }}></div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`text-base font-black italic ${item.isMine ? 'text-blue-700' : 'text-gray-900'}`}>{item.percent.toFixed(1)}%</span>
                            </div>
                        </div>
                    ))}
                    {networkRanking.length === 0 && <p className="text-center py-16 text-xs font-bold text-gray-300 uppercase italic">Aguardando dados da rede...</p>}
                </div>
            </div>
        </div>

        {/* Insight IA Section */}
        <div className="bg-gradient-to-br from-gray-900 to-blue-950 rounded-[48px] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5"><Trophy size={160}/></div>
            <div className="relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-4">
                            <Award className="text-yellow-400" size={36} /> Análise Estratégica <span className="text-blue-400">Gemini IA</span>
                        </h3>
                        <p className="text-[10px] text-blue-300/60 font-black uppercase tracking-widest mt-2">Relatório Executivo Automatizado</p>
                    </div>
                    <button 
                        onClick={handleGenerateInsight} 
                        disabled={loadingAi || !myData} 
                        className="w-full md:w-auto bg-white/10 hover:bg-white/20 text-white px-10 py-5 rounded-[24px] text-xs font-black uppercase tracking-[0.2em] transition-all disabled:opacity-30 flex items-center justify-center gap-3 border border-white/10 shadow-xl"
                    >
                        {loadingAi ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />} Analisar Cenário
                    </button>
                </div>
                
                {aiAnalysis ? (
                    <div className="prose prose-invert max-w-none text-sm md:text-base bg-black/30 p-8 md:p-10 rounded-[40px] border border-white/10 animate-in slide-in-from-bottom-4 shadow-inner leading-relaxed">
                        <div dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br/>') }} />
                    </div>
                ) : (
                    <div className="py-12 border-2 border-dashed border-white/10 rounded-[40px] flex flex-col items-center justify-center text-center px-6">
                        <Award className="text-blue-800 mb-4" size={48} />
                        <p className="text-blue-300/80 font-bold italic text-sm">Pronto para processar dados e gerar sugestões táticas para o mês selecionado.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Footer Barra de Segurança */}
        <div className="px-8 py-4 bg-gray-950 text-white flex flex-col sm:flex-row justify-between items-center gap-4 text-[9px] font-black uppercase tracking-widest rounded-[24px] shadow-lg">
          <div className="flex items-center gap-8">
              <span className="flex items-center gap-2 text-blue-500"><Target size={14}/> Sincronização em Tempo Real</span>
              <span className="flex items-center gap-2 text-green-500 hidden md:flex"><Target size={14}/> Canal Seguro AES-256</span>
          </div>
          <div className="flex items-center gap-2 opacity-40">REAL ADMIN v4.9 • GESTÃO ESTRATÉGICA</div>
        </div>
    </div>
  );
};

export default DashboardManager;
