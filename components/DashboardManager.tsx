import React, { useState, useMemo } from 'react';
import { Store, MonthlyPerformance, User, ProductPerformance } from '../types';
import { formatCurrency, formatPercent } from '../constants';
import { Medal, Trophy, TrendingUp, Target, ShoppingBag, CreditCard, Tag, AlertCircle, Sparkles, BarChart2, Bot, Calendar, DollarSign, Activity, ArrowUp, ArrowDown } from 'lucide-react';
import { analyzePerformance } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ComposedChart, CartesianGrid, Legend } from 'recharts';

interface DashboardManagerProps {
  user: User;
  stores: Store[];
  performanceData: MonthlyPerformance[];
  purchasingData: ProductPerformance[];
}

type ChartView = 'financial' | 'operational';

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardManager: React.FC<DashboardManagerProps> = ({ user, stores, performanceData, purchasingData }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chartView, setChartView] = useState<ChartView>('financial');

  // Identify my store data
  const myStoreId = user.storeId;
  const myStore = stores.find(s => s.id === myStoreId);

  // Determine available years from data + current year based on MY store data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear()); // Ensure current year is always an option
    if (myStoreId) {
        performanceData
            .filter(p => p.storeId === myStoreId)
            .forEach(d => {
                const y = parseInt(d.month.split('-')[0]);
                if (!isNaN(y)) years.add(y);
            });
    }
    return Array.from(years).sort((a,b) => b - a); // Descending
  }, [performanceData, myStoreId]);

  // Selected Month State (Defaults to Current Month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleMonthYearChange = (type: 'month' | 'year', value: number) => {
      const [currentY, currentM] = selectedMonth.split('-');
      let newY = parseInt(currentY);
      let newM = parseInt(currentM);

      if (type === 'month') newM = value;
      if (type === 'year') newY = value;

      const newStr = `${newY}-${String(newM).padStart(2, '0')}`;
      setSelectedMonth(newStr);
  };

  // Helper to format Month Name (e.g. 2025-11 -> Novembro)
  const formatMonthName = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1); // Capitalize
  };
  
  // Get data specifically for the selected month
  const myData = useMemo(() => {
    const found = performanceData.find(p => p.storeId === myStoreId && p.month === selectedMonth);
    return found || {
      storeId: myStoreId || 'unknown',
      month: selectedMonth,
      revenueTarget: 0,
      revenueActual: 0,
      percentMeta: 0,
      itemsPerTicket: 0,
      unitPriceAverage: 0,
      averageTicket: 0,
      delinquencyRate: 0,
      paTarget: 0,
      ticketTarget: 0,
      puTarget: 0,
      delinquencyTarget: 0,
      trend: 'stable',
      correctedDailyGoal: 0
    };
  }, [performanceData, myStoreId, selectedMonth]);

  // If store doesn't exist at all in the stores list (rare error case)
  if (!myStore) return <div className="p-8 text-gray-500">Erro: Loja vinculada não encontrada no cadastro. Contate o administrador.</div>;

  const hasData = myData.revenueTarget > 0 || myData.revenueActual > 0;

  // Calculate Ranking (Based on Percentage of selected month)
  // Get ranking list based on ACTIVE stores only
  const ranking = performanceData
    .filter(p => p.month === selectedMonth && stores.some(s => s.id === p.storeId && s.status === 'active'))
    .sort((a, b) => b.percentMeta - a.percentMeta)
    .map((p, index) => {
      const storeObj = stores.find(s => s.id === p.storeId);
      // Format: Loja 05 - Petrolina
      const cityClean = storeObj?.city.split(' - ')[0] || '';
      const numClean = storeObj?.number.padStart(2, '0') || '00';
      const displayName = storeObj 
        ? `Loja ${numClean} - ${cityClean}` 
        : 'Loja Desconhecida';

      return {
        ...p,
        rank: index + 1,
        storeName: displayName
      };
    });

  const myRank = ranking.find(r => r.storeId === myStoreId);

  // Calculate Network Averages (Sub Grupo) for the selected month
  const averages = useMemo(() => {
      const count = ranking.length || 1;
      const totalPA = ranking.reduce((acc, curr) => acc + curr.itemsPerTicket, 0);
      const totalPU = ranking.reduce((acc, curr) => acc + curr.unitPriceAverage, 0);
      return {
          pa: (totalPA / count).toFixed(2),
          pu: (totalPU / count).toFixed(2)
      };
  }, [ranking]);

  // --- EVOLUTION CHART DATA (HISTORY FOR THIS STORE) ---
  const historyData = useMemo(() => {
      // Get all records for this store, sorted by date
      const history = performanceData
          .filter(p => p.storeId === myStoreId)
          .sort((a, b) => a.month.localeCompare(b.month)); // Sort YYYY-MM string asc

      // Take last 6 or 12 months for cleanliness
      const recentHistory = history.slice(-6); 

      return recentHistory.map(h => {
          // Parse month for display (e.g. "Nov/25")
          const [y, m] = h.month.split('-');
          const date = new Date(parseInt(y), parseInt(m)-1, 1);
          const shortMonth = date.toLocaleDateString('pt-BR', { month: 'short' });
          const displayDate = `${shortMonth}/${y.slice(2)}`;

          return {
              name: displayDate,
              monthRaw: h.month,
              Realizado: h.revenueActual,
              Meta: h.revenueTarget,
              Atingimento: h.percentMeta,
              PA: h.itemsPerTicket,
              Ticket: h.averageTicket
          };
      });
  }, [performanceData, myStoreId]);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    // If no data, send a specific prompt context
    if (!hasData) {
        setAnalysis("Não há dados de vendas registrados para este mês selecionado. Selecione um mês com histórico ou aguarde a importação.");
        setIsAnalyzing(false);
        return;
    }
    const result = await analyzePerformance(performanceData.filter(p => p.month === selectedMonth), stores, 'MANAGER', myStoreId);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-amber-600';
    return 'text-blue-200';
  };

  // Helper component to display Comparison (Meta vs Actual)
  const ComparisonBadge = ({ current, target, inverse = false, prefix = '' }: { current: number, target?: number, inverse?: boolean, prefix?: string }) => {
      if (!target || target === 0) return null;
      
      const diff = current - target;
      const isGood = inverse ? diff <= 0 : diff >= 0;
      
      return (
          <div className={`text-[10px] flex items-center gap-1 mt-1 font-medium ${isGood ? 'text-green-600' : 'text-red-600'}`}>
              {isGood ? <ArrowUp size={10} className={inverse ? 'rotate-180' : ''}/> : <ArrowDown size={10} className={inverse ? 'rotate-180' : ''} />}
              Meta: {prefix}{target}
          </div>
      );
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      
      {/* Welcome & Gamification Banner - THEME UPDATE: Blue/Red Gradient */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden border-b-4 border-red-600">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">Olá, {user.name.split(' ')[0]}!</h1>
                
                {/* Embedded Date Selector */}
                <div className="flex items-center gap-2 bg-blue-950/40 p-1 rounded-lg border border-blue-400/30 backdrop-blur-md">
                    <Calendar size={16} className="text-blue-200 ml-2"/>
                    <div className="flex gap-1">
                        <select 
                            value={parseInt(selectedMonth.split('-')[1]) || ''}
                            onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))}
                            className="bg-transparent text-white border-none outline-none font-medium cursor-pointer text-sm hover:text-blue-200 focus:bg-blue-900 rounded p-1"
                        >
                            {MONTHS.map(m => (
                                <option key={m.value} value={m.value} className="text-gray-800">{m.label}</option>
                            ))}
                        </select>
                        <span className="text-blue-400">/</span>
                        <select 
                            value={parseInt(selectedMonth.split('-')[0]) || ''}
                            onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))}
                            className="bg-transparent text-white border-none outline-none font-medium cursor-pointer text-sm hover:text-blue-200 focus:bg-blue-900 rounded p-1"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y} className="text-gray-800">{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            <p className="text-blue-200">Gestão da unidade <span className="text-white font-bold">{myStore.name}</span>.</p>
            <div className="mt-6 flex items-center gap-4">
               <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10 shadow-lg">
                  <span className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Ranking</span>
                  <div className="text-2xl font-bold flex items-center gap-2">
                     <Trophy className={getMedalColor(myRank?.rank || 99)} size={24} />
                     {myRank ? `#${myRank.rank}` : '-'}
                  </div>
               </div>
               <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10 shadow-lg">
                  <span className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Pontos XP</span>
                  <div className="text-2xl font-bold text-white">{(myData.percentMeta * 100).toFixed(0)}</div>
               </div>
            </div>
            {!hasData && (
                <div className="mt-4 inline-block bg-yellow-500/20 border border-yellow-500/50 text-yellow-100 text-xs px-3 py-1 rounded-full animate-pulse">
                    ⚠️ Sem dados de vendas para o mês selecionado.
                </div>
            )}
          </div>

          <div className="flex-shrink-0">
             <div className="w-32 h-32 md:w-40 md:h-40 relative flex items-center justify-center">
                 {/* Radial Progress Simulation */}
                 <svg className="w-full h-full transform -rotate-90">
                    <circle cx="50%" cy="50%" r="45%" fill="transparent" stroke="#1e3a8a" strokeWidth="12" />
                    <circle 
                        cx="50%" cy="50%" r="45%" 
                        fill="transparent" 
                        stroke={myData.percentMeta >= 100 ? '#16a34a' : '#ef4444'} 
                        strokeWidth="12" 
                        strokeDasharray={`${2 * Math.PI * 45}%`} 
                        strokeDashoffset={`${2 * Math.PI * 45 * (1 - Math.min(myData.percentMeta, 100) / 100)}%`}
                        strokeLinecap="round"
                    />
                 </svg>
                 <div className="absolute flex flex-col items-center">
                    <span className={`text-2xl md:text-3xl font-bold ${myData.percentMeta >= 100 ? 'text-green-400' : 'text-white'}`}>{myData.percentMeta.toFixed(1)}%</span>
                    <span className="text-xs text-blue-300 uppercase">da Meta</span>
                 </div>
             </div>
          </div>
        </div>

        {/* Decorative background elements - Brand Colors */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-red-600 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
         {/* Meta Card */}
         <div title="Mais detalhes sobre este item" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] group cursor-default">
            <div className="flex items-center gap-3 mb-3 text-blue-800 group-hover:text-red-600 transition-colors">
               <Target size={20} />
               <h3 className="font-semibold text-gray-700">Meta do Mês</h3>
            </div>
            <div className="flex flex-col">
               <span className="text-2xl font-bold text-gray-900">{formatCurrency(myData.revenueTarget)}</span>
               <span className="text-xs text-gray-500 mt-1">Realizado: <span className="font-medium text-gray-900">{formatCurrency(myData.revenueActual)}</span></span>
               <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                  <div className={`h-2 rounded-full ${myData.percentMeta >= 100 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min(myData.percentMeta, 100)}%` }}></div>
               </div>
               <span className="text-[10px] text-gray-400 mt-2 text-right">Diária: {formatCurrency(myData.correctedDailyGoal)}</span>
            </div>
         </div>

         {/* P.A. Card */}
         <div title="Mais detalhes sobre este item" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] group cursor-default">
            <div className="flex items-center gap-3 mb-3 text-blue-800 group-hover:text-blue-600 transition-colors">
               <ShoppingBag size={20} />
               <h3 className="font-semibold text-gray-700">P.A. (Peças/Atend.)</h3>
            </div>
            <div className="flex flex-col">
               <span className={`text-3xl font-bold ${myData.itemsPerTicket >= (myData.paTarget || 0) ? 'text-green-600' : 'text-gray-900'}`}>
                   {myData.itemsPerTicket.toFixed(2)}
               </span>
               {myData.paTarget ? (
                   <ComparisonBadge current={myData.itemsPerTicket} target={myData.paTarget} />
               ) : (
                   <span className="text-xs text-gray-500 mt-1">Média Sub Grupo: {averages.pa}</span>
               )}
            </div>
         </div>

         {/* Ticket Medio Card */}
         <div title="Mais detalhes sobre este item" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] group cursor-default">
            <div className="flex items-center gap-3 mb-3 text-blue-800 group-hover:text-blue-600 transition-colors">
               <CreditCard size={20} />
               <h3 className="font-semibold text-gray-700">Ticket Médio</h3>
            </div>
            <div className="flex flex-col">
               <span className={`text-3xl font-bold ${myData.averageTicket >= (myData.ticketTarget || 0) ? 'text-green-600' : 'text-gray-900'}`}>
                   {formatCurrency(myData.averageTicket)}
               </span>
               {myData.ticketTarget ? (
                   <ComparisonBadge current={myData.averageTicket} target={myData.ticketTarget} prefix="R$" />
               ) : (
                   <span className="text-xs text-gray-500 mt-1">Valor por Venda</span>
               )}
            </div>
         </div>

         {/* P.U. Card (New) */}
         <div title="Mais detalhes sobre este item" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] group cursor-default">
            <div className="flex items-center gap-3 mb-3 text-blue-800 group-hover:text-blue-600 transition-colors">
               <Tag size={20} />
               <h3 className="font-semibold text-gray-700">Preço Médio (P.U.)</h3>
            </div>
            <div className="flex flex-col">
               <span className={`text-3xl font-bold ${myData.unitPriceAverage >= (myData.puTarget || 0) ? 'text-green-600' : 'text-gray-900'}`}>
                   {myData.unitPriceAverage.toFixed(2)}
               </span>
               {myData.puTarget ? (
                   <ComparisonBadge current={myData.unitPriceAverage} target={myData.puTarget} />
               ) : (
                   <span className="text-xs text-gray-500 mt-1">Média Sub Grupo: {Number(averages.pu).toFixed(2)}</span>
               )}
            </div>
         </div>

         {/* Inadimplencia Card */}
         <div title="Mais detalhes sobre este item" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] group cursor-default">
            <div className="flex items-center gap-3 mb-3 text-red-600">
               <AlertCircle size={20} />
               <h3 className="font-semibold text-gray-700">Inadimplência</h3>
            </div>
            <div className="flex flex-col">
               <span className={`text-3xl font-bold ${myData.delinquencyRate <= (myData.delinquencyTarget || 2) ? 'text-green-600' : 'text-red-600'}`}>
                   {myData.delinquencyRate}%
               </span>
               {myData.delinquencyTarget ? (
                   <ComparisonBadge current={myData.delinquencyRate} target={myData.delinquencyTarget} inverse prefix="Max " />
               ) : (
                   <span className="text-xs text-gray-500 mt-1">Status: {myData.delinquencyRate < 2 ? 'Saudável' : 'Atenção'}</span>
               )}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Evolution Chart Section (Now HISTORY for this store) */}
         <div className="lg:col-span-2 space-y-8">
             {/* Graph */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                       <TrendingUp size={20} className="text-blue-600"/>
                       Evolução Histórica da Loja
                   </h3>
                   <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button 
                        onClick={() => setChartView('financial')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${chartView === 'financial' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <DollarSign size={14} /> Financeiro
                      </button>
                      <button 
                        onClick={() => setChartView('operational')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${chartView === 'operational' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <Activity size={14} /> Operacional
                      </button>
                   </div>
                </div>
                
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        {chartView === 'financial' ? (
                            <BarChart data={historyData}>
                                <CartesianGrid stroke="#f5f5f5" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="left" fontSize={12} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                                <YAxis yAxisId="right" orientation="right" fontSize={12} axisLine={false} tickLine={false} domain={[0, 120]} tickFormatter={(val) => `${val}%`} />
                                <Tooltip formatter={(value: number, name: string) => name === 'Atingimento' ? `${value.toFixed(1)}%` : formatCurrency(value)} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="Meta" name="Meta" barSize={40} fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                                <Bar yAxisId="left" dataKey="Realizado" name="Venda Realizada" barSize={40} radius={[4, 4, 0, 0]}>
                                    {historyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.Atingimento >= 100 ? '#10b981' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        ) : (
                             <BarChart data={historyData}>
                                <CartesianGrid stroke="#f5f5f5" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="pa" fontSize={12} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                                <YAxis yAxisId="ticket" orientation="right" fontSize={12} axisLine={false} tickLine={false} tickFormatter={(val) => `R$${val}`} />
                                <Tooltip formatter={(value: number, name: string) => name === 'Ticket' ? formatCurrency(value) : value} />
                                <Legend />
                                <Bar yAxisId="pa" dataKey="PA" name="P.A. (Peças/Atend.)" barSize={40} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar yAxisId="ticket" dataKey="Ticket" name="Ticket Médio" barSize={40} fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Ranking Small */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={20} /> Ranking ({formatMonthName(selectedMonth)})
                    </h3>
                    <span className="text-xs text-gray-400">Valores absolutos ocultos</span>
                </div>
                <div className="p-4">
                    <div className="space-y-3">
                    {ranking.length === 0 && (
                        <div className="text-center text-gray-400 py-4 text-sm">
                            Nenhum dado de ranking disponível para este mês.
                        </div>
                    )}
                    {ranking.slice(0, 5).map((item, index) => {
                        const isMe = item.storeId === myStoreId;
                        return (
                            <div key={item.storeId} className={`flex items-center p-3 rounded-lg border ${isMe ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                                <div className="w-8 flex-shrink-0 font-bold text-lg text-center text-gray-400">
                                {index + 1}º
                                </div>
                                <div className="flex-1 px-3">
                                <div className="flex justify-between mb-1">
                                    <span className={`font-semibold text-sm ${isMe ? 'text-blue-900' : 'text-gray-700'}`}>{item.storeName} {isMe && '(Você)'}</span>
                                    <span className={`font-bold text-sm ${item.percentMeta >= 100 ? 'text-green-600' : 'text-red-600'}`}>{item.percentMeta.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div 
                                        className={`h-1.5 rounded-full ${item.percentMeta >= 100 ? 'bg-green-500' : 'bg-red-500'}`} 
                                        style={{ width: `${Math.min(item.percentMeta, 100)}%` }}
                                    ></div>
                                </div>
                                </div>
                                {index < 3 && <Medal className={getMedalColor(index + 1)} size={20} />}
                            </div>
                        );
                    })}
                    </div>
                </div>
            </div>
         </div>

         {/* AI Insights Panel - THEME UPDATE: Blue/Red accents */}
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-700 to-blue-900 rounded-t-xl">
               <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Sparkles size={20} className="text-red-300"/> Assistente Gerencial
               </h3>
               <p className="text-blue-100 text-xs mt-1">Dicas personalizadas para sua loja</p>
            </div>
            <div className="p-6 flex-1 flex flex-col">
               {analysis ? (
                  <div className="prose prose-sm prose-blue text-gray-600 flex-1 overflow-y-auto max-h-[400px]">
                     <div dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-10">
                    <Bot size={48} className="mb-4 text-blue-100" />
                    <p>Solicite uma análise da sua performance atual.</p>
                 </div>
               )}
               
               <button 
                onClick={handleAIAnalysis}
                disabled={isAnalyzing}
                className="mt-6 w-full py-3 bg-blue-50 text-blue-800 font-bold rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 border border-blue-100"
               >
                 {isAnalyzing ? 'Processando...' : 'Gerar Plano de Ação'}
                 {!isAnalyzing && <Sparkles size={16} />}
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default DashboardManager;