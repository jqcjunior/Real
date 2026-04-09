import React, { useState } from 'react';
import { 
    FilePieChart, Printer, Plus, Briefcase, ExternalLink, 
    Activity, ShoppingCart, Users as UsersIcon, Settings, 
    ClipboardList, ChevronUp, ChevronDown, XCircle 
} from 'lucide-react';
import { formatCurrency } from '../../../constants';
import { MONTHS } from '../constants';
import { printSangriasReport } from '../../../services/printService';
import PartnersModal from '../modals/PartnersModal';
import FutureDebtModal from '../modals/FutureDebtModal';

interface DREMensalTabProps {
    dreStats: any;
    monthFiadoGrouped: any[];
    selectedMonth: number;
    setSelectedMonth: (month: number) => void;
    selectedYear: number;
    setSelectedYear: (year: number) => void;
    handlePrintDreMensal: () => void;
    sangrias: any[];
    sangriaCategories: any[];
    adminUsers: any[];
    stores: any[];
    partners: any[];
    effectiveStoreId: string;
    can: (perm: string) => boolean;
    onAddFutureDebt: (debt: any) => Promise<void>;
    onUpdatePartner: (partner: any) => Promise<void>;
    onAddPartner: (partner: any) => Promise<void>;
    onDeletePartner: (id: string) => Promise<void>;
    onTogglePartner: (id: string, active: boolean) => Promise<void>;
    fetchData?: () => Promise<void>;
}

const DREMensalTab: React.FC<DREMensalTabProps> = ({
    dreStats,
    monthFiadoGrouped,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    handlePrintDreMensal,
    sangrias,
    sangriaCategories,
    adminUsers,
    stores,
    partners,
    effectiveStoreId,
    can,
    onAddFutureDebt,
    onUpdatePartner,
    onAddPartner,
    onDeletePartner,
    onTogglePartner,
    fetchData
}) => {
    const [showPartnersModal, setShowPartnersModal] = useState(false);
    const [showFutureDebtModal, setShowFutureDebtModal] = useState(false);
    const [futureDebtForm, setFutureDebtForm] = useState({
        supplier_name: '',
        total_amount: '',
        total_installments: '1',
        intervals: '',
        first_due_date: new Date().toISOString().split('T')[0],
        categoryId: '',
        description: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSangriaDetailModal, setShowSangriaDetailModal] = useState<'day' | 'month' | null>(null);
    const [showCanceledDetails, setShowCanceledDetails] = useState(false);
    const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

    const handleAddFutureDebt = async () => {
        setIsSubmitting(true);
        try {
            const total = parseFloat(futureDebtForm.total_amount.replace(',', '.')) || 0;
            const installmentsCount = parseInt(futureDebtForm.total_installments) || 1;
            const installmentAmount = total / installmentsCount;
            
            // Parse intervals
            const intervalDays = futureDebtForm.intervals.split('/').map(i => parseInt(i.trim())).filter(i => !isNaN(i));
            
            const launchDate = new Date(futureDebtForm.first_due_date + 'T12:00:00');

            for (let i = 0; i < installmentsCount; i++) {
                const dueDate = new Date(launchDate);
                
                if (intervalDays.length > 0) {
                    // Use custom intervals if provided
                    const daysToAdd = intervalDays[i] || (intervalDays[intervalDays.length - 1] + (30 * (i - intervalDays.length + 1)));
                    dueDate.setDate(dueDate.getDate() + daysToAdd);
                } else {
                    // Default 30-day interval
                    dueDate.setMonth(dueDate.getMonth() + i);
                }

                await onAddFutureDebt({
                    store_id: effectiveStoreId,
                    supplier_name: futureDebtForm.supplier_name,
                    total_amount: total,
                    installment_number: i + 1,
                    total_installments: installmentsCount,
                    installment_amount: installmentAmount,
                    due_date: dueDate.toISOString().split('T')[0],
                    status: 'pending',
                    category_id: futureDebtForm.categoryId,
                    description: futureDebtForm.description
                });
            }

            if (fetchData) await fetchData();
            setShowFutureDebtModal(false);
            setFutureDebtForm({
                supplier_name: '',
                total_amount: '',
                total_installments: '1',
                intervals: '',
                first_due_date: new Date().toISOString().split('T')[0],
                categoryId: '',
                description: ''
            });
            alert("Despesa lançada com sucesso!");
        } catch (e: any) {
            alert("Erro ao lançar despesa: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-purple-50 text-purple-700 rounded-3xl"><FilePieChart size={32}/></div>
                    <div><h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">DRE <span className="text-purple-700">Mensal</span></h3></div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border">
                        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none text-xs font-black uppercase text-slate-900 outline-none">
                            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-xs font-black text-slate-900 outline-none">
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrintDreMensal} className="px-4 py-2.5 bg-gray-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-4 border-gray-700 active:scale-95">
                            <Printer size={14}/> Relatório
                        </button>
                        <button 
                            onClick={() => printSangriasReport({ sangrias, sangriaCategories, adminUsers, stores, effectiveStoreId, selectedMonth, selectedYear })}
                            className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-4 border-red-800 active:scale-95"
                        >
                            <Printer size={14}/> Relatório Despesas
                        </button>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Briefcase size={14}/> Demonstrativo de Resultado</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-4 border-b"><span className="font-bold text-gray-600 uppercase text-xs">Faturamento (+)</span><span className="font-black text-green-600 text-lg">{formatCurrency(dreStats.monthIn)}</span></div>
                            <div className="flex justify-between items-center pb-4 border-b cursor-pointer hover:bg-red-50 transition-all rounded-lg px-2 -mx-2" onClick={() => setShowSangriaDetailModal('month')}>
                                <span className="font-bold text-gray-600 uppercase text-xs flex items-center gap-2">Despesas / Saídas (-) <ExternalLink size={10}/></span>
                                <span className="font-black text-red-600 text-lg">{formatCurrency(dreStats.monthSangriaTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2"><span className="font-black text-blue-950 uppercase text-sm">Lucro Líquido (=)</span><span className="font-black text-blue-900 text-2xl italic">{formatCurrency(dreStats.profit)}</span></div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <Activity size={16} className="text-blue-600" /> RESUMO OPERACIONAL DO PERÍODO
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase">Total de Sangrias</p>
                                <p className="text-xl font-black text-red-600 italic">{formatCurrency(dreStats.monthSangriaTotal)}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase">Total de Avarias</p>
                                <p className="text-xl font-black text-orange-600 italic">{dreStats.monthWastageTotal.toFixed(2)}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase">Vendas Canceladas</p>
                                <p className="text-xl font-black text-gray-600 italic">{formatCurrency(dreStats.monthCanceledTotal)}</p>
                            </div>
                            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                <p className="text-[9px] font-black text-purple-400 uppercase">Dívidas Futuras (Mês)</p>
                                <p className="text-xl font-black text-purple-600 italic">{formatCurrency(dreStats.monthFutureDebts)}</p>
                            </div>
                            <div className="p-4 bg-blue-950 rounded-2xl border border-blue-900 text-white">
                                <p className="text-[9px] font-black text-blue-300 uppercase">Margem Líquida (%)</p>
                                <p className="text-xl font-black italic">{dreStats.monthIn > 0 ? ((dreStats.profit / dreStats.monthIn) * 100).toFixed(1) : '0.0'}%</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <ShoppingCart size={16} className="text-purple-600" /> Detalhamento de Vendas do Período
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {dreStats.monthSalesDetail.sort((a: any, b: any) => b.totalValue - a.totalValue).map((item: any) => (
                                <div key={item.productName} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase text-blue-950 truncate max-w-[150px]">{item.productName}</span>
                                        <span className="text-purple-600 font-black uppercase mt-1">
                                            QTD: <span className="text-lg font-black">{item.quantity}</span>
                                        </span>
                                    </div>
                                    <span className="text-xs font-black text-gray-900">{formatCurrency(item.totalValue)}</span>
                                </div>
                            ))}
                            {dreStats.monthSalesDetail.length === 0 && (
                                <p className="col-span-full text-center text-[9px] text-gray-400 uppercase italic py-4">Nenhuma venda no período</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Resumo por Método de Pagamento</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-gray-50 rounded-2xl">
                                <p className="text-[8px] font-black text-gray-400 uppercase">Pix ({dreStats.monthMethodsCount.pix})</p>
                                <p className="font-black text-blue-900">{formatCurrency(dreStats.monthMethods.pix)}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl">
                                <p className="text-[8px] font-black text-gray-400 uppercase">Dinheiro ({dreStats.monthMethodsCount.money})</p>
                                <p className="font-black text-green-700">{formatCurrency(dreStats.monthMethods.money)}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl">
                                <p className="text-[8px] font-black text-gray-400 uppercase">Cartão ({dreStats.monthMethodsCount.card})</p>
                                <p className="font-black text-orange-600">{formatCurrency(dreStats.monthMethods.card)}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl">
                                <p className="text-[8px] font-black text-gray-400 uppercase">Fiado ({dreStats.monthMethodsCount.fiado})</p>
                                <p className="font-black text-red-600">{formatCurrency(dreStats.monthMethods.fiado)}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-4 bg-gray-950 p-8 rounded-[40px] text-white shadow-2xl flex flex-col h-fit">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-3"><UsersIcon size={16}/> Partilha de Lucros</h4>
                        {can('admin_settings') && (
                            <button onClick={() => setShowPartnersModal(true)} className="text-blue-400 hover:text-blue-200 transition-all">
                                <Settings size={16}/>
                            </button>
                        )}
                    </div>
                    <div className="space-y-4">
                        {partners.map(p => (
                            <div key={p.id} className="border-b border-white/5 pb-4 last:border-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-[10px] font-black uppercase italic tracking-tighter">{p.partner_name}</span>
                                    <span className="text-[9px] font-bold text-blue-400">{p.percentage}%</span>
                                </div>
                                <p className="text-xl font-black italic tracking-tighter text-blue-100">{formatCurrency((dreStats.profit * p.percentage) / 100)}</p>
                            </div>
                        ))}
                    </div>
                    {partners.length === 0 && <p className="text-[9px] text-gray-600 uppercase text-center py-10 italic">Nenhuma partilha configurada</p>}
                </div>
            </div>

            <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-6 bg-red-50 border-b border-red-100 flex justify-between items-center">
                    <div>
                        <h4 className="text-xs font-black uppercase text-red-700 flex items-center gap-2"><ClipboardList size={16}/> Débito Funcionário - Resumo Mensal</h4>
                        <p className="text-[9px] font-bold text-red-400 uppercase mt-1">Soma total por colaborador</p>
                    </div>
                    <span className="text-lg font-black text-red-700 italic">{formatCurrency(dreStats.monthMethods.fiado)}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                            <tr>
                                <th className="px-8 py-4">Colaborador / Profissional</th>
                                <th className="px-8 py-4 text-right">Total Acumulado (R$)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                            {monthFiadoGrouped.map((f, i) => (
                                <React.Fragment key={f.name}>
                                    <tr onClick={() => setExpandedEmployee(expandedEmployee === f.name ? null : f.name)} className={`hover:bg-red-50/20 cursor-pointer transition-all ${expandedEmployee === f.name ? 'bg-red-50/40' : ''}`}>
                                        <td className="px-8 py-4 flex items-center gap-3">
                                            {expandedEmployee === f.name ? <ChevronUp size={14} className="text-red-500" /> : <ChevronDown size={14} className="text-gray-400" />}
                                            <span className="text-blue-950 uppercase italic text-xs tracking-tighter">{f.name}</span>
                                        </td>
                                        <td className="px-8 py-4 text-right text-red-700 text-sm font-black italic">{formatCurrency(f.total)}</td>
                                    </tr>
                                    {expandedEmployee === f.name && (
                                        <tr className="bg-gray-50/50">
                                            <td colSpan={2} className="px-12 py-6">
                                                <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                                                    <div className="p-3 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest">Histórico Detalhado: {f.name}</div>
                                                    <table className="w-full text-[9px] font-bold">
                                                        <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase">
                                                            <tr><th className="px-4 py-2 text-gray-900">Data</th><th className="px-4 py-2 text-gray-900">Cód. Venda</th><th className="px-4 py-2 text-gray-900">Item</th><th className="px-4 py-2 text-right text-gray-900">Valor</th></tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {f.items.map((item: any, idx: number) => (
                                                                <tr key={idx}>
                                                                    <td className="px-4 py-2 text-gray-900">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</td>
                                                                    <td className="px-4 py-2 text-blue-900 font-black">#{item.saleCode}</td>
                                                                    <td className="px-4 py-2 uppercase italic text-blue-950 font-black">{item.productName}</td>
                                                                    <td className="px-4 py-2 text-right text-red-600 font-black">{formatCurrency(item.totalValue)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {monthFiadoGrouped.length === 0 && (<tr><td colSpan={2} className="p-16 text-center text-gray-400 uppercase tracking-[0.3em] italic">Nenhuma compra no fiado</td></tr>)}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h4 className="text-xs font-black uppercase text-gray-700 flex items-center gap-2"><XCircle size={16} className="text-gray-400" /> Vendas Canceladas - Detalhamento Mensal</h4>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Histórico de cancelamentos do período</p>
                    </div>
                    <button 
                        onClick={() => setShowCanceledDetails(!showCanceledDetails)}
                        className="px-4 py-2 bg-white border rounded-xl text-[10px] font-black uppercase hover:bg-gray-50 transition-all flex items-center gap-2"
                    >
                        {showCanceledDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                        {showCanceledDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                    </button>
                </div>
                {showCanceledDetails && (
                    <div className="overflow-x-auto animate-in slide-in-from-top-2 duration-300">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                <tr>
                                    <th className="px-8 py-4">Código / Data</th>
                                    <th className="px-8 py-4">Cancelado Por</th>
                                    <th className="px-8 py-4">Motivo</th>
                                    <th className="px-8 py-4 text-right">Valor Estornado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                {dreStats.monthCanceledDetails.map((c: any) => (
                                    <tr key={c.id} className="hover:bg-gray-50/50 transition-all">
                                        <td className="px-8 py-4">
                                            <span className="block text-blue-950 font-black">#{c.saleCode}</span>
                                            <span className="text-[9px] text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                                        </td>
                                        <td className="px-8 py-4 uppercase text-gray-600">{c.canceledBy}</td>
                                        <td className="px-8 py-4 uppercase text-gray-400 italic max-w-xs truncate">{c.cancelReason}</td>
                                        <td className="px-8 py-4 text-right text-gray-900 font-black italic">{formatCurrency(c.totalValue)}</td>
                                    </tr>
                                ))}
                                {dreStats.monthCanceledDetails.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-10 text-center text-gray-400 uppercase italic text-[9px]">Nenhum cancelamento registrado</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <PartnersModal 
                isOpen={showPartnersModal}
                onClose={() => setShowPartnersModal(false)}
                partners={partners}
                onUpdatePartner={onUpdatePartner}
                onAddPartner={onAddPartner}
                onDeletePartner={onDeletePartner}
                onTogglePartner={onTogglePartner}
                effectiveStoreId={effectiveStoreId}
                fetchData={fetchData}
            />

            <FutureDebtModal 
                isOpen={showFutureDebtModal}
                onClose={() => setShowFutureDebtModal(false)}
                form={futureDebtForm}
                setForm={setFutureDebtForm}
                categories={sangriaCategories}
                isSubmitting={isSubmitting}
                onSubmit={handleAddFutureDebt}
            />
        </div>
    );
};

export default DREMensalTab;
