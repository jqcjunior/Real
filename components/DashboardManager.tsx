import React, { useState, useMemo } from 'react';
import { User, Store, MonthlyPerformance, ProductPerformance } from '../types';
import { formatCurrency } from '../constants';
import { 
  ShoppingBag, Target, Tag, CreditCard, TrendingUp, TrendingDown, 
  Calendar, Award, AlertCircle, ArrowUpRight, ArrowDownRight, Package 
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
    
    // Normal: Higher is better (Green), Lower is worse (Red)
    // Inverse (e.g. Delinquency): Lower is better (Green), Higher is worse (Red)
    const isPositive = inverse ? diff <= 0 : diff >= 0;
    
    return (
        <span className={`text-xs font-bold flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
            {Math.abs(pct).toFixed(1)}% {isPositive ? 'acima' : 'abaixo'} da meta
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
      setAiAnalysis(''); // Clear old analysis
  };

  const myStore = stores.find(s => s.id === user.storeId);
  const myData = performanceData.find(p => p.storeId === user.storeId && p.month === selectedMonth);
  
  // Calculate Network Averages for Comparison
  const networkData = performanceData.filter(p => p.month === selectedMonth);
  const averages = useMemo(() => {
      if (networkData.length === 0) return { revenue: 0, pa: 0, ticket: 0, pu: 0, delinquency: 0 };
      const sum = networkData.reduce((acc, curr) => ({
          revenue: acc.revenue + curr.revenueActual,
          pa: acc.pa + curr.itemsPerTicket,
          ticket: acc.ticket + curr.averageTicket,
          pu: acc.pu + curr.unitPriceAverage,
          delinquency: acc.delinquency + curr.delinquencyRate
      }), { revenue: 0, pa: 0, ticket: 0, pu: 0, delinquency: 0 });
      
      const count = networkData.length;
      return {
          revenue: sum.revenue / count,
          pa: sum.pa / count,
          ticket: sum.ticket / count,
          pu: sum.pu / count,
          delinquency: sum.delinquency / count
      };
  }, [networkData]);

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
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <ShoppingBag className="text-blue-600" size={32} />
                    {myStore.name}
                </h2>
                <p className="text-gray-500 mt-1">Visão detalhada de performance e metas.</p>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                <Calendar size={18} className="text-blue-600 ml-2" />
                <div className="flex gap-2">
                    <select 
                        value={parseInt(selectedMonth.split('-')[1])}
                        onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))}
                        className="bg-transparent text-gray-700 font-medium outline-none cursor-pointer"
                    >
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select 
                        value={parseInt(selectedMonth.split('-')[0])}
                        onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))}
                        className="bg-transparent text-gray-700 font-medium outline-none cursor-pointer"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>
        </div>

        {myData ? (
            <>
                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    
                    {/* Revenue */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase">Faturamento</h3>
                            <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition-colors">
                                <Target size={20}/>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(myData.revenueActual)}</p>
                        <div className="mt-2 flex justify-between items-end">
                            <div className="text-xs text-gray-500">
                                Meta: {formatCurrency(myData.revenueTarget)}
                            </div>
                            <ComparisonBadge current={myData.revenueActual} target={myData.revenueTarget} />
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3 overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${myData.percentMeta >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                style={{ width: `${Math.min(myData.percentMeta, 100)}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-right mt-1 font-bold text-gray-400">{myData.percentMeta.toFixed(1)}%</p>
                    </div>

                    {/* Ticket Medio */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase">Ticket Médio</h3>
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors">
                                <CreditCard size={20}/>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(myData.averageTicket)}</p>
                        <div className="mt-2 flex flex-col">
                            {myData.ticketTarget ? (
                                <ComparisonBadge current={myData.averageTicket} target={myData.ticketTarget} />
                            ) : (
                                <span className="text-xs text-gray-400">Sem meta definida</span>
                            )}
                            <span className="text-xs text-gray-400 mt-1">Média Rede: {formatCurrency(averages.ticket)}</span>
                        </div>
                    </div>

                    {/* PA */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase">P.A. (Peças/Atend.)</h3>
                            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-100 transition-colors">
                                <ShoppingBag size={20}/>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{myData.itemsPerTicket.toFixed(2)}</p>
                        <div className="mt-2 flex flex-col">
                            {myData.paTarget ? (
                                <ComparisonBadge current={myData.itemsPerTicket} target={myData.paTarget} />
                            ) : (
                                <span className="text-xs text-gray-400">Sem meta definida</span>
                            )}
                            <span className="text-xs text-gray-400 mt-1">Média Rede: {averages.pa.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* PU */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase">Preço Médio (P.U.)</h3>
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                                <Tag size={20}/>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(myData.unitPriceAverage)}</p>
                        <div className="mt-2 flex flex-col">
                            {myData.puTarget ? (
                                <ComparisonBadge current={myData.unitPriceAverage} target={myData.puTarget} />
                            ) : (
                                <span className="text-xs text-gray-400">Sem meta definida</span>
                            )}
                            <span className="text-xs text-gray-400 mt-1">Média Rede: {formatCurrency(averages.pu)}</span>
                        </div>
                    </div>

                    {/* Inadimplencia (Inverse Logic) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase">Inadimplência</h3>
                            <div className="p-2 bg-red-50 text-red-600 rounded-lg group-hover:bg-red-100 transition-colors">
                                <AlertCircle size={20}/>
                            </div>
                        </div>
                        <p className={`text-2xl font-bold ${myData.delinquencyRate > (myData.delinquencyTarget || 2) ? 'text-red-600' : 'text-green-600'}`}>
                            {myData.delinquencyRate.toFixed(2)}%
                        </p>
                        <div className="mt-2 flex flex-col">
                            {myData.delinquencyTarget ? (
                                <ComparisonBadge current={myData.delinquencyRate} target={myData.delinquencyTarget} inverse />
                            ) : (
                                <span className="text-xs text-gray-400">Meta Max: 2.00%</span>
                            )}
                            <span className="text-xs text-gray-400 mt-1">Média Rede: {averages.delinquency.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>

                {/* AI Analysis Section */}
                <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Award className="text-yellow-400" /> Consultor Inteligente
                        </h3>
                        <button 
                            onClick={handleGenerateInsight}
                            disabled={loadingAi}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                        >
                            {loadingAi ? 'Analisando...' : 'Gerar Análise IA'}
                        </button>
                    </div>
                    
                    {aiAnalysis ? (
                        <div className="prose prose-invert max-w-none text-sm bg-white/5 p-4 rounded-xl border border-white/10">
                            <div dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </div>
                    ) : (
                        <p className="text-blue-200 text-sm">
                            Clique em "Gerar Análise IA" para receber insights sobre o desempenho da sua loja, sugestões de melhoria e comparação com a rede.
                        </p>
                    )}
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-6">Comparativo: Loja vs Rede</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        { name: 'Ticket Médio', loja: myData.averageTicket, rede: averages.ticket },
                                        { name: 'P.A.', loja: myData.itemsPerTicket * 10, rede: averages.pa * 10 }, // Scale PA for visibility
                                        { name: 'P.U.', loja: myData.unitPriceAverage, rede: averages.pu }
                                    ]}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="loja" name="Minha Loja" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                    <Bar dataKey="rede" name="Média Rede" fill="#9ca3af" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-gray-400 text-center mt-2">* P.A. multiplicado por 10 para visualização</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-6">Evolução Mensal (Vendas)</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={performanceData.filter(p => p.storeId === user.storeId).slice(-6)}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis 
                                        dataKey="month" 
                                        tickFormatter={(val) => {
                                            const [y, m] = val.split('-');
                                            return `${m}/${y.slice(2)}`;
                                        }}
                                        fontSize={12}
                                    />
                                    <YAxis fontSize={12} tickFormatter={(val) => `${val/1000}k`} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend />
                                    <Line type="monotone" dataKey="revenueActual" name="Realizado" stroke="#3b82f6" strokeWidth={2} dot={{r: 4}} />
                                    <Line type="monotone" dataKey="revenueTarget" name="Meta" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </>
        ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                <div className="inline-block p-4 bg-gray-50 rounded-full mb-3 shadow-sm text-gray-400">
                    <Calendar size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-600">Nenhum dado encontrado</h3>
                <p className="text-gray-400 text-sm">
                    Não há registros de desempenho para <strong>{MONTHS.find(m => m.value === parseInt(selectedMonth.split('-')[1]))?.label}/{selectedMonth.split('-')[0]}</strong>.
                </p>
            </div>
        )}
    </div>
  );
};

export default DashboardManager;