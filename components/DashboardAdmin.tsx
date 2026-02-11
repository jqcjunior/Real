import React, { useState, useMemo } from 'react';
import { Store, MonthlyPerformance, MonthlyGoal, UserRole } from '../types';
import { formatCurrency, formatPercent } from '../constants';
import { 
    LayoutDashboard, TrendingUp, TrendingDown, Users, 
    Target, ShoppingBag, DollarSign, Upload, 
    BarChart3, PieChart as PieChartIcon, ArrowUpRight, 
    ArrowDownRight, Loader2, Search, Filter, RefreshCw
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    Legend, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';

interface DashboardAdminProps {
    stores: Store[];
    performanceData: MonthlyPerformance[];
    goalsData: MonthlyGoal[];
    onImportData: () => Promise<void>;
}

const COLORS = ['#1e3a8a', '#dc2626', '#fbbf24', '#10b981', '#6366f1', '#ec4899'];

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, goalsData, onImportData }) => {
    const [selectedMonth, setSelectedMonth] = useState('2026-02');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onImportData();
        setIsRefreshing(false);
    };

    const stats = useMemo(() => {
        const currentData = performanceData.filter(p => p.month === selectedMonth);
        const totalRevenue = currentData.reduce((acc, curr) => acc + (Number(curr.revenueActual) || 0), 0);
        const totalTarget = currentData.reduce((acc, curr) => acc + (Number(curr.revenueTarget) || 0), 0);
        const totalItems = currentData.reduce((acc, curr) => acc + (Number(curr.itemsActual) || 0), 0);
        const totalSales = currentData.reduce((acc, curr) => acc + (Number(curr.salesActual) || 0), 0);

        const attainment = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
        const avgPA = totalSales > 0 ? totalItems / totalSales : 0;
        const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

        return {
            totalRevenue,
            totalTarget,
            attainment,
            avgPA,
            avgTicket,
            storeCount: stores.length,
            currentData: currentData.sort((a, b) => (b.revenueActual || 0) - (a.revenueActual || 0))
        };
    }, [performanceData, selectedMonth, stores]);

    const chartData = useMemo(() => {
        return stats.currentData.slice(0, 8).map(d => {
            const store = stores.find(s => s.id === d.storeId);
            return {
                name: store ? `Loja ${store.number}` : '---',
                venda: d.revenueActual || 0,
                meta: d.revenueTarget || 0
            };
        });
    }, [stats.currentData, stores]);

    return (
        <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-900 text-white rounded-3xl shadow-xl">
                        <LayoutDashboard size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-blue-950 uppercase italic tracking-tighter leading-none">Dashboard <span className="text-red-600">Rede Real</span></h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Visão Estratégica Consolidada</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <select 
                        value={selectedMonth} 
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-black uppercase text-blue-900 outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                    >
                        <option value="2026-02">Fevereiro 2026</option>
                        <option value="2026-01">Janeiro 2026</option>
                        <option value="2025-12">Dezembro 2025</option>
                    </select>
                    <button 
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-3.5 bg-gray-950 text-white rounded-xl shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isRefreshing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                    </button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 group hover:border-blue-200 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><DollarSign size={24}/></div>
                        <span className={`text-[10px] font-black uppercase ${stats.attainment >= 100 ? 'text-green-500' : 'text-blue-500'}`}>Atingimento</span>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Faturamento Rede</p>
                    <h3 className="text-3xl font-black text-blue-950 italic tracking-tighter mt-1">{formatCurrency(stats.totalRevenue)}</h3>
                    <div className="mt-4 w-full bg-gray-50 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${stats.attainment >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{width: `${Math.min(stats.attainment, 100)}%`}} />
                    </div>
                    <p className="text-[10px] font-black mt-2 text-right text-blue-900">{(stats.attainment || 0).toFixed(1)}% da Meta</p>
                </div>

                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl"><ShoppingBag size={24}/></div>
                        <span className="text-[10px] font-black text-orange-500 uppercase">Performance</span>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">P.A. Médio</p>
                    <h3 className="text-3xl font-black text-blue-950 italic tracking-tighter mt-1">{(stats.avgPA || 0).toFixed(2)} <span className="text-[10px] not-italic text-gray-300 uppercase">Pares</span></h3>
                </div>

                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-2xl"><Target size={24}/></div>
                        <span className="text-[10px] font-black text-green-500 uppercase">Financeiro</span>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ticket Médio</p>
                    <h3 className="text-3xl font-black text-blue-950 italic tracking-tighter mt-1">{formatCurrency(stats.avgTicket)}</h3>
                </div>

                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl"><Users size={24}/></div>
                        <span className="text-[10px] font-black text-purple-500 uppercase">Operação</span>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lojas Ativas</p>
                    <h3 className="text-3xl font-black text-blue-950 italic tracking-tighter mt-1">{stats.storeCount} <span className="text-[10px] not-italic text-gray-300 uppercase">Unidades</span></h3>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
                    <h3 className="text-sm font-black text-blue-950 uppercase italic tracking-tighter mb-8 flex items-center gap-2">
                        <BarChart3 className="text-blue-600" /> Ranking <span className="text-blue-600">Top Performers</span>
                    </h3>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                                <YAxis fontSize={10} fontWeight="900" tickFormatter={(val) => `R$${val/1000}k`} />
                                <Tooltip cursor={{fill: '#f8fafc'}} />
                                <Legend />
                                <Bar dataKey="venda" name="Realizado" fill="#1e3a8a" radius={[6, 6, 0, 0]} barSize={24} />
                                <Bar dataKey="meta" name="Meta" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-4 bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="text-sm font-black text-blue-950 uppercase italic tracking-tighter mb-8">Status <span className="text-red-600">por Unidade</span></h3>
                    <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
                        {stats.currentData.map(d => {
                            const store = stores.find(s => s.id === d.storeId);
                            const percent = Number(d.percentMeta) || 0;
                            const isOk = percent >= 100;
                            return (
                                <div key={d.storeId} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:bg-blue-50 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-8 rounded-full ${isOk ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                        <div>
                                            <p className="text-[10px] font-black text-blue-950 uppercase italic leading-none">Loja {store?.number}</p>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{store?.city.split(' - ')[0]}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-black italic tracking-tighter ${isOk ? 'text-green-600' : 'text-blue-900'}`}>
                                            {percent.toFixed(1)}%
                                        </p>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{formatCurrency(d.revenueActual)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardAdmin;