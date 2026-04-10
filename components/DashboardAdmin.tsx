import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance, MonthlyGoal, IceCreamSangria } from '../types';
import { formatCurrency } from '../constants';
import { 
    LayoutDashboard, 
    DollarSign, 
    ShoppingBag, 
    Target, 
    Users, 
    RefreshCw, 
    Loader2, 
    BarChart3, 
    FileSpreadsheet,
    TrendingDown, 
    Percent, 
    Medal, 
    Gem, 
    Zap, 
    Trophy, 
    Minus, 
    Settings, 
    Info,
    Check
} from 'lucide-react';
 
interface DashboardAdminProps {
    stores: Store[];
    performanceData: MonthlyPerformance[];
    goalsData: MonthlyGoal[];
    sangrias: IceCreamSangria[];
    onImportPerformance: (data: any[]) => Promise<void>;
    onRefresh: () => Promise<void>;
    initialWeightRevenue?: number;
    initialWeightPA?: number;
    onSaveWeights?: (wRev: number, wPA: number) => Promise<void>;
}
 
const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, goalsData, onImportPerformance, onRefresh, sangrias, initialWeightRevenue = 50, initialWeightPA = 50, onSaveWeights }) => {
    const currentMonthStr = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, []);
 
    const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // 🆕 NOVO: Estado para controlar pesos do ranking
    const [showWeightConfig, setShowWeightConfig] = useState(false);
    const [weightRevenue, setWeightRevenue] = useState(initialWeightRevenue); // Peso da Meta de Faturamento
    const [weightPA, setWeightPA] = useState(initialWeightPA); // Peso do P.A
    const [isSavingWeights, setIsSavingWeights] = useState(false);
 
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefresh();
        setIsRefreshing(false);
    };
 
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const XLSX = await import('xlsx');
        const file = e.target.files?.[0];
        if (!file) return;
 
        setIsImporting(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                defval: "",
                raw: true
            }) as any[];
 
            const mappedData = jsonData.map(row => {
            const getValue = (row: any, aliases: string[]) => {
                const keys = Object.keys(row);
                let foundKey = keys.find(k => 
                    aliases.some(a => (k || '').trim().toLowerCase() === (a || '').toLowerCase())
                );
                
                if (!foundKey) {
                    foundKey = keys.find(k => {
                        const normalizedK = (k || '').trim().toLowerCase();
                        return aliases.some(a => normalizedK.includes((a || '').toLowerCase()));
                    });
                }
                return foundKey ? row[foundKey] : "";
            };
 
                const parseBRL = (value: any) => {
                    if (value === null || value === undefined || value === "") return 0;
 
                    if (typeof value === "number") {
                        return value;
                    }
 
                    let str = String(value).trim();
                    str = str.replace(/[R$\s]/g, "");
 
                    if (str.includes(",")) {
                        const normalized = str
                            .replace(/\./g, "")
                            .replace(",", ".");
 
                        const num = Number(normalized);
                        return isNaN(num) ? 0 : num;
                    }
 
                    const num = Number(str);
                    return isNaN(num) ? 0 : num;
                };
 
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
 
        // 🔧 CORRIGIDO: Agregação correta dos dados por loja
        const perfByStore = monthPerf.reduce((acc, p) => {
            const id = String(p.storeId);
            if (!acc[id]) {
                acc[id] = { 
                    revenueActual: 0, itemsActual: 0, salesActual: 0,
                    paActual: 0, puActual: 0, averageTicket: 0,
                    revenueTarget: 0, itemsTarget: 0, paTarget: 0, puTarget: 0, ticketTarget: 0,
                    businessDays: 26,
                    lastRecord: null as any // Guardar último registro para P.A/P.U/Ticket
                };
            }
            acc[id].revenueActual += Number(p.revenueActual || 0);
            acc[id].itemsActual += Number(p.itemsActual || 0);
            acc[id].salesActual += Number(p.salesActual || 0);
            
            // 🔧 CORRIGIDO: Guardar último registro ao invés de somar
            acc[id].lastRecord = p;
            
            acc[id].revenueTarget = Math.max(acc[id].revenueTarget, Number(p.revenueTarget || 0));
            acc[id].itemsTarget = Math.max(acc[id].itemsTarget, Number(p.itemsTarget || 0));
            acc[id].paTarget = Math.max(acc[id].paTarget, Number(p.paTarget || 0));
            acc[id].puTarget = Math.max(acc[id].puTarget, Number(p.puTarget || 0));
            acc[id].ticketTarget = Math.max(acc[id].ticketTarget, Number(p.ticketTarget || 0));
            acc[id].businessDays = Number(p.businessDays || 26);
            return acc;
        }, {} as Record<string, any>);
 
        const storeStats = stores.map(store => {
            const perf = perfByStore[String(store.id)];
            const goal = monthGoals.find(g => String(g.storeId) === String(store.id));
 
            const revenueActual = Number(perf?.revenueActual || 0);
            const revenueTarget = Number(perf?.revenueTarget || goal?.revenueTarget || 0);
            const itemsActual = Number(perf?.itemsActual || 0);
            const itemsTarget = Number(perf?.itemsTarget || goal?.itemsTarget || 0);
            const salesActual = Number(perf?.salesActual || 0);
            
            // 🔧 CORRIGIDO: Buscar P.A do registro ou calcular
            let paActual = Number(perf?.lastRecord?.paActual || 0);
            if (paActual === 0 && salesActual > 0) {
                paActual = itemsActual / salesActual;
            }
            
            // 🔧 CORRIGIDO: Buscar P.U do registro ou calcular
            let puActual = Number(perf?.lastRecord?.puActual || 0);
            if (puActual === 0 && itemsActual > 0) {
                puActual = revenueActual / itemsActual;
            }
            
            // 🔧 CORRIGIDO: Buscar Ticket do registro ou calcular
            let averageTicket = Number(perf?.lastRecord?.averageTicket || 0);
            if (averageTicket === 0 && salesActual > 0) {
                averageTicket = revenueActual / salesActual;
            }
 
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
 
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let elapsedDays = now.getDate();
        if (selectedMonth < currentMonthStr) elapsedDays = 26; 
        if (selectedMonth > currentMonthStr) elapsedDays = 1; 
        
        const businessDays = storeStats[0]?.businessDays || 26;
        const revenueForecast = elapsedDays > 0 ? (totalRevenue / elapsedDays) * businessDays : 0;
 
        // 🔧 CORRIGIDO: Aplicar pesos dinâmicos ao ranking
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
                const getScore = (s: any) => {
                    const pF = Math.min(calcAttainment(s.revenueActual, s.revenueTarget, 'higher'), 120);
                    const pPA = Math.min(calcAttainment(s.paActual, s.paTarget, 'higher'), 120);
                    
                    // 🆕 NOVO: Usar pesos configuráveis
                    const wRev = weightRevenue / 100;
                    const wPA = weightPA / 100;
                    
                    return (pF * wRev) + (pPA * wPA);
                };
                return getScore(b) - getScore(a);
            })
        };
    }, [performanceData, goalsData, selectedMonth, stores, sangrias, weightRevenue, weightPA]);
 
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
            <div className={`bg-white dark:bg-slate-900 p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 group hover:border-blue-200 dark:hover:border-blue-800 transition-all ${isPrimary ? 'ring-2 ring-blue-50 dark:ring-blue-900/20' : ''}`}>
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl ${isSuccess ? 'bg-emerald-50 dark:bg-emerald-900/20' : isWarning ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-blue-50 dark:bg-blue-900/20'} ${isSuccess ? 'text-emerald-600 dark:text-emerald-400' : isWarning ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {React.cloneElement(icon as React.ReactElement<any>, { size: isPrimary ? 22 : 18 })}
                    </div>
                    {target > 0 && (
                        <span className={`text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg ${isSuccess ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                            {percent.toFixed(1)}%
                        </span>
                    )}
                </div>
                
                <p className="text-[8px] sm:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-1 sm:mb-1.5">{title}</p>
                
                <div className="flex items-baseline justify-between gap-2">
                    <h3 className={`text-lg sm:text-xl md:text-2xl font-black italic tracking-tighter ${isSuccess ? 'text-emerald-600 dark:text-emerald-400' : isWarning ? 'text-rose-600 dark:text-rose-400' : 'text-blue-900 dark:text-white'}`}>
                        {formatValue(actual)}
                    </h3>
                </div>
                
                {target > 0 && (
                    <div className="mt-3 sm:mt-4 space-y-2">
                        <div className={`w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden ${isPrimary ? 'h-1.5' : 'h-1'}`}>
                            <div 
                                className={`h-full transition-all duration-1000 ${barColor}`} 
                                style={{ width: `${Math.min(percent, 100)}%` }} 
                            />
                        </div>
                        <p className="text-[8px] sm:text-[9px] font-bold text-slate-300 dark:text-slate-600 italic text-right">
                            Meta: {formatValue(target)}
                        </p>
                    </div>
                )}
            </div>
        );
    };
 
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
 
    const getDetailedAdvice = (curr: any, next: any, idx: number) => {
        const remainingDays = getRemainingWorkDays(selectedMonth);
        const adviceParts = [];
        
        const revDiff = Math.max(curr.revenueTarget - curr.revenueActual, 0);
        if (revDiff > 0) {
            const dailyRev = revDiff / remainingDays;
            adviceParts.push(`Venda R$ ${dailyRev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/dia para bater a meta.`);
        } else {
            adviceParts.push(`Meta de faturamento atingida!`);
        }
 
        if (idx > 0) {
            if (curr.averageTicket < curr.ticketTarget) {
                const tktDiff = curr.ticketTarget - curr.averageTicket;
                const totalTktNeeded = tktDiff * curr.salesActual;
                adviceParts.push(`Aumente R$ ${totalTktNeeded.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em vendas para bater o Ticket.`);
            }
 
            if (curr.paActual < curr.paTarget) {
                const paDiff = curr.paTarget - curr.paActual;
                const itemsNeeded = Math.ceil(paDiff * curr.salesActual);
                const revForPA = itemsNeeded * (curr.puActual || 0);
                adviceParts.push(`Aumente R$ ${revForPA.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em vendas para bater o P.A.`);
            }
 
            if (curr.puActual > curr.puTarget) {
                const puDiff = curr.puActual - curr.puTarget;
                adviceParts.push(`Reduza o P.U em R$ ${puDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
            }
 
            if (next) {
                const getScore = (s: any) => {
                    const pF = Math.min(calcAttainment(s.revenueActual, s.revenueTarget, 'higher'), 120);
                    const pPA = Math.min(calcAttainment(s.paActual, s.paTarget, 'higher'), 120);
                    
                    // 🆕 NOVO: Usar pesos configuráveis
                    const wRev = weightRevenue / 100;
                    const wPA = weightPA / 100;
                    
                    return (pF * wRev) + (pPA * wPA);
                };
                
                const currPAAttainment = Math.min((curr.paActual / curr.paTarget), 1.2);
                const nextScoreDecimal = getScore(next) / 100;
                const wRev = weightRevenue / 100;
                const wPA = weightPA / 100;
                const neededRevAttainment = (nextScoreDecimal - (currPAAttainment * wPA)) / wRev;
                
                if (neededRevAttainment <= 1.2) {
                    const neededTotalRev = neededRevAttainment * curr.revenueTarget;
                    const extraRevNeeded = Math.max(neededTotalRev - curr.revenueActual, 0);
                    if (extraRevNeeded > 0) {
                        adviceParts.push(`Venda mais R$ ${extraRevNeeded.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para ultrapassar a Loja ${next.storeNumber}.`);
                    }
                } else {
                    adviceParts.push(`Para ultrapassar a Loja ${next.storeNumber}, melhore também seu P.A.`);
                }
            }
        }
 
        return adviceParts.join(' ');
    };
 
    // 🆕 NOVO: Presets de peso para seleção rápida
    const weightPresets = [
        { name: 'Balanceado', revenue: 50, pa: 50, description: 'Peso igual para Meta e P.A' },
        { name: 'Foco Meta', revenue: 70, pa: 30, description: 'Prioriza faturamento' },
        { name: 'Foco P.A', revenue: 30, pa: 70, description: 'Prioriza produtos/atendimento' },
        { name: 'Meta Total', revenue: 100, pa: 0, description: 'Apenas faturamento' },
        { name: 'P.A Total', revenue: 0, pa: 100, description: 'Apenas P.A' },
    ];
 
    return (
        <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-16 sm:pb-20 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:gap-6 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 rounded-3xl sm:rounded-[40px] shadow-sm border border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2.5 sm:p-3 md:p-4 bg-blue-900 dark:bg-blue-700 text-white rounded-2xl sm:rounded-3xl shadow-xl">
                        <LayoutDashboard size={24} className="sm:hidden" />
                        <LayoutDashboard size={28} className="hidden sm:block md:hidden" />
                        <LayoutDashboard size={32} className="hidden md:block" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-blue-950 dark:text-white uppercase italic tracking-tighter leading-none truncate">Dashboard <span className="text-red-600">Rede Real</span></h2>
                        <p className="text-[9px] sm:text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 sm:mt-1">Visão Estratégica Consolidada</p>
                    </div>
                </div>
 
                <div className="flex flex-col gap-3">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" hidden />
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] shadow-lg border-b-4 border-green-800 hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                        Importar XLSX
                    </button>
 
                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                        <div className="flex items-center gap-2 flex-1">
                            <select 
                                value={selectedMonth.split('-')[1]} 
                                onChange={e => {
                                    const [year] = selectedMonth.split('-');
                                    setSelectedMonth(`${year}-${e.target.value}`);
                                }}
                                className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3.5 text-[10px] sm:text-xs font-black uppercase text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 transition-all appearance-none cursor-pointer"
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
                                className="w-20 sm:w-24 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3.5 text-[10px] sm:text-xs font-black uppercase text-blue-900 dark:text-blue-100 outline-none focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 transition-all appearance-none cursor-pointer"
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
 
                        {/* 🆕 NOVO: Botão de configuração de pesos */}
                        <button 
                            onClick={() => setShowWeightConfig(!showWeightConfig)}
                            className={`p-3 sm:p-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center active:scale-95 ${showWeightConfig ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                        >
                            <Settings size={18} className="sm:hidden" />
                            <Settings size={20} className="hidden sm:block" />
                        </button>
 
                        <button 
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="p-3 sm:p-3.5 bg-gray-950 dark:bg-slate-800 text-white rounded-xl shadow-lg hover:bg-black dark:hover:bg-slate-700 transition-all flex items-center justify-center active:scale-95 disabled:opacity-50"
                        >
                            {isRefreshing ? <Loader2 size={18} className="animate-spin sm:hidden" /> : <RefreshCw size={18} className="sm:hidden" />}
                            {isRefreshing ? <Loader2 size={20} className="animate-spin hidden sm:block" /> : <RefreshCw size={20} className="hidden sm:block" />}
                        </button>
                    </div>
                </div>
 
                {/* 🆕 NOVO: Painel de Configuração de Pesos */}
                {showWeightConfig && (
                    <div className="mt-4 p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl sm:rounded-3xl border-2 border-blue-200 dark:border-blue-800 space-y-4 animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-xl">
                                <Settings size={18} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xs sm:text-sm font-black text-blue-950 dark:text-white uppercase italic">Configuração do Ranking</h3>
                                <p className="text-[8px] sm:text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Ajuste os pesos da fórmula</p>
                            </div>
                        </div>
 
                        {/* Fórmula Atual */}
                        <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Fórmula Atual</p>
                            <div className="font-mono text-[10px] sm:text-xs font-black text-blue-950 dark:text-white">
                                Score = (Meta × <span className="text-blue-600">{weightRevenue}%</span>) + (P.A × <span className="text-indigo-600">{weightPA}%</span>)
                            </div>
                        </div>
 
                        {/* Sliders */}
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">Peso Meta Faturamento</label>
                                    <span className="text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400">{weightRevenue}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    step="5"
                                    value={weightRevenue} 
                                    onChange={(e) => {
                                        const newValue = Number(e.target.value);
                                        setWeightRevenue(newValue);
                                        setWeightPA(100 - newValue);
                                    }}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>
 
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">Peso P.A (Produtos/Atend.)</label>
                                    <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400">{weightPA}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    step="5"
                                    value={weightPA} 
                                    onChange={(e) => {
                                        const newValue = Number(e.target.value);
                                        setWeightPA(newValue);
                                        setWeightRevenue(100 - newValue);
                                    }}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                            </div>
                        </div>
 
                        {/* Presets */}
                        <div>
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Presets Rápidos</p>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {weightPresets.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setWeightRevenue(preset.revenue);
                                            setWeightPA(preset.pa);
                                        }}
                                        className={`p-2 sm:p-3 rounded-xl text-[8px] sm:text-[9px] font-black uppercase transition-all border-2 ${
                                            weightRevenue === preset.revenue && weightPA === preset.pa
                                                ? 'bg-blue-600 text-white border-blue-700 shadow-lg scale-105'
                                                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700'
                                        }`}
                                    >
                                        <div className="font-black mb-1">{preset.name}</div>
                                        <div className="text-[7px] opacity-70">{preset.revenue}/{preset.pa}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
 
                        {/* Info */}
                        <div className="flex items-start gap-2 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
                            <Info size={14} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-[8px] sm:text-[9px] font-medium text-blue-900 dark:text-blue-100 leading-relaxed">
                                A soma dos pesos sempre será 100%. Ajuste conforme a estratégia da rede: mais peso em Meta prioriza faturamento, mais peso em P.A prioriza volume de produtos vendidos por atendimento.
                            </p>
                        </div>

                        {/* Botão Salvar */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={async () => {
                                    if (onSaveWeights) {
                                        setIsSavingWeights(true);
                                        try {
                                            await onSaveWeights(weightRevenue, weightPA);
                                            setShowWeightConfig(false);
                                        } finally {
                                            setIsSavingWeights(false);
                                        }
                                    }
                                }}
                                disabled={isSavingWeights}
                                className="w-full py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[10px] sm:text-xs shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSavingWeights ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <Check size={16} />
                                )}
                                Salvar Alterações no Ranking
                            </button>
                        </div>
                    </div>
                )}
 
                {/* Indicador de Fórmula Ativa */}
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <BarChart3 size={14} className="text-blue-600 dark:text-blue-400" />
                    <p className="text-[8px] sm:text-[9px] font-black text-blue-900 dark:text-blue-100 uppercase">
                        Ranking: <span className="text-blue-600 dark:text-blue-400">{weightRevenue}% Meta</span> + <span className="text-indigo-600 dark:text-indigo-400">{weightPA}% P.A</span>
                    </p>
                </div>
            </div>
 
            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                <div className="relative group">
                    {renderKPICard('Faturamento Rede', stats.totalRevenue, stats.totalTarget, stats.attainment, <DollarSign size={24}/>, 'currency', true)}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-950 text-white text-[7px] sm:text-[8px] font-black px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Previsão: {formatCurrency(stats.revenueForecast)}
                    </div>
                </div>
                {renderKPICard('P.A Médio Rede', stats.avgPA, stats.avgPATarget, stats.paAttainment, <ShoppingBag size={24}/>, 'decimal')}
                {renderKPICard('P.U Médio Rede', stats.avgPU, stats.avgPUTarget, stats.puAttainment, <Percent size={24}/>, 'decimal', false, 'lower')}
                {renderKPICard('Ticket Médio Rede', stats.avgTicket, stats.avgTicketTarget, stats.ticketAttainment, <Users size={24}/>, 'currency')}
            </div>
 
            {/* Ranking Section */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-10 rounded-3xl sm:rounded-[48px] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-10">
                    <h3 className="text-xs sm:text-sm font-black text-blue-950 dark:text-white uppercase italic tracking-tighter flex items-center gap-2 sm:gap-3">
                        <BarChart3 className="text-blue-600 dark:text-blue-400 sm:hidden" size={18} />
                        <BarChart3 className="text-blue-600 dark:text-blue-400 hidden sm:block" size={20} />
                        Ranking <span className="text-blue-600 dark:text-blue-400">Ponderado de Performance</span>
                    </h3>
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-700">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[8px] sm:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Atualizado em Tempo Real</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {stats.currentData.map((d, index) => {
                        const getScore = (s: any) => {
                            const pF = Math.min(calcAttainment(s.revenueActual, s.revenueTarget, 'higher'), 120);
                            const pPA = Math.min(calcAttainment(s.paActual, s.paTarget, 'higher'), 120);
                            
                            // 🆕 NOVO: Usar pesos configuráveis
                            const wRev = weightRevenue / 100;
                            const wPA = weightPA / 100;
                            
                            return (pF * wRev) + (pPA * wPA);
                        };
                        
                        const score = getScore(d);
                        const nextStore = stats.currentData[index - 1];
                        
                        const getTier = (idx: number) => {
                            if (idx === 0) return { label: 'Diamante', icon: <Gem className="text-cyan-400" size={14} />, color: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800', bar: 'bg-cyan-500' };
                            if (idx === 1) return { label: 'Esmeralda', icon: <Gem className="text-emerald-400" size={14} />, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', bar: 'bg-emerald-500' };
                            if (idx === 2) return { label: 'Ouro', icon: <Trophy className="text-amber-400" size={14} />, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800', bar: 'bg-amber-500' };
                            if (idx === 3) return { label: 'Prata', icon: <Medal className="text-slate-400" size={14} />, color: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700', bar: 'bg-slate-400' };
                            if (idx === 4) return { label: 'Bronze', icon: <Medal className="text-orange-400" size={14} />, color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800', bar: 'bg-orange-500' };
                            if (idx >= 8 && idx <= 12) return { label: 'Subindo', icon: <TrendingDown className="text-blue-400 rotate-180" size={14} />, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30', bar: 'bg-blue-400' };
                            if (idx >= stats.currentData.length - 3) return { label: 'Rebaixamento', icon: <TrendingDown className="text-rose-400" size={14} />, color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30', bar: 'bg-rose-400' };
                            return { label: 'Neutro', icon: <Minus className="text-slate-400" size={14} />, color: 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700', bar: 'bg-slate-200' };
                        };
 
                        const tier = getTier(index);
                        const textColor = tier.color.split(' ')[1];
 
                        return (
                            <div key={d.storeId} className={`group relative p-4 sm:p-5 md:p-8 rounded-2xl sm:rounded-[32px] border transition-all duration-500 ${index < 3 ? 'bg-white dark:bg-slate-900 shadow-xl shadow-blue-900/5 dark:shadow-blue-950/20 border-slate-100 dark:border-slate-800' : 'bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 border-transparent hover:border-slate-100 dark:hover:border-slate-800 hover:shadow-lg'}`}>
                                <div className="flex flex-col gap-4 sm:gap-6">
                                    {/* Header */}
                                    <div className="flex items-center gap-3 sm:gap-6">
                                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center font-black italic text-lg sm:text-xl shadow-lg ${index === 0 ? 'bg-amber-400 text-white' : index === 1 ? 'bg-slate-300 text-white' : index === 2 ? 'bg-orange-400 text-white' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700'}`}>
                                            <span className="text-[9px] sm:text-[10px] uppercase not-italic font-bold opacity-60 mb-0.5">{String(index + 1).padStart(2, '0')}</span>
                                            {tier.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                                                <p className="text-base sm:text-lg font-black text-blue-950 dark:text-white uppercase italic leading-none">Loja {d.storeNumber}</p>
                                                <span className={`${tier.color} text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-widest border`}>
                                                    {tier.label}
                                                </span>
                                            </div>
                                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{d.city}</p>
                                        </div>
                                    </div>
 
                                    {/* Performance Bar */}
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-6">
                                        <div className="flex-1 w-full">
                                            <div className="flex justify-between items-end mb-2">
                                                <p className="text-[8px] sm:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Performance Global</p>
                                                <p className={`text-lg sm:text-xl font-black italic ${textColor}`}>{score.toFixed(1)}%</p>
                                            </div>
                                            <div className="h-1.5 sm:h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                                <div className={`h-full transition-all duration-1000 ${tier.bar}`} style={{ width: `${Math.min(score, 100)}%` }} />
                                            </div>
                                        </div>
 
                                        {/* Metrics Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 w-full sm:w-auto">
                                            <div className="flex flex-col items-center sm:items-end">
                                                <p className="text-[7px] sm:text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase mb-0.5">Faturamento</p>
                                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-tighter mb-1 border border-blue-100 dark:border-blue-900/30 shadow-sm">
                                                    Meta: {formatCurrency(d.revenueTarget)}
                                                </div>
                                                <p className="text-[11px] sm:text-xs font-black text-blue-950 dark:text-blue-100 italic leading-none mb-1">{formatCurrency(d.revenueActual)}</p>
                                                {d.revenueActual < d.revenueTarget && (
                                                    <p className="text-[7px] font-bold text-blue-500 dark:text-blue-400 uppercase leading-none">
                                                        R$ {((d.revenueTarget - d.revenueActual) / getRemainingWorkDays(selectedMonth)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/dia
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-center sm:items-end">
                                                <p className="text-[7px] sm:text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase mb-0.5">P.A</p>
                                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-tighter mb-1 border border-blue-100 dark:border-blue-900/30 shadow-sm">
                                                    Meta: {d.paTarget.toFixed(2)}
                                                </div>
                                                <p className="text-[11px] sm:text-xs font-black text-blue-950 dark:text-blue-100 italic leading-none mb-1">{d.paActual.toFixed(2)}</p>
                                                <div className="w-10 sm:w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${d.paActual >= d.paTarget ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                        style={{ width: `${Math.min((d.paActual / d.paTarget) * 100, 100)}%` }} 
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center sm:items-end">
                                                <p className="text-[7px] sm:text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase mb-0.5">P.U</p>
                                                <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-tighter mb-1 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                                                    Meta: {d.puTarget.toFixed(2)}
                                                </div>
                                                <p className="text-[11px] sm:text-xs font-black text-blue-950 dark:text-blue-100 italic leading-none mb-1">{d.puActual.toFixed(2)}</p>
                                                <div className="w-10 sm:w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${d.puActual <= d.puTarget ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                        style={{ width: `${Math.min((d.puTarget / d.puActual) * 100, 100)}%` }} 
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center sm:items-end">
                                                <p className="text-[7px] sm:text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase mb-0.5">Ticket</p>
                                                <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-tighter mb-1 border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                                                    Meta: {formatCurrency(d.ticketTarget)}
                                                </div>
                                                <p className="text-[11px] sm:text-xs font-black text-blue-950 dark:text-blue-100 italic leading-none mb-1">{formatCurrency(d.averageTicket)}</p>
                                                <div className="w-10 sm:w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${d.averageTicket >= d.ticketTarget ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                        style={{ width: `${Math.min((d.averageTicket / d.ticketTarget) * 100, 100)}%` }} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
 
                                    {/* Action Plan */}
                                    <div className={`pt-4 sm:pt-6 border-t border-slate-100/50 dark:border-slate-800 flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl ${index >= stats.currentData.length - 3 ? 'bg-rose-50/30 dark:bg-rose-900/10' : 'bg-blue-50/30 dark:bg-blue-900/10'}`}>
                                        <div className={`p-1 sm:p-1.5 rounded-lg ${index >= stats.currentData.length - 3 ? 'bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400' : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'}`}>
                                            <Zap size={12} className="sm:hidden" />
                                            <Zap size={14} className="hidden sm:block" />
                                        </div>
                                        <p className="text-[9px] sm:text-[10px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
                                            <span className="font-black text-blue-900 dark:text-blue-300 uppercase tracking-tighter">Plano de Ação:</span> {getDetailedAdvice(d, nextStore, index)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
 
export default DashboardAdmin;