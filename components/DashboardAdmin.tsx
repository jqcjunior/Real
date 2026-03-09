import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance, MonthlyGoal, IceCreamSangria } from '../types';
import { formatCurrency } from '../constants';
import * as XLSX from 'xlsx';
import { 
    LayoutDashboard, DollarSign, ShoppingBag, Target, Users, 
    RefreshCw, Loader2, BarChart3, Upload, FileSpreadsheet, CheckCircle2,
    TrendingDown, Percent, Medal, Gem, Zap, Trophy, Minus
} from 'lucide-react';

interface DashboardAdminProps {
    stores: Store[];
    performanceData: MonthlyPerformance[];
    goalsData: MonthlyGoal[];
    sangrias: IceCreamSangria[];
    onImportPerformance: (data: any[]) => Promise<void>;
    onRefresh: () => Promise<void>;
}

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, goalsData, onImportPerformance, onRefresh, sangrias }) => {
    const currentMonthStr = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefresh();
        setIsRefreshing(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                defval: "",
                raw: true
            }) as any[];

            const mappedData = jsonData.map(row => {
            const getValue = (row: any, aliases: string[]) => {
                const keys = Object.keys(row);
                // 1. Busca exata (ignorando case e espaços)
                let foundKey = keys.find(k => 
                    aliases.some(a => k.trim().toLowerCase() === a.toLowerCase())
                );
                
                // 2. Busca parcial se não encontrar exata
                if (!foundKey) {
                    foundKey = keys.find(k => {
                        const normalizedK = k.trim().toLowerCase();
                        return aliases.some(a => normalizedK.includes(a.toLowerCase()));
                    });
                }
                return foundKey ? row[foundKey] : "";
            };

                const parseBRL = (value: any) => {
                    if (value === null || value === undefined || value === "") return 0;

                    // 🔥 Caso o XLSX já tenha retornado número, NÃO mexer
                    if (typeof value === "number") {
                        return value;
                    }

                    let str = String(value).trim();
                    
                    // Remove símbolos de moeda e espaços extras
                    str = str.replace(/[R$\s]/g, "");

                    // 🔥 Caso seja formato brasileiro: 498.544,25
                    if (str.includes(",")) {
                        const normalized = str
                            .replace(/\./g, "")   // remove separador de milhar
                            .replace(",", ".");  // troca decimal

                        const num = Number(normalized);
                        return isNaN(num) ? 0 : num;
                    }

                    // 🔥 Caso já esteja em formato válido tipo "245784.55"
                    const num = Number(str);
                    return isNaN(num) ? 0 : num;
                };

                // Tentativa de encontrar a loja por número ou nome
                const storeRaw = getValue(row, ["loja", "filial", "unidade", "loja"]);
                const storeNum = String(storeRaw || '').replace(/\D/g, '').replace(/^0+/, '');
                const targetStore = stores.find(s => s.number === storeNum);
                
                if (!targetStore) return null;

                return {
                    storeId: targetStore.id,
                    month: selectedMonth,
                    revenueActual: parseBRL(getValue(row, ["valor vendido", "faturamento", "venda", "vendas", "valor", "h"])),
                    itemsActual: parseBRL(getValue(row, ["quantidade de itens", "qtde itens", "itens", "peças", "pecas", "it", "c"])),
                    salesActual: parseBRL(getValue(row, ["quantidade de vendas", "qtde vendas", "atendimentos", "vendas", "venda", "atend", "b"])),
                    paActual: parseBRL(getValue(row, ["p.a.", "p.a", "pa", "p.a ( produtos por atendimento )", "d"])),
                    puActual: parseBRL(getValue(row, ["p.u.", "p.u", "pu", "p.u ( produtos por unidade )", "e"])),
                    averageTicket: parseBRL(getValue(row, ["ticket médio", "ticket medio", "ticket", "tm", "f"])),
                    delinquencyRate: parseBRL(getValue(row, ["inadimplencia", "inadimplência", "n"])),
                    revenueTarget: parseBRL(getValue(row, ["meta", "objetivo", "target", "g"])),
                    percentMeta: parseBRL(getValue(row, ["percentual da meta", "percentual", "i"])),
                    trend: getValue(row, ["tendência", "tendencia", "l"]),
                    businessDays: parseBRL(getValue(row, ["período de vendas", "periodo", "j"])) || 26
                };
            }).filter(Boolean);

            if (mappedData.length > 0) {
                await onImportPerformance(mappedData);
                alert(`${mappedData.length} registros importados com sucesso!`);
            } else {
                alert("Nenhuma loja correspondente encontrada na planilha.");
            }
        } catch (err) {
            alert("Erro ao processar planilha. Verifique o formato.");
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const calcAttainment = (actual: number, target: number, mode: 'higher' | 'lower') => {
        if (!actual || !target) return 0;
        return mode === 'higher'
            ? (actual / target) * 100
            : (target / actual) * 100;
    };

    const stats = useMemo(() => {
        const monthPerf = performanceData.filter(p => p.month === selectedMonth);
        const monthGoals = goalsData.filter(g => {
            const gMonth = `${g.year}-${String(g.month).padStart(2, '0')}`;
            return gMonth === selectedMonth;
        });

        // Agrupar performance por loja para somar caso existam duplicatas (ex: múltiplos dias ou importações)
        const perfByStore = monthPerf.reduce((acc, p) => {
            const id = String(p.storeId || p.store_id);
            if (!acc[id]) {
                acc[id] = { 
                    revenueActual: 0,
                    itemsActual: 0,
                    salesActual: 0,

                    paActual: 0,
                    puActual: 0,
                    averageTicket: 0,

                    revenueTarget: 0,
                    itemsTarget: 0,
                    paTarget: 0,
                    puTarget: 0,
                    ticketTarget: 0,

                    businessDays: 26
                };
            }
            acc[id].revenueActual += Number(p.revenueActual || 0);
            acc[id].itemsActual += Number(p.itemsActual || 0);
            acc[id].salesActual += Number(p.salesActual || 0);
            acc[id].paActual += Number(p.paActual || 0);
            acc[id].puActual += Number(p.puActual || 0);
            acc[id].averageTicket += Number(p.averageTicket || 0);
            
            // Para metas, pegamos o valor máximo encontrado (evita somar metas duplicadas)
            acc[id].revenueTarget = Math.max(acc[id].revenueTarget, Number(p.revenueTarget || 0));
            acc[id].itemsTarget = Math.max(acc[id].itemsTarget, Number(p.itemsTarget || 0));
            acc[id].paTarget = Math.max(acc[id].paTarget, Number(p.paTarget || 0));
            acc[id].puTarget = Math.max(acc[id].puTarget, Number(p.puTarget || 0));
            acc[id].ticketTarget = Math.max(acc[id].ticketTarget, Number(p.ticketTarget || 0));
            acc[id].businessDays = Number(p.businessDays || 26);
            return acc;
        }, {} as Record<string, any>);

        // Garantir que todas as lojas apareçam, mesmo sem dados de performance no mês
        const storeStats = stores.map(store => {
            const perf = perfByStore[String(store.id)];
            const goal = monthGoals.find(g => String(g.storeId) === String(store.id));

            const revenueActual = Number(perf?.revenueActual || 0);
            const revenueTarget = Number(perf?.revenueTarget || goal?.revenueTarget || 0);
            const itemsActual = Number(perf?.itemsActual || 0);
            const itemsTarget = Number(perf?.itemsTarget || goal?.itemsTarget || 0);
            const salesActual = Number(perf?.salesActual || 0);
            
            const paActual = Number(perf?.paActual || 0);
            const puActual = Number(perf?.puActual || 0);
            const averageTicket = Number(perf?.averageTicket || 0);

            const paTarget = Number(perf?.paTarget || goal?.paTarget || 0);
            const puTarget = Number(perf?.puTarget || goal?.puTarget || 0);
            const ticketTarget = Number(perf?.ticketTarget || goal?.ticketTarget || 0);
            
            const percentMeta = revenueTarget > 0 ? (revenueActual / revenueTarget) * 100 : 0;

            return {
                storeId: store.id,
                storeNumber: store.number,
                city: store.city,
                revenueActual,
                revenueTarget,
                itemsActual,
                itemsTarget,
                salesActual,
                paActual,
                puActual,
                averageTicket,
                paTarget,
                puTarget,
                ticketTarget,
                percentMeta,
                businessDays: Number(perf?.businessDays || goal?.businessDays || 26)
            };
        });

        const totalRevenue = storeStats.reduce((acc, curr) => acc + curr.revenueActual, 0);
        const totalTarget = storeStats.reduce((acc, curr) => acc + curr.revenueTarget, 0);
        
        const totalItems = storeStats.reduce((acc, curr) => acc + curr.itemsActual, 0);
        const totalItemsTarget = storeStats.reduce((acc, curr) => acc + curr.itemsTarget, 0);
        
        const totalSales = storeStats.reduce((acc, curr) => acc + curr.salesActual, 0);
        
        // Para médias da rede, usamos a média aritmética dos targets das lojas que possuem metas cadastradas
        const storesWithGoals = storeStats.filter(s => s.revenueTarget > 0);
        const avgPATarget = storesWithGoals.length > 0 
            ? storesWithGoals.reduce((acc, curr) => acc + curr.paTarget, 0) / storesWithGoals.length 
            : 0;
        const avgPUTarget = storesWithGoals.length > 0 
            ? storesWithGoals.reduce((acc, curr) => acc + curr.puTarget, 0) / storesWithGoals.length 
            : 0;
        const avgTicketTarget = storesWithGoals.length > 0 
            ? storesWithGoals.reduce((acc, curr) => acc + curr.ticketTarget, 0) / storesWithGoals.length 
            : 0;

        const attainment = calcAttainment(totalRevenue, totalTarget, 'higher');
        const itemsAttainment = calcAttainment(totalItems, totalItemsTarget, 'higher');
        
        const avgPA = storesWithGoals.length > 0 
            ? storeStats.reduce((acc, curr) => acc + curr.paActual, 0) / storeStats.length 
            : 0;
        const paAttainment = calcAttainment(avgPA, avgPATarget, 'higher');
        
        const avgPU = storesWithGoals.length > 0 
            ? storeStats.reduce((acc, curr) => acc + curr.puActual, 0) / storeStats.length 
            : 0;
        const puAttainment = calcAttainment(avgPU, avgPUTarget, 'lower');
        
        const avgTicket = storesWithGoals.length > 0 
            ? storeStats.reduce((acc, curr) => acc + curr.averageTicket, 0) / storeStats.length 
            : 0;
        const ticketAttainment = calcAttainment(avgTicket, avgTicketTarget, 'higher');

        // Previsão de Receita
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let elapsedDays = now.getDate();
        if (selectedMonth < currentMonthStr) elapsedDays = 26; 
        if (selectedMonth > currentMonthStr) elapsedDays = 1; 
        
        const businessDays = storeStats[0]?.businessDays || 26;
        const revenueForecast = elapsedDays > 0 ? (totalRevenue / elapsedDays) * businessDays : 0;

        return {
            totalRevenue,
            totalTarget,
            attainment,
            totalItems,
            totalItemsTarget,
            itemsAttainment,
            avgPA,
            avgPATarget,
            paAttainment,
            avgPU,
            avgPUTarget,
            puAttainment,
            avgTicket,
            avgTicketTarget,
            ticketAttainment,
            revenueForecast,
            storeCount: stores.length,
            currentData: storeStats.sort((a, b) => {
                // Novo Ranking Ponderado: Meta 40%, PA 30%, Ticket 15%, PU 10%, Itens 5%
                const getScore = (s: any) => {
                    const pF = Math.min(calcAttainment(s.revenueActual, s.revenueTarget, 'higher'), 120);
                    const pPA = Math.min(calcAttainment(s.paActual, s.paTarget, 'higher'), 120);
                    const pT = Math.min(calcAttainment(s.averageTicket, s.ticketTarget, 'higher'), 120);
                    const pPU = Math.min(calcAttainment(s.puActual, s.puTarget, 'lower'), 120);
                    const pI = Math.min(calcAttainment(s.itemsActual, s.itemsTarget, 'higher'), 120);
                    return (pF * 0.40) + (pPA * 0.30) + (pT * 0.15) + (pPU * 0.10) + (pI * 0.05);
                };
                return getScore(b) - getScore(a);
            })
        };
    }, [performanceData, goalsData, selectedMonth, stores, sangrias]);

    const renderKPICard = (title: string, actual: number, target: number, percent: number, icon: React.ReactNode, type: 'currency' | 'decimal' | 'integer', isPrimary: boolean = false, mode: 'higher' | 'lower' = 'higher') => {
        const isSuccess = mode === 'higher' ? actual >= (target || 0) : actual <= (target || 999999);
        const isWarning = percent < 80;
        
        let barColor = 'bg-blue-500';
        let textColor = 'text-blue-900';
        
        if (isSuccess) {
            barColor = 'bg-emerald-500';
            textColor = 'text-emerald-600';
        } else if (percent < 50) {
            barColor = 'bg-rose-500';
            textColor = 'text-rose-600';
        } else {
            barColor = 'bg-amber-500';
            textColor = 'text-amber-600';
        }

        const formatValue = (val: number) => {
            if (type === 'currency') return formatCurrency(val);
            if (type === 'integer') return val.toLocaleString('pt-BR');
            return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        return (
            <div className={`bg-white p-5 md:p-6 rounded-[32px] shadow-sm border border-slate-100 group hover:border-blue-200 transition-all ${isPrimary ? 'ring-2 ring-blue-50' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-2.5 rounded-2xl ${isSuccess ? 'bg-emerald-50' : isWarning ? 'bg-rose-50' : 'bg-blue-50'} ${isSuccess ? 'text-emerald-600' : isWarning ? 'text-rose-600' : 'text-blue-600'}`}>
                        {React.cloneElement(icon as React.ReactElement, { size: isPrimary ? 22 : 18 })}
                    </div>
                    {target > 0 && (
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${isSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {percent.toFixed(1)}%
                        </span>
                    )}
                </div>
                
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1.5">{title}</p>
                
                <div className="flex items-baseline justify-between gap-2">
                    <h3 className={`text-xl md:text-2xl font-black italic tracking-tighter ${textColor}`}>
                        {formatValue(actual)}
                    </h3>
                </div>
                
                {target > 0 && (
                    <div className="mt-4 space-y-2">
                        <div className={`w-full bg-slate-50 rounded-full overflow-hidden ${isPrimary ? 'h-1.5' : 'h-1'}`}>
                            <div 
                                className={`h-full transition-all duration-1000 ${barColor}`} 
                                style={{ width: `${Math.min(percent, 100)}%` }} 
                            />
                        </div>
                        <p className="text-[9px] font-bold text-slate-300 italic text-right">
                            Meta: {formatValue(target)}
                        </p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header com Botões de Ação */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-900 text-white rounded-3xl shadow-xl">
                        <LayoutDashboard size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-blue-950 uppercase italic tracking-tighter leading-none">Dashboard <span className="text-red-600">Rede Real</span></h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Visão Estratégica Consolidada</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full lg:w-auto">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" hidden />
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="w-full sm:flex-1 lg:flex-none flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] shadow-lg border-b-4 border-green-800 hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                        Importar XLSX
                    </button>

                    <div className="flex items-center gap-2 w-full sm:flex-1 lg:flex-none">
                        <select 
                            value={selectedMonth.split('-')[1]} 
                            onChange={e => {
                                const [year] = selectedMonth.split('-');
                                setSelectedMonth(`${year}-${e.target.value}`);
                            }}
                            className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-xs font-black uppercase text-blue-900 outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                        >
                            <option value="01">Janeiro</option>
                            <option value="02">Fevereiro</option>
                            <option value="03">Março</option>
                            <option value="04">Abril</option>
                            <option value="05">Maio</option>
                            <option value="06">Junho</option>
                            <option value="07">Julho</option>
                            <option value="08">Agosto</option>
                            <option value="09">Setembro</option>
                            <option value="10">Outubro</option>
                            <option value="11">Novembro</option>
                            <option value="12">Dezembro</option>
                        </select>

                        <select 
                            value={selectedMonth.split('-')[0]} 
                            onChange={e => {
                                const [, month] = selectedMonth.split('-');
                                setSelectedMonth(`${e.target.value}-${month}`);
                            }}
                            className="w-24 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-xs font-black uppercase text-blue-900 outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                        >
                            {(() => {
                                const years = [];
                                const currentYear = new Date().getFullYear();
                                for (let y = currentYear + 1; y >= 2024; y--) {
                                    years.push(<option key={y} value={y}>{y}</option>);
                                }
                                return years;
                            })()}
                        </select>
                    </div>

                    <button 
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="w-full sm:w-auto p-3.5 bg-gray-950 text-white rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center active:scale-95 disabled:opacity-50"
                    >
                        {isRefreshing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                    </button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="relative group">
                    {renderKPICard('Faturamento Rede', stats.totalRevenue, stats.totalTarget, stats.attainment, <DollarSign size={24}/>, 'currency', true)}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-950 text-white text-[8px] font-black px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Previsão: {formatCurrency(stats.revenueForecast)}
                    </div>
                </div>
                {renderKPICard('P.A Médio Rede', stats.avgPA, stats.avgPATarget, stats.paAttainment, <ShoppingBag size={24}/>, 'decimal')}
                {renderKPICard('P.U Médio Rede', stats.avgPU, stats.avgPUTarget, stats.puAttainment, <Percent size={24}/>, 'decimal', false, 'lower')}
                {renderKPICard('Ticket Médio Rede', stats.avgTicket, stats.avgTicketTarget, stats.ticketAttainment, <Users size={24}/>, 'currency')}
            </div>

            {/* Ranking Operacional Section */}
            <div className="bg-white p-6 md:p-10 rounded-[48px] shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                    <h3 className="text-sm font-black text-blue-950 uppercase italic tracking-tighter flex items-center gap-3">
                        <BarChart3 className="text-blue-600" size={20} /> Ranking <span className="text-blue-600">Ponderado de Performance</span>
                    </h3>
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Atualizado em Tempo Real</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    {stats.currentData.map((d, index) => {
                        const getScore = (s: any) => {
                            const pF = Math.min(calcAttainment(s.revenueActual, s.revenueTarget, 'higher'), 120);
                            const pPA = Math.min(calcAttainment(s.paActual, s.paTarget, 'higher'), 120);
                            const pT = Math.min(calcAttainment(s.averageTicket, s.ticketTarget, 'higher'), 120);
                            const pPU = Math.min(calcAttainment(s.puActual, s.puTarget, 'lower'), 120);
                            const pI = Math.min(calcAttainment(s.itemsActual, s.itemsTarget, 'higher'), 120);
                            return (pF * 0.40) + (pPA * 0.30) + (pT * 0.15) + (pPU * 0.10) + (pI * 0.05);
                        };
                        
                        const score = getScore(d);
                        const nextStore = stats.currentData[index - 1];
                        
                        const getTier = (idx: number) => {
                            if (idx === 0) return { label: 'Diamante', icon: <Gem className="text-cyan-400" size={16} />, color: 'bg-cyan-50 text-cyan-600 border-cyan-200', bar: 'bg-cyan-500' };
                            if (idx === 1) return { label: 'Esmeralda', icon: <Gem className="text-emerald-400" size={16} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-200', bar: 'bg-emerald-500' };
                            if (idx === 2) return { label: 'Ouro', icon: <Trophy className="text-amber-400" size={16} />, color: 'bg-amber-50 text-amber-600 border-amber-200', bar: 'bg-amber-500' };
                            if (idx === 3) return { label: 'Prata', icon: <Medal className="text-slate-400" size={16} />, color: 'bg-slate-50 text-slate-600 border-slate-200', bar: 'bg-slate-400' };
                            if (idx === 4) return { label: 'Bronze', icon: <Medal className="text-orange-400" size={16} />, color: 'bg-orange-50 text-orange-600 border-orange-200', bar: 'bg-orange-500' };
                            if (idx === 5) return { label: 'Ouro', icon: <Zap className="text-amber-400" size={16} />, color: 'bg-amber-50 text-amber-600 border-amber-100', bar: 'bg-amber-400' };
                            if (idx === 6) return { label: 'Prata', icon: <Zap className="text-slate-400" size={16} />, color: 'bg-slate-50 text-slate-600 border-slate-100', bar: 'bg-slate-300' };
                            if (idx === 7) return { label: 'Bronze', icon: <Zap className="text-orange-400" size={16} />, color: 'bg-orange-50 text-orange-600 border-orange-100', bar: 'bg-orange-300' };
                            if (idx >= 8 && idx <= 12) return { label: 'Subindo', icon: <TrendingDown className="text-blue-400 rotate-180" size={16} />, color: 'bg-blue-50 text-blue-600 border-blue-100', bar: 'bg-blue-400' };
                            if (idx >= 13 && idx <= 17) return { label: 'Neutro', icon: <Minus className="text-slate-400" size={16} />, color: 'bg-slate-50 text-slate-400 border-slate-100', bar: 'bg-slate-200' };
                            if (idx >= stats.currentData.length - 3) return { label: 'Rebaixamento', icon: <TrendingDown className="text-rose-400" size={16} />, color: 'bg-rose-50 text-rose-600 border-rose-100', bar: 'bg-rose-400' };
                            return { label: 'Neutro', icon: <Minus className="text-slate-400" size={16} />, color: 'bg-slate-50 text-slate-400 border-slate-100', bar: 'bg-slate-200' };
                        };

                        const tier = getTier(index);
                        const textColor = tier.color.split(' ')[1];

                        const getRemainingWorkDays = (monthStr: string) => {
                            const [year, month] = monthStr.split('-').map(Number);
                            const now = new Date();
                            const lastDay = new Date(year, month, 0).getDate();
                            const currentYear = now.getFullYear();
                            const currentMonth = now.getMonth() + 1;
                            let startDay = 1;
                            if (year === currentYear && month === currentMonth) {
                                startDay = now.getDate();
                            } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
                                return 1;
                            }
                            let count = 0;
                            for (let d = startDay; d <= lastDay; d++) {
                                const date = new Date(year, month - 1, d);
                                if (date.getDay() !== 0) count++;
                            }
                            return Math.max(count, 1);
                        };

                        const getDetailedAdvice = (curr: any, next: any) => {
                            const remainingDays = getRemainingWorkDays(selectedMonth);
                            const diff = getScore(next) - getScore(curr);
                            
                            const revDiff = Math.max(next.revenueTarget - curr.revenueActual, 0);
                            const dailyRev = revDiff / remainingDays;
                            
                            let advice = `Melhore seu score em ${diff.toFixed(1)}% para alcançar a Loja ${next.storeNumber}. `;
                            
                            if (revDiff > 0) {
                                advice += `Venda R$ ${dailyRev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/dia para bater a meta. `;
                            }

                            if (curr.paActual < next.paTarget) {
                                const itemsNeeded = Math.ceil((next.paTarget * curr.salesActual) - curr.itemsActual);
                                if (itemsNeeded > 0) advice += `Venda +${itemsNeeded} itens para atingir P.A ${next.paTarget.toFixed(2)}. `;
                            }

                            if (curr.puActual > next.puTarget) {
                                advice += `Reduza o P.U em R$ ${(curr.puActual - next.puTarget).toFixed(2)}. `;
                            }

                            return advice;
                        };

                        return (
                            <div key={d.storeId} className={`group relative p-5 md:p-8 rounded-[32px] border transition-all duration-500 ${index < 3 ? 'bg-white shadow-xl shadow-blue-900/5 border-slate-100' : 'bg-slate-50/50 hover:bg-white border-transparent hover:border-slate-100 hover:shadow-lg'}`}>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black italic text-xl shadow-lg ${index === 0 ? 'bg-amber-400 text-white' : index === 1 ? 'bg-slate-300 text-white' : index === 2 ? 'bg-orange-400 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                            <span className="text-[10px] uppercase not-italic font-bold opacity-60 mb-0.5">{String(index + 1).padStart(2, '0')}</span>
                                            {tier.icon}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <p className="text-lg font-black text-blue-950 uppercase italic leading-none">Loja {d.storeNumber}</p>
                                                <span className={`${tier.color} text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border`}>
                                                    {tier.label}
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.city}</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 w-full md:max-w-md">
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Performance Global</p>
                                            <p className={`text-xl font-black italic ${textColor}`}>{score.toFixed(1)}%</p>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                            <div className={`h-full transition-all duration-1000 ${tier.bar}`} style={{ width: `${Math.min(score, 100)}%` }} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full md:w-auto">
                                        <div className="flex flex-col items-end">
                                            <p className="text-[8px] font-black text-slate-300 uppercase mb-0.5">Faturamento</p>
                                            <div className="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter mb-1 border border-blue-100 shadow-sm">
                                                Meta: {formatCurrency(d.revenueTarget)}
                                            </div>
                                            <p className="text-xs font-black text-blue-950 italic leading-none mb-1">{formatCurrency(d.revenueActual)}</p>
                                            {d.revenueActual < d.revenueTarget && (
                                                <p className="text-[7px] font-bold text-blue-500 uppercase leading-none">
                                                    R$ {((d.revenueTarget - d.revenueActual) / getRemainingWorkDays(selectedMonth)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/dia
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-[8px] font-black text-slate-300 uppercase mb-0.5">P.A</p>
                                            <div className="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter mb-1 border border-blue-100 shadow-sm">
                                                Meta: {d.paTarget.toFixed(2)}
                                            </div>
                                            <p className="text-xs font-black text-blue-950 italic leading-none mb-1">{d.paActual.toFixed(2)}</p>
                                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-400" style={{ width: `${Math.min((d.paActual / d.paTarget) * 100, 100)}%` }} />
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-[8px] font-black text-slate-300 uppercase mb-0.5">P.U</p>
                                            <div className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter mb-1 border border-emerald-100 shadow-sm">
                                                Meta: {d.puTarget.toFixed(2)}
                                            </div>
                                            <p className="text-xs font-black text-blue-950 italic leading-none mb-1">{d.puActual.toFixed(2)}</p>
                                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-400" style={{ width: `${Math.min((d.puTarget / d.puActual) * 100, 100)}%` }} />
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-[8px] font-black text-slate-300 uppercase mb-0.5">Ticket</p>
                                            <div className="bg-indigo-50 text-indigo-600 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter mb-1 border border-indigo-100 shadow-sm">
                                                Meta: {formatCurrency(d.ticketTarget)}
                                            </div>
                                            <p className="text-xs font-black text-blue-950 italic leading-none mb-1">{formatCurrency(d.averageTicket)}</p>
                                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-400" style={{ width: `${Math.min((d.averageTicket / d.ticketTarget) * 100, 100)}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {nextStore && (
                                    <div className={`mt-6 pt-6 border-t border-slate-100/50 flex items-start gap-3 p-4 rounded-2xl ${index >= stats.currentData.length - 3 ? 'bg-rose-50/30' : 'bg-blue-50/30'}`}>
                                        <div className={`p-1.5 rounded-lg ${index >= stats.currentData.length - 3 ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                            <TrendingDown size={14} className={index >= stats.currentData.length - 3 ? '' : 'rotate-180'} />
                                        </div>
                                        <p className="text-[10px] font-medium text-slate-600 leading-relaxed">
                                            <span className="font-black text-blue-900 uppercase tracking-tighter">Plano de Ação:</span> {getDetailedAdvice(d, nextStore)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DashboardAdmin;