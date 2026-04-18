import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, AlertCircle, ShoppingBag, 
  Search, Filter, Calendar, ChevronRight, BarChart3,
  ArrowUpRight, ArrowDownRight, Info, AlertTriangle,
  Loader2, RefreshCw, Upload, Download, X
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import { 
  getResumoMensal, getAnomalies, getStatusCota, getComparativo, getRanking 
} from '../services/supabase.service';
import type { 
  ResumoMensal, DREAnomaly, StatusCotaView, ComparativoMoM, RankingLoja,
  KPICard as IKPICard
} from '../types/dre.types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import DREUpload from './DREUpload';

/**
 * DASHBOARD EXECUTIVO DRE (ADMIN)
 * 
 * Visão consolidada de todas as lojas para tomada de decisão estratégica.
 */

const DREDashboardAdmin: React.FC = () => {
    // ESTADOS
    const [mesReferencia, setMesReferencia] = useState(format(new Date(), 'yyyy-MM'));
    const [lojasSelecionadas, setLojasSelecionadas] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);

    // DADOS
    const [resumoLojas, setResumoLojas] = useState<ResumoMensal[]>([]);
    const [anomalias, setAnomalias] = useState<DREAnomaly[]>([]);
    const [statusCotas, setStatusCotas] = useState<StatusCotaView[]>([]);
    const [comparativos, setComparativos] = useState<ComparativoMoM[]>([]);
    const [ranking, setRanking] = useState<RankingLoja[]>([]);

    const hasData = resumoLojas.length > 0;

    // CARREGAR DADOS
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Normalizar mesReferencia para YYYY-MM-01 (Postgres DATE exige dia completo)
            const mesFormatado = mesReferencia.length === 7 ? `${mesReferencia}-01` : mesReferencia;
            
            console.log(`[DRE] Buscando dados para ${mesFormatado}...`);
            const [res, ano, cot, com, ran] = await Promise.all([
                getResumoMensal(mesFormatado, lojasSelecionadas),
                getAnomalies(mesFormatado, lojasSelecionadas),
                getStatusCota(mesFormatado, lojasSelecionadas),
                getComparativo(mesFormatado, lojasSelecionadas),
                getRanking(mesFormatado)
            ]);

            setResumoLojas(res);
            setAnomalias(ano);
            setStatusCotas(cot);
            setComparativos(com);
            setRanking(ran);
        } catch (err: any) {
            console.error('Erro ao carregar Dashboard DRE:', err);
            
            // Tratamento específico para erro de Views não criadas (status 400 no Supabase)
            if (err?.code === 'PGRST116' || (err?.message && err.message.toLowerCase().includes('relation') && err.message.toLowerCase().includes('does not exist'))) {
                 setError('Estrutura de dados não encontrada. Por favor, execute a migração SQL DRE_ANALYTICS_MIGRATION.sql no seu Supabase.');
            } else {
                 setError('Falha ao sincronizar dados do DRE. Verifique sua conexão ou as Views no Supabase.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [mesReferencia, lojasSelecionadas]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // CÁLCULOS KPI
    const kpis = useMemo(() => {
        const receitaTotal = resumoLojas.reduce((acc, r) => acc + r.receita_total, 0);
        const despesaTotal = resumoLojas.reduce((acc, r) => acc + r.despesa_total, 0);
        const margemMedia = receitaTotal !== 0 
            ? ((receitaTotal - despesaTotal) / receitaTotal) * 100 
            : 0;
        const anomaliasAtivas = anomalias.filter(a => a.status === 'pendente').length;

        return [
            { id: 'rec', title: 'Receita Total', value: receitaTotal, icon: <TrendingUp className="text-green-600" />, color: 'bg-green-50' },
            { id: 'des', title: 'Despesa Total', value: despesaTotal, icon: <TrendingDown className="text-red-500" />, color: 'bg-red-50' },
            { id: 'mar', title: 'Margem Média', value: `${margemMedia.toFixed(2)}%`, icon: <BarChart3 className="text-blue-500" />, color: 'bg-blue-50' },
            { id: 'ano', title: 'Anomalias Ativas', value: anomaliasAtivas, icon: <AlertCircle className="text-amber-500" />, color: 'bg-amber-50' }
        ];
    }, [resumoLojas, anomalias]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    // RENDERIZAÇÃO
    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 animate-in fade-in duration-500">
            {/* HEADER & FILTROS */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800">
                <div>
                   <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white">
                     DRE <span className="text-blue-600">Analytics</span>
                   </h1>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Visão Executiva da Rede</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="month" 
                            value={mesReferencia}
                            onChange={(e) => setMesReferencia(e.target.value)}
                            className="w-full md:w-48 pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black text-xs uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                    </div>
                    
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 font-black text-[10px] uppercase tracking-widest shrink-0"
                    >
                        <Upload size={18} />
                        <span className="hidden sm:inline">Fazer Upload</span>
                        <span className="sm:inline hidden md:hidden">Upload</span>
                    </button>

                    <button 
                        onClick={() => fetchData()}
                        disabled={isLoading}
                        className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                    </button>
                </div>
            </header>

            {/* KPI GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi) => (
                    <div key={kpi.id} className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-5">
                        <div className={`p-4 ${kpi.color} rounded-2xl`}>
                            {kpi.icon}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{kpi.title}</p>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1">
                                {typeof kpi.value === 'number' ? formatCurrency(kpi.value) : kpi.value}
                            </h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* ANOMALIAS ALERT SECTION (Se houver) */}
            {anomalias.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="text-amber-600" size={24} />
                        <div>
                            <p className="text-xs font-black text-amber-900 uppercase">Detecção de Anomalias</p>
                            <p className="text-[10px] text-amber-700 font-bold uppercase mt-0.5">Foram detectadas {anomalias.length} inconsistências financeiras este mês.</p>
                        </div>
                    </div>
                    <button className="px-4 py-2 bg-amber-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-amber-700 transition-all shadow-md">
                        Auditar Agora
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* TABELA DE LOJAS */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Performance por Loja</h2>
                        <button 
                            disabled={!hasData}
                            className={`text-[10px] font-bold uppercase flex items-center gap-1 transition-all ${hasData ? 'text-blue-600 hover:underline' : 'text-slate-300 cursor-not-allowed'}`}
                        >
                            <Download size={14} /> Download Excel <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Loja</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Receita</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Despesas</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Margem%</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Status Cota</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {resumoLojas.length > 0 ? resumoLojas.map((res) => {
                                    const cota = statusCotas.find(c => c.loja_id === res.loja_id);
                                    return (
                                        <tr key={res.loja_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group cursor-pointer">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-black text-blue-600">
                                                        {res.loja_id}
                                                    </div>
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">Loja {res.loja_id}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-slate-100">
                                                {formatCurrency(res.receita_total)}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                                {formatCurrency(res.despesa_total)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black italic ${res.margem_percent > 15 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {res.margem_percent.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {cota ? (
                                                    <div className="flex flex-col gap-1 w-24">
                                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full transition-all duration-1000 ${cota.percent_utilizado > 90 ? 'bg-red-500' : 'bg-blue-600'}`}
                                                                style={{ width: `${Math.min(100, cota.percent_utilizado)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase">{cota.percent_utilizado.toFixed(0)}% Consumido</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Sem Cota</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300">
                                                    <Search size={32} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum dado encontrado</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Carregue seu DRE para visualizar a performance das lojas</p>
                                                </div>
                                                <button
                                                    onClick={() => setShowUploadModal(true)}
                                                    className="mt-2 px-6 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase hover:border-blue-500 hover:text-blue-600 transition-all"
                                                >
                                                    Fazer Primeiro Upload
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* GRÁFICO EVOLUAÇÃO */}
                <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex flex-col">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Evolução do Faturamento</h2>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={resumoLojas}>
                                <defs>
                                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="loja_id" 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{fontSize: 9, fontWeight: 700}}
                                />
                                <YAxis 
                                    hide 
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(val: number) => [formatCurrency(val), 'Faturamento']}
                                />
                                <Area type="monotone" dataKey="receita_total" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* TOP RANKING */}
                    <div className="mt-8 space-y-4">
                        <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Top 3 Lojas do Mês</h3>
                        {ranking.slice(0, 3).map((item, idx) => (
                            <div key={item.loja_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-blue-600">#{idx + 1}</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Loja {item.loja_id}</span>
                                </div>
                                <span className="text-xs font-black text-slate-900 dark:text-white">{item.score.toFixed(1)} pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showUploadModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl overflow-hidden"
                        >
                            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                                <div>
                                    <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white">
                                        Importar <span className="text-blue-600">DRE</span>
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sincronização de dados consolidados</p>
                                </div>
                                <button 
                                    onClick={() => setShowUploadModal(false)}
                                    className="p-3 hover:bg-white dark:hover:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8">
                                <DREUpload onSuccess={() => {
                                    setShowUploadModal(false);
                                    fetchData();
                                }} />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DREDashboardAdmin;
