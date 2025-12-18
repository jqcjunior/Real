
import React, { useState, useMemo } from 'react';
import { User, Store, MonthlyPerformance, ProductPerformance } from '../types';
import { formatCurrency } from '../constants';
import { 
  ShoppingBag, Target, Tag, CreditCard, TrendingUp, TrendingDown, 
  Calendar, Award, AlertCircle, ArrowUpRight, ArrowDownRight, Package, Loader2, Trophy, Medal, Crown
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend 
} from 'recharts';
import { analyzePerformance } from '../services/geminiService';

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

const ComparisonBadge = ({ current, target, inverse = false }: { current: number, target: number, inverse?: boolean }) => {
    if (!target) return null;
    const diff = current - target;
    const pct = (diff / target) * 100;
    const isPositive = inverse ? diff <= 0 : diff >= 0;
    return (
        <span className={`text-xs font-bold flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
            {Math.abs(pct).toFixed(1)}% {isPositive ? 'acima' : 'abaixo'}
        </span>
    );
};

const DashboardManager: React.FC<DashboardManagerProps> = ({ user, stores, performanceData, purchasingData }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

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

  const myStore = stores.find(s => s.id === user.storeId);
  const myData = performanceData.find(p => p.storeId === user.storeId && p.month === selectedMonth);
  
  // RANKING GLOBAL (Requisito Especial)
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
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div>
                <h2 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none flex items-center gap-3">
                    <ShoppingBag className="text-blue-600" size={32} />
                    {myStore.name}
                </h2>
                <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mt-2 italic">Performance Individual & Ranking da Rede</p>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 shadow-inner">
                <Calendar size={18} className="text-blue-600 ml-2" />
                <div className="flex gap-2">
                    <select value={parseInt(selectedMonth.split('-')[1])} onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-black outline-none cursor-pointer text-xs uppercase">
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select value={parseInt(selectedMonth.split('-')[0])} onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-black outline-none cursor-pointer text-xs">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* PERFORMANCE AREA */}
            <div className="xl:col-span-3 space-y-8">
                {myData ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Faturamento</h3><p className="text-2xl font-black text-gray-900">{formatCurrency(myData.revenueActual)}</p><div className="mt-2 flex justify-between items-end"><ComparisonBadge current={myData.revenueActual} target={myData.revenueTarget} /></div><div className="w-full bg-gray-100 rounded-full h-2 mt-4 overflow-hidden"><div className={`h-full ${myData.percentMeta >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(myData.percentMeta, 100)}%` }}></div></div><p className="text-[10px] text-right mt-2 font-black text-blue-700">{myData.percentMeta.toFixed(1)}% DA META</p></div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Ticket Médio</h3><p className="text-2xl font-black text-gray-900">{formatCurrency(myData.averageTicket)}</p><div className="mt-2">{myData.ticketTarget && <ComparisonBadge current={myData.averageTicket} target={myData.ticketTarget} />}</div></div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">P.A. (Peças/Atend.)</h3><p className="text-2xl font-black text-gray-900">{myData.itemsPerTicket.toFixed(2)}</p><div className="mt-2">{myData.paTarget && <ComparisonBadge current={myData.itemsPerTicket} target={myData.paTarget} />}</div></div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Inadimplência</h3><p className={`text-2xl font-black ${myData.delinquencyRate > (myData.delinquencyTarget || 2) ? 'text-red-600' : 'text-green-600'}`}>{myData.delinquencyRate.toFixed(2)}%</p></div>
                        </div>

                        <div className="bg-gradient-to-br from-gray-900 to-blue-950 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-10"><Trophy size={120}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                                        <Award className="text-yellow-400" size={32} /> Inteligência de Varejo
                                    </h3>
                                    <button onClick={handleGenerateInsight} disabled={loadingAi} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 border border-white/10">
                                        {loadingAi ? <Loader2 className="animate-spin" size={16} /> : <Target size={16} />} Analisar Dados
                                    </button>
                                </div>
                                {aiAnalysis ? (
                                    <div className="prose prose-invert max-w-none text-sm bg-black/20 p-6 rounded-2xl border border-white/5 animate-in slide-in-from-bottom-2">
                                        <div dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br/>') }} />
                                    </div>
                                ) : (
                                    <p className="text-blue-300 font-medium italic">Clique no botão acima para uma análise estratégica via Inteligência Artificial.</p>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-gray-200">
                        <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
                        <h3 className="text-lg font-black text-gray-400 uppercase">Aguardando Importação de Dados</h3>
                    </div>
                )}
            </div>

            {/* RANKING AREA (Gamificação) */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                <div className="p-6 bg-gray-900 text-white"><h3 className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2"><Trophy size={20} className="text-yellow-400"/> Ranking da Rede</h3><p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Sua posição no ecossistema</p></div>
                <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
                    {networkRanking.map((item, idx) => (
                        <div key={item.storeId} className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${item.isMine ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20' : 'bg-gray-50 border-gray-100 opacity-80'}`}>
                            <div className="w-8 flex flex-col items-center">
                                {idx === 0 ? <Crown className="text-yellow-500 mb-1" size={16}/> : idx === 1 ? <Medal className="text-gray-400 mb-1" size={16}/> : idx === 2 ? <Medal className="text-orange-400 mb-1" size={16}/> : null}
                                <span className="font-black text-gray-400 text-xs">#{idx + 1}</span>
                            </div>
                            <div className="flex-1">
                                <p className={`text-xs font-black uppercase tracking-tight ${item.isMine ? 'text-blue-900' : 'text-gray-600'}`}>{item.number} - {item.name}</p>
                                <div className="w-full bg-gray-200 h-1.5 rounded-full mt-2 overflow-hidden"><div className={`h-full ${item.percent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(item.percent, 100)}%` }}></div></div>
                            </div>
                            <div className="text-right">
                                <span className={`text-sm font-black italic ${item.isMine ? 'text-blue-700' : 'text-gray-900'}`}>{item.percent.toFixed(1)}%</span>
                            </div>
                        </div>
                    ))}
                    {networkRanking.length === 0 && <p className="text-center py-10 text-xs font-bold text-gray-400 uppercase">Sem dados no período</p>}
                </div>
            </div>
        </div>
    </div>
  );
};

export default DashboardManager;
