import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance, MonthlyGoal } from '../types';
import { formatCurrency } from '../constants';
import * as XLSX from 'xlsx';
import { 
    LayoutDashboard, DollarSign, ShoppingBag, Target, Users, 
    RefreshCw, Loader2, BarChart3, Upload, FileSpreadsheet, CheckCircle2
} from 'lucide-react';

interface DashboardAdminProps {
    stores: Store[];
    performanceData: MonthlyPerformance[];
    goalsData: MonthlyGoal[];
    onImportPerformance: (data: any[]) => Promise<void>;
    onRefresh: () => Promise<void>;
}

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, goalsData, onImportPerformance, onRefresh }) => {
    const [selectedMonth, setSelectedMonth] = useState('2026-02');
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

                    const str = String(value).trim();

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
                const storeRaw = getValue(row, ["loja", "filial"]);
                const storeNum = String(storeRaw || '').replace(/\D/g, '').replace(/^0+/, '');
                const targetStore = stores.find(s => s.number === storeNum);
                
                if (!targetStore) return null;

                return {
                    storeId: targetStore.id,
                    month: selectedMonth,
                    revenueActual: parseBRL(getValue(row, ["valor vendido", "faturamento", "venda", "vendas", "valor"])),
                    itemsActual: parseBRL(getValue(row, ["quantidade de itens", "qtde itens", "itens", "peças", "pecas", "it"])),
                    salesActual: parseBRL(getValue(row, ["quantidade de vendas", "atendimentos", "vendas", "venda", "atend"])),
                    paActual: parseBRL(getValue(row, ["p.a.", "p.a", "pa"])),
                    puActual: parseBRL(getValue(row, ["p.u.", "p.u", "pu"])),
                    averageTicket: parseBRL(getValue(row, ["ticket médio", "ticket medio", "ticket", "tm"])),
                    delinquencyRate: parseBRL(getValue(row, ["inadimplencia", "inadimplência"])),
                    revenueTarget: parseBRL(getValue(row, ["meta", "objetivo", "target"])),
                    businessDays: 26
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
                    revenueActual: 0, itemsActual: 0, salesActual: 0, 
                    revenueTarget: 0, itemsTarget: 0, paTarget: 0, puTarget: 0, ticketTarget: 0,
                    businessDays: 26
                };
            }
            acc[id].revenueActual += Number(p.revenueActual || 0);
            acc[id].itemsActual += Number(p.itemsActual || 0);
            acc[id].salesActual += Number(p.salesActual || 0);
            
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
            
            const paActual = salesActual > 0 ? itemsActual / salesActual : 0;
            const puActual = itemsActual > 0 ? revenueActual / itemsActual : 0;
            const averageTicket = salesActual > 0 ? revenueActual / salesActual : 0;

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
        
        const avgPA = totalSales > 0 ? totalItems / totalSales : 0;
        const paAttainment = calcAttainment(avgPA, avgPATarget, 'higher');
        
        const avgPU = totalItems > 0 ? totalRevenue / totalItems : 0;
        const puAttainment = calcAttainment(avgPU, avgPUTarget, 'lower');
        
        const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
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
            currentData: storeStats.sort((a, b) => b.revenueActual - a.revenueActual)
        };
    }, [performanceData, goalsData, selectedMonth, stores]);

    const renderKPICard = (title: string, actual: number, target: number, percent: number, icon: React.ReactNode, type: 'currency' | 'decimal' | 'integer', isPrimary: boolean = false) => {
        const isSuccess = percent >= 100;
        const isWarning = percent < 50;
        
        let barColor = 'bg-blue-500';
        let textColor = 'text-blue-900';
        
        if (isSuccess) {
            barColor = 'bg-green-500';
            textColor = 'text-green-600';
        } else if (isWarning) {
            barColor = 'bg-red-300';
            textColor = 'text-red-600';
        }

        const formatValue = (val: number) => {
            if (type === 'currency') return formatCurrency(val);
            if (type === 'integer') return val.toLocaleString('pt-BR');
            return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        return (
            <div className={`bg-white p-6 rounded-[40px] shadow-sm border border-gray-100 group hover:border-blue-200 transition-all ${isPrimary ? 'ring-2 ring-blue-50' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                    <div className={`p-2.5 rounded-2xl ${isSuccess ? 'bg-green-50' : isWarning ? 'bg-red-50' : 'bg-blue-50'} ${isSuccess ? 'text-green-600' : isWarning ? 'text-red-600' : 'text-blue-600'}`}>
                        {React.cloneElement(icon as React.ReactElement, { size: isPrimary ? 24 : 20 })}
                    </div>
                </div>
                
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{title}</p>
                
                <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h3 className={`text-2xl font-black italic tracking-tighter ${textColor}`}>
                        {formatValue(actual)}
                    </h3>
                    <span className="text-[10px] font-bold text-gray-300 italic">
                        {formatValue(actual)} / {formatValue(target)}
                    </span>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className={`flex-1 bg-gray-50 rounded-full overflow-hidden ${isPrimary ? 'h-2' : 'h-1'}`}>
                        <div 
                            className={`h-full transition-all duration-1000 ${barColor}`} 
                            style={{ width: `${Math.min(percent, 100)}%` }} 
                        />
                    </div>
                    <span className={`text-[10px] font-black min-w-[35px] text-right ${textColor}`}>
                        {percent.toFixed(1)}%
                    </span>
                </div>
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

                    <select 
                        value={selectedMonth} 
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="w-full sm:flex-1 lg:flex-none bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-xs font-black uppercase text-blue-900 outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                    >
                        <option value="2026-02">Fevereiro 2026</option>
                        <option value="2026-01">Janeiro 2026</option>
                        <option value="2025-12">Dezembro 2025</option>
                    </select>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
                <div className="relative group">
                    {renderKPICard('Faturamento Rede', stats.totalRevenue, stats.totalTarget, stats.attainment, <DollarSign size={24}/>, 'currency', true)}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-950 text-white text-[8px] font-black px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Previsão: {formatCurrency(stats.revenueForecast)}
                    </div>
                </div>
                {renderKPICard('Quantidade de Itens', stats.totalItems, stats.totalItemsTarget, stats.itemsAttainment, <ShoppingBag size={24}/>, 'integer')}
                {renderKPICard('Peças por Atendimento (P.A)', stats.avgPA, stats.avgPATarget, stats.paAttainment, <Target size={24}/>, 'decimal')}
                {renderKPICard('Preço Unitário Médio (P.U)', stats.avgPU, stats.avgPUTarget, stats.puAttainment, <BarChart3 size={24}/>, 'currency')}
                {renderKPICard('Ticket Médio', stats.avgTicket, stats.avgTicketTarget, stats.ticketAttainment, <Users size={24}/>, 'currency')}
            </div>

            {/* Ranking Operacional Section */}
            <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
                <h3 className="text-sm font-black text-blue-950 uppercase italic tracking-tighter mb-8 flex items-center gap-2">
                    <BarChart3 className="text-blue-600" /> Ranking <span className="text-blue-600">Operacional de Lojas</span>
                </h3>
                
                <div className="overflow-x-auto -mx-4 px-4">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="border-b-2 border-gray-100">
                                <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Loja / Cidade</th>
                                <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Faturamento / Atingimento</th>
                                <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">P.A</th>
                                <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">P.U Médio</th>
                                <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Ticket Médio</th>
                                <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Itens</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {stats.currentData.map((d, index) => {
                                const percent = Number(d.percentMeta) || 0;
                                const revenueActual = Number(d.revenueActual) || 0;
                                const revenueTarget = Number(d.revenueTarget) || 0;
                                
                                // Cor da barra:
                                // >=100% → verde
                                // 50% a 99% → azul
                                // <50% → vermelho claro
                                let barColor = 'bg-red-300';
                                if (percent >= 100) barColor = 'bg-green-500';
                                else if (percent >= 50) barColor = 'bg-blue-500';

                                return (
                                    <tr key={d.storeId} className="hover:bg-blue-50/50 transition-all group">
                                        <td className="py-5 px-4">
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-black text-gray-300 group-hover:text-blue-200 transition-colors">#{String(index + 1).padStart(2, '0')}</span>
                                                <div>
                                                    <p className="text-sm font-black text-blue-950 uppercase italic leading-none">Loja {d.storeNumber}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{d.city.split(' - ')[0]}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-5 px-4">
                                            <div className="flex items-center justify-end gap-4">
                                                <div className="text-right min-w-[120px]">
                                                    <p className="text-sm font-black text-blue-950 italic">{formatCurrency(revenueActual)}</p>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1">
                                                        Meta: {formatCurrency(revenueTarget)}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-center w-28">
                                                    <span className={`text-[10px] font-black italic mb-1 ${percent >= 100 ? 'text-green-600' : 'text-blue-900'}`}>
                                                        {percent.toFixed(1)}%
                                                    </span>
                                                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden shadow-inner">
                                                        <div 
                                                            className={`h-full transition-all duration-1000 ${barColor}`} 
                                                            style={{ width: `${Math.min(percent, 100)}%` }} 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-5 px-4 text-right">
                                            <p className="text-sm font-black text-blue-950">{(Number(d.paActual) || 0).toFixed(2)}</p>
                                        </td>
                                        <td className="py-5 px-4 text-right">
                                            <p className="text-sm font-black text-blue-950">{formatCurrency(Number(d.puActual) || 0)}</p>
                                        </td>
                                        <td className="py-5 px-4 text-right">
                                            <p className="text-sm font-black text-blue-950">{formatCurrency(Number(d.averageTicket) || 0)}</p>
                                        </td>
                                        <td className="py-5 px-4 text-right">
                                            <p className="text-sm font-black text-blue-950">{Number(d.itemsActual || 0).toLocaleString('pt-BR')}</p>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DashboardAdmin;