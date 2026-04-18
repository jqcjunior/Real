import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, AlertCircle, TrendingUp, TrendingDown, 
  Check, X, ChevronRight, BarChart3, PieChart as PieChartIcon,
  ShoppingBag, Calendar
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getAlertasAtivos, resolverAlerta, getTopDespesas, 
  getEvolucaoTemporal, getAllResumosMensais 
} from '../services/supabase.service';
import { AlertaAtivo, EvolucaoTemporal, ResumoMensal } from '../types/dre.types';

// 1. SISTEMA DE ALERTAS INTELIGENTES
export const PainelAlertas: React.FC = () => {
    const [alertas, setAlertas] = useState<AlertaAtivo[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadAlertas = async () => {
            try {
                const data = await getAlertasAtivos();
                setAlertas(data);
            } catch (err) {
                console.error('Erro ao carregar alertas:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadAlertas();
    }, []);

    const handleResolver = async (id: string) => {
        try {
            await resolverAlerta(id);
            setAlertas(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            console.error('Erro ao resolver alerta:', err);
        }
    };

    const getIconeSeveridade = (severidade: string) => {
        switch(severidade) {
            case 'critica': return <AlertTriangle className="w-5 h-5 text-red-600" />;
            case 'alta': return <AlertCircle className="w-5 h-5 text-orange-500" />;
            default: return <TrendingUp className="w-5 h-5 text-yellow-500" />;
        }
    };

    const getCorSeveridade = (severidade: string) => {
        switch(severidade) {
            case 'critica': return 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30';
            case 'alta': return 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30';
            default: return 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-101 dark:border-yellow-900/30';
        }
    };

    if (alertas.length === 0 && !isLoading) return null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={18} />
                Alertas Ativos ({alertas.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto no-scrollbar">
                {isLoading ? (
                    <div className="col-span-full py-10 flex justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                    alertas.map(alerta => (
                        <motion.div 
                            key={alerta.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`p-4 rounded-2xl border ${getCorSeveridade(alerta.severidade)} flex items-start gap-4 transition-all`}
                        >
                            <div className="mt-1">
                                {getIconeSeveridade(alerta.severidade)}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-slate-900 dark:text-white">{alerta.nome_loja}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                        {format(parseISO(alerta.mes_referencia), 'MMM/yy', { locale: ptBR })}
                                    </span>
                                </div>
                                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-1 leading-tight">{alerta.mensagem}</p>
                            </div>
                            <button 
                                onClick={() => handleResolver(alerta.id)}
                                className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-slate-400 hover:text-green-600 hover:border-green-200 transition-all shadow-sm"
                            >
                                <Check size={14} />
                            </button>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

// 2. RANKING TOP 10 DESPESAS
export const RankingDespesas: React.FC<{ lojaId: number; mesReferencia: string }> = ({ lojaId, mesReferencia }) => {
    const [topDespesas, setTopDespesas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await getTopDespesas(lojaId, mesReferencia);
                setTopDespesas(data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [lojaId, mesReferencia]);

    const total = topDespesas.reduce((sum, d) => sum + Number(d.valor), 0);
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex flex-col h-full">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                <BarChart3 className="text-blue-600" size={16} />
                Top 10 Maiores Despesas
            </h3>
            
            <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pr-1">
                {isLoading ? (
                    <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : topDespesas.length > 0 ? (
                    topDespesas.map((desp, idx) => {
                        const percent = total > 0 ? (Number(desp.valor) / total) * 100 : 0;
                        return (
                            <div key={idx} className="flex items-center gap-4 group">
                                <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center font-black text-xs border border-slate-100 dark:border-slate-700 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-all">
                                    {idx + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate max-w-[160px]">{desp.descricao}</span>
                                        <div className="text-right">
                                            <div className="text-[11px] font-black text-slate-900 dark:text-white">{formatCurrency(desp.valor)}</div>
                                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{percent.toFixed(1)}% do top 10</div>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percent}%` }}
                                            className="bg-blue-600 h-full rounded-full"
                                            transition={{ duration: 1, ease: 'easeOut' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="py-20 text-center opacity-40 italic text-[10px] font-black uppercase">Nenhum registro para este período</div>
                )}
            </div>
        </div>
    );
};

// 3. ANÁLISE DE VARIAÇÃO MoM
export const AnaliseVariacao: React.FC<{ lojaId: number; conta: string }> = ({ lojaId, conta }) => {
    const [evolucao, setEvolucao] = useState<EvolucaoTemporal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await getEvolucaoTemporal(lojaId, conta);
                setEvolucao(data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        if (conta) load();
    }, [lojaId, conta]);

    if (!conta) return null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex flex-col h-full">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                <TrendingUp className="text-blue-600" size={16} />
                Análise de Variação (MoM)
            </h3>
            
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic truncate">{conta}</p>

            <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar pr-1">
                {isLoading ? (
                    <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : evolucao.length > 0 ? (
                    evolucao.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all">
                            <span className="text-[10px] font-black text-slate-500 uppercase">
                                {format(parseISO(item.mes_referencia), 'MMM/yy', { locale: ptBR })}
                            </span>
                            <div className="flex items-center gap-4">
                                <span className="text-[11px] font-black text-slate-800 dark:text-white">
                                    {(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                                {item.variacao_percentual !== null && (
                                    <span className={`text-[10px] font-black flex items-center gap-0.5 min-w-[50px] justify-end ${
                                        item.variacao_percentual > 0 ? 'text-red-500' : 'text-green-500'
                                    }`}>
                                        {item.variacao_percentual > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                        {Math.abs(item.variacao_percentual).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center opacity-40 italic text-[10px] font-black uppercase">Selecione uma conta na barra lateral</div>
                )}
            </div>
        </div>
    );
};

// 4. GRÁFICO DE COMPOSIÇÃO
export const GraficoComposicao: React.FC<{ lojaId: number; mesReferencia: string }> = ({ lojaId, mesReferencia }) => {
    const [dados, setDados] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const COLORS = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                // Not using a specialized service yet, using basic TopDespesas as basis or custom query?
                // For simplicity, let's reuse getTopDespesas and group by group if available, or fetch direct
                // The prompt suggests fetching all and grouping
                const data = await getTopDespesas(lojaId, mesReferencia, 100); // Fetch more for composition
                
                const agrupado = data.reduce((acc: any, item: any) => {
                    const grp = item.grupo || 'OUTROS';
                    acc[grp] = (acc[grp] || 0) + Number(item.valor);
                    return acc;
                }, {});
                
                const chartData = Object.entries(agrupado).map(([name, value]) => ({
                    name,
                    value: Number(value)
                })).sort((a,b) => b.value - a.value);
                
                setDados(chartData);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [lojaId, mesReferencia]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex flex-col h-full min-h-[400px]">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                <PieChartIcon className="text-blue-600" size={16} />
                Composição de Despesas
            </h3>
            
            <div className="flex-1 min-h-0">
                {isLoading ? (
                    <div className="h-full flex justify-center items-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : dados.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={dados}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                animationDuration={1000}
                                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                            >
                                {dados.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                formatter={(value: any) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                            />
                            <Legend 
                                verticalAlign="bottom" 
                                height={36} 
                                iconType="circle"
                                formatter={(val) => <span className="text-[10px] font-black uppercase text-slate-500 mx-1">{val}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center opacity-40 italic text-[10px] font-black uppercase">Sem dados para este mês</div>
                )}
            </div>
        </div>
    );
};

// 5. HEATMAP PERFORMANCE
export const HeatmapPerformance: React.FC = () => {
    const [dados, setDados] = useState<ResumoMensal[]>([]);
    const [lojas, setLojas] = useState<number[]>([]);
    const [meses, setMeses] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getAllResumosMensais();
                setDados(data);
                setLojas(Array.from(new Set(data.map(d => d.loja_id))).sort((a,b) => a-b));
                setMeses(Array.from(new Set(data.map(d => d.mes_referencia))).sort());
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const getCorMargem = (margem: number) => {
        if (margem > 20) return 'bg-green-500 text-white';
        if (margem > 10) return 'bg-green-300 text-green-900';
        if (margem > 0) return 'bg-yellow-101 text-yellow-900';
        if (margem > -10) return 'bg-orange-300 text-orange-900';
        return 'bg-red-500 text-white';
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 overflow-hidden flex flex-col h-full">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                <ShoppingBag className="text-blue-600" size={16} />
                Mapa de Calor (Margem Líquida %)
            </h3>
            
            <div className="flex-1 overflow-x-auto no-scrollbar">
                {isLoading ? (
                    <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 sticky left-0 z-10">Loja</th>
                                {meses.map(mes => (
                                    <th key={mes} className="p-3 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase text-slate-400 text-center">
                                        {format(parseISO(mes), 'MMM/yy', { locale: ptBR })}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {lojas.map(loja => (
                                <tr key={loja}>
                                    <td className="p-3 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                        Loja {loja}
                                    </td>
                                    {meses.map(mes => {
                                        const reg = dados.find(d => d.loja_id === loja && d.mes_referencia === mes);
                                        return (
                                            <td 
                                                key={mes}
                                                className={`p-3 border border-slate-50 dark:border-slate-800 text-center text-[10px] font-black ${
                                                    reg ? getCorMargem(reg.margem_percent) : 'bg-slate-50 dark:bg-slate-800 text-slate-200'
                                                } transition-all duration-500`}
                                            >
                                                {reg ? `${reg.margem_percent.toFixed(1)}%` : '-'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-slate-50 dark:border-slate-800">
                <span className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400">
                    <div className="w-3 h-3 bg-green-500 rounded-sm" /> &gt; 20%
                </span>
                <span className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400">
                    <div className="w-3 h-3 bg-green-300 rounded-sm" /> 10-20%
                </span>
                <span className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400">
                    <div className="w-3 h-3 bg-yellow-101 rounded-sm" /> 0-10%
                </span>
                <span className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400">
                    <div className="w-3 h-3 bg-red-500 rounded-sm" /> Prejuízo
                </span>
            </div>
        </div>
    );
};

// UI Helpers
const ArrowUpRight = ({ size }: { size: number }) => <TrendingUp size={size} />;
const ArrowDownRight = ({ size }: { size: number }) => <TrendingDown size={size} />;
