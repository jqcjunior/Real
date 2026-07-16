import React, { useState, useMemo } from 'react';
import { 
    DollarSign, Calendar, Plus, Filter, Search, 
    TrendingDown, Clock, Settings, Trash2, PencilLine, 
    CheckCircle2, Printer, ChevronDown, ChevronUp, AlertCircle, RotateCcw
} from 'lucide-react';
import { 
    IceCreamSangria, IceCreamSangriaCategory, IceCreamFutureDebt, 
    AdminUser, Store, IceCreamPaymentMethod, User 
} from '../../../types';
import { formatCurrency } from '../../../constants';
import { MONTHS } from '../constants';
import SangriaModal from '../modals/SangriaModal';
import FutureDebtModal from '../modals/FutureDebtModal';
import EditSangriaModal from '../modals/EditSangriaModal';
import EditFutureDebtModal from '../modals/EditFutureDebtModal';
import PayFutureDebtModal from '../modals/PayFutureDebtModal';
import CategoryManager from '../modals/CategoryManager';
import { printSangriasReport } from '../services/printService';
import { printContasAPagarReport } from '../services/printContasPagarReport';

interface DespesasTabProps {
    sangrias: IceCreamSangria[];
    futureDebts: IceCreamFutureDebt[];
    sangriaCategories: IceCreamSangriaCategory[];
    onAddSangria: (sangria: any) => Promise<void>;
    onAddFutureDebt: (debt: any) => Promise<void>;
    onPayFutureDebt: (debtId: string, paymentDate: string, paymentMethod: string, paymentNotes?: string, paidAmount?: number) => Promise<void>;
    onUndoPayFutureDebt: (debtId: string) => Promise<void>;
    onUpdateFutureDebt: (id: string, data: any) => Promise<void>;
    onDeleteFutureDebt: (id: string) => Promise<void>;
    onDeleteSangria: (id: string) => Promise<void>;
    onUpdateSangria: (id: string, data: any) => Promise<void>;
    onAddSangriaCategory: (name: string, storeId: string) => Promise<void>;
    onDeleteSangriaCategory: (id: string) => Promise<void>;
    effectiveStoreId: string;
    adminUsers: AdminUser[];
    stores: Store[];
    user: User;
    can: any;
    fetchData?: () => Promise<void>;
}

const DespesasTab: React.FC<DespesasTabProps> = ({
    sangrias,
    futureDebts,
    sangriaCategories,
    onAddSangria,
    onAddFutureDebt,
    onPayFutureDebt,
    onUndoPayFutureDebt,
    onUpdateFutureDebt,
    onDeleteFutureDebt,
    onDeleteSangria,
    onUpdateSangria,
    onAddSangriaCategory,
    onDeleteSangriaCategory,
    effectiveStoreId,
    adminUsers,
    stores,
    user,
    can,
    fetchData
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'sangrias' | 'dividas' | 'categorias'>('dividas');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modals State
    const [showSangriaModal, setShowSangriaModal] = useState(false);
    const [showFutureDebtModal, setShowFutureDebtModal] = useState(false);
    const [showEditSangriaModal, setShowEditSangriaModal] = useState(false);
    const [showEditFutureDebtModal, setShowEditFutureDebtModal] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    
    // Forms State
    const [sangriaForm, setSangriaForm] = useState({ amount: '', categoryId: '', description: '' });
    const [sangriaDate, setSangriaDate] = useState(new Date().toISOString().split('T')[0]);
    const [futureDebtForm, setFutureDebtForm] = useState({
        supplier_name: '',
        total_amount: '',
        total_installments: '1',
        intervals: '',
        first_due_date: new Date().toISOString().split('T')[0],
        categoryId: '',
        description: ''
    });
    const [editingSangria, setEditingSangria] = useState<IceCreamSangria | null>(null);
    const [editSangriaForm, setEditSangriaForm] = useState({
        amount: '',
        categoryId: '',
        description: '',
        transactionDate: '',
        notes: ''
    });
    const [editingDebt, setEditingDebt] = useState<IceCreamFutureDebt | null>(null);
    const [editDebtForm, setEditDebtForm] = useState({
        supplier_name: '', installment_amount: '', due_date: '', categoryId: '', description: '',
        payment_date: '', payment_method: ''
    });
    const [showPayDebtModal, setShowPayDebtModal] = useState(false);
    const [payingDebt, setPayingDebt] = useState<IceCreamFutureDebt | null>(null);
    const [payDebtForm, setPayDebtForm] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        payment_notes: '',
        paid_amount: ''
    });
    const [debtStatusFilter, setDebtStatusFilter] = useState<'pending' | 'overdue' | 'paid' | 'all'>('pending');
    const [debtSearchTerm, setDebtSearchTerm] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filtering Logic
    const filteredSangrias = useMemo(() => {
        const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
        const monthEnd = new Date(selectedYear, selectedMonth, 1);

        return sangrias.filter(s => {
            const dateToUse = s.transaction_date || s.created_at;
            const d = new Date(dateToUse + 'T12:00:00');
            const matchesDate = d >= monthStart && d < monthEnd;
            const matchesStore = s.store_id === effectiveStoreId;
            const matchesSearch = s.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                sangriaCategories.find(c => c.id === s.category_id)?.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            return matchesDate && matchesStore && matchesSearch;
        }).sort((a, b) => {
            const dateA = a.transaction_date || a.created_at;
            const dateB = b.transaction_date || b.created_at;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
    }, [sangrias, selectedMonth, selectedYear, effectiveStoreId, searchTerm, sangriaCategories]);

    const todayStr = new Date().toISOString().split('T')[0];
    const in7DaysStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const debtsWithStatus = useMemo(() => {
        return futureDebts
            .filter(d => d.store_id === effectiveStoreId)
            .map(d => {
                const isPaid = d.status === 'paid';
                const isOverdue = !isPaid && d.due_date < todayStr;
                const isDueSoon = !isPaid && !isOverdue && d.due_date <= in7DaysStr;
                const computedStatus: 'paid' | 'overdue' | 'due_soon' | 'ok' =
                    isPaid ? 'paid' : isOverdue ? 'overdue' : isDueSoon ? 'due_soon' : 'ok';
                return { ...d, computedStatus };
            });
    }, [futureDebts, effectiveStoreId, todayStr, in7DaysStr]);

    const filteredFutureDebts = useMemo(() => {
        const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
        const monthEnd = new Date(selectedYear, selectedMonth, 1);

        return debtsWithStatus.filter(d => {
            const dDate = new Date(d.due_date + 'T12:00:00');
            const inSelectedMonth = dDate >= monthStart && dDate < monthEnd;
            const isOverdueAlways = d.computedStatus === 'overdue';

            // Vencidos sempre aparecem, independente do mês selecionado
            const passesMonthFilter = inSelectedMonth || isOverdueAlways || d.computedStatus === 'paid';

            const passesStatusFilter =
                debtStatusFilter === 'all' ? true :
                debtStatusFilter === 'paid' ? d.computedStatus === 'paid' :
                debtStatusFilter === 'overdue' ? d.computedStatus === 'overdue' :
                d.computedStatus !== 'paid'; // 'pending' = tudo que não está pago

            const term = debtSearchTerm.toLowerCase();
            const passesSearch = !term ||
                d.supplier_name?.toLowerCase().includes(term) ||
                d.description?.toLowerCase().includes(term) ||
                sangriaCategories.find(c => c.id === d.category_id)?.name.toLowerCase().includes(term);

            return passesMonthFilter && passesStatusFilter && passesSearch;
        }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    }, [debtsWithStatus, selectedMonth, selectedYear, debtStatusFilter, debtSearchTerm, sangriaCategories]);

    // Totals
    const totalSangriasMonth = useMemo(() => filteredSangrias.reduce((acc, s) => acc + Number(s.amount), 0), [filteredSangrias]);
    
    const totalVencido = useMemo(() =>
        debtsWithStatus.filter(d => d.computedStatus === 'overdue').reduce((s, d) => s + Number(d.installment_amount), 0),
        [debtsWithStatus]
    );
    const totalAVencer7d = useMemo(() =>
        debtsWithStatus.filter(d => d.computedStatus === 'due_soon').reduce((s, d) => s + Number(d.installment_amount), 0),
        [debtsWithStatus]
    );
    const totalMesAtual = useMemo(() => {
        const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
        const monthEnd = new Date(selectedYear, selectedMonth, 1);
        return debtsWithStatus
            .filter(d => d.computedStatus !== 'paid')
            .filter(d => {
                const dDate = new Date(d.due_date + 'T12:00:00');
                return dDate >= monthStart && dDate < monthEnd;
            })
            .reduce((s, d) => s + Number(d.installment_amount), 0);
    }, [debtsWithStatus, selectedMonth, selectedYear]);
    const totalPagoMes = useMemo(() => {
        const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
        const monthEnd = new Date(selectedYear, selectedMonth, 1);
        return debtsWithStatus
            .filter(d => d.computedStatus === 'paid')
            .filter(d => {
                const refDate = new Date((d.payment_date || d.due_date) + 'T12:00:00');
                return refDate >= monthStart && refDate < monthEnd;
            })
            .reduce((s, d) => s + Number(d.installment_amount), 0);
    }, [debtsWithStatus, selectedMonth, selectedYear]);

    // Handlers
    const handleAddSangria = async () => {
        if (!sangriaForm.amount || !sangriaForm.categoryId) return;
        setIsSubmitting(true);
        try {
            await onAddSangria({
                amount: parseFloat(sangriaForm.amount.replace(',', '.')),
                category_id: sangriaForm.categoryId,
                description: sangriaForm.description.toUpperCase(),
                transaction_date: sangriaDate,
                store_id: effectiveStoreId,
                user_id: user.id
            });
            setShowSangriaModal(false);
            setSangriaForm({ amount: '', categoryId: '', description: '' });
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao adicionar sangria: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

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
            if (fetchData) await fetchData();
            alert("Despesa lançada com sucesso!");
        } catch (e: any) {
            alert("Erro ao adicionar despesa: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditFutureDebt = (debt: IceCreamFutureDebt) => {
        setEditingDebt(debt);
        setEditDebtForm({
            supplier_name: debt.supplier_name,
            installment_amount: debt.installment_amount.toString(),
            due_date: debt.due_date,
            categoryId: debt.category_id || '',
            description: debt.description || '',
            payment_date: (debt as any).payment_date || new Date().toISOString().split('T')[0],
            payment_method: (debt as any).payment_method || ''
        });
        setShowEditFutureDebtModal(true);
    };

    const handleSaveEditFutureDebt = async () => {
        if (!editingDebt) return;
        setIsSubmitting(true);
        try {
            const payload: any = {
                supplier_name: editDebtForm.supplier_name,
                installment_amount: parseFloat(editDebtForm.installment_amount.replace(',', '.')),
                due_date: editDebtForm.due_date,
                category_id: editDebtForm.categoryId,
                description: editDebtForm.description
            };
            if (editingDebt.status === 'paid') {
                payload.payment_date = editDebtForm.payment_date;
                payload.payment_method = editDebtForm.payment_method;
            }
            await onUpdateFutureDebt(editingDebt.id, payload);
            setShowEditFutureDebtModal(false);
            setEditingDebt(null);
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao atualizar conta: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteFutureDebt = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta conta a pagar?")) return;
        try {
            await onDeleteFutureDebt(id);
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao excluir conta: " + e.message);
        }
    };

    const handleOpenPayModal = (debt: IceCreamFutureDebt) => {
        setPayingDebt(debt);
        setPayDebtForm({
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: '',
            payment_notes: '',
            paid_amount: debt.installment_amount.toString()
        });
        setShowPayDebtModal(true);
    };

    const handleConfirmPayDebt = async () => {
        if (!payingDebt) return;
        setIsSubmitting(true);
        try {
            const paidAmountNum = parseFloat(payDebtForm.paid_amount.replace(',', '.')) || Number(payingDebt.installment_amount);
            await onPayFutureDebt(payingDebt.id, payDebtForm.payment_date, payDebtForm.payment_method, payDebtForm.payment_notes, paidAmountNum);
            setShowPayDebtModal(false);
            setPayingDebt(null);
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao confirmar pagamento: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUndoPayDebt = async (debt: IceCreamFutureDebt) => {
        if (!confirm(`Desfazer o pagamento de "${debt.supplier_name}"? A conta voltará para pendente.`)) return;
        try {
            await onUndoPayFutureDebt(debt.id);
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao desfazer pagamento: " + e.message);
        }
    };



    const handleEditSangria = (sangria: IceCreamSangria) => {
        setEditingSangria(sangria);
        setEditSangriaForm({
            amount: sangria.amount.toString(),
            categoryId: sangria.category_id,
            description: sangria.description || '',
            transactionDate: sangria.transaction_date || new Date(sangria.created_at).toISOString().split('T')[0],
            notes: sangria.notes || ''
        });
        setShowEditSangriaModal(true);
    };

    const handleSaveEditSangria = async () => {
        if (!editingSangria) return;
        setIsSubmitting(true);
        try {
            await onUpdateSangria(editingSangria.id, {
                amount: parseFloat(editSangriaForm.amount.replace(',', '.')),
                description: editSangriaForm.description,
                category_id: editSangriaForm.categoryId,
                transaction_date: editSangriaForm.transactionDate,
                notes: editSangriaForm.notes
            });
            setShowEditSangriaModal(false);
            setEditingSangria(null);
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao atualizar sangria: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSangria = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta sangria?")) return;
        try {
            await onDeleteSangria(id);
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao excluir sangria: " + e.message);
        }
    };

    const handleSaveCategory = async () => {
        if (!newCategoryName.trim()) return;
        setIsSubmitting(true);
        try {
            await onAddSangriaCategory(newCategoryName.trim().toUpperCase(), effectiveStoreId);
            setNewCategoryName('');
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao adicionar categoria: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = () => {
        printSangriasReport({
            sangrias,
            sangriaCategories,
            adminUsers,
            stores,
            effectiveStoreId,
            selectedMonth,
            selectedYear
        });
    };

    const handlePrintContasPagar = () => {
        const store = stores.find(s => s.id === effectiveStoreId);
        const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        const statusLabel: Record<string, string> = { overdue: 'Vencido', due_soon: 'A vencer', paid: 'Pago', ok: 'Em dia' };

        const sorted = debtsWithStatus.slice().sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        const pendentes = sorted.filter(d => d.computedStatus !== 'paid');
        const pagas = sorted.filter(d => d.computedStatus === 'paid');

        const renderRows = (list: typeof sorted) => list.map(d => {
            const category = sangriaCategories.find(c => c.id === d.category_id)?.name || 'OUTROS';
            return `
                <tr>
                    <td>${new Date(d.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>${statusLabel[d.computedStatus]}</td>
                    <td>${d.supplier_name}</td>
                    <td>${category}</td>
                    <td>${d.installment_number}/${d.total_installments}</td>
                    <td style="text-align:right">${formatCurrency(Number(d.installment_amount))}</td>
                </tr>`;
        }).join('');

        const totalPendentes = pendentes.reduce((s, d) => s + Number(d.installment_amount), 0);
        const totalPagas = pagas.reduce((s, d) => s + Number((d as any).paid_amount ?? d.installment_amount), 0);

        const html = `
            <html>
            <head>
                <title>Contas a Pagar - ${monthLabel} ${selectedYear}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                    @page { size: A4; margin: 15mm; }
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; color: #1a1a1a; }
                    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #7c3aed; padding-bottom: 16px; }
                    .header h1 { margin: 0; font-size: 22px; font-weight: 900; color: #7c3aed; text-transform: uppercase; font-style: italic; }
                    .header p { margin: 4px 0; font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; }
                    .section-title { font-size: 13px; font-weight: 900; text-transform: uppercase; margin: 24px 0 8px; padding: 8px 12px; border-radius: 8px; }
                    .section-pendentes { background: #fef2f2; color: #b91c1c; }
                    .section-pagas { background: #ecfdf5; color: #047857; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #f3f4f6; color: #374151; font-size: 9px; font-weight: 900; text-transform: uppercase; padding: 10px 8px; text-align: left; border-bottom: 2px solid #d1d5db; }
                    td { padding: 9px 8px; font-size: 10px; border-bottom: 1px solid #f3f4f6; font-weight: 600; }
                    .subtotal-row { background: #fafafa; font-weight: 900; }
                    .footer { margin-top: 30px; border-top: 2px solid #7c3aed; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; }
                    .total-box { background: #7c3aed; color: white; padding: 12px 24px; border-radius: 10px; text-align: right; }
                    .total-label { font-size: 9px; font-weight: 900; text-transform: uppercase; display: block; }
                    .total-value { font-size: 18px; font-weight: 900; font-style: italic; }
                    .signature { margin-top: 50px; text-align: center; border-top: 1px solid #ccc; width: 220px; padding-top: 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
                    .empty { text-align: center; color: #9ca3af; padding: 16px; font-size: 10px; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Relatório de Contas a Pagar</h1>
                    <p>${store?.name || 'REDE REAL'} — ${monthLabel} / ${selectedYear}</p>
                    <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                </div>

                <div class="section-title section-pendentes">Pendentes / Vencidas (${pendentes.length})</div>
                ${pendentes.length > 0 ? `
                <table>
                    <thead><tr><th>Vencimento</th><th>Status</th><th>Fornecedor</th><th>Categoria</th><th>Parcela</th><th style="text-align:right;">Valor</th></tr></thead>
                    <tbody>
                        ${renderRows(pendentes)}
                        <tr class="subtotal-row"><td colspan="5" style="text-align:right">Subtotal Pendentes/Vencidas</td><td style="text-align:right">${formatCurrency(totalPendentes)}</td></tr>
                    </tbody>
                </table>` : '<p class="empty">Nenhuma conta pendente ou vencida</p>'}

                <div class="section-title section-pagas">Pagas (${pagas.length})</div>
                ${pagas.length > 0 ? `
                <table>
                    <thead><tr><th>Vencimento</th><th>Status</th><th>Fornecedor</th><th>Categoria</th><th>Parcela</th><th style="text-align:right;">Valor</th></tr></thead>
                    <tbody>
                        ${renderRows(pagas)}
                        <tr class="subtotal-row"><td colspan="5" style="text-align:right">Subtotal Pagas</td><td style="text-align:right">${formatCurrency(totalPagas)}</td></tr>
                    </tbody>
                </table>` : '<p class="empty">Nenhuma conta paga no período</p>'}

                <div class="footer">
                    <div class="signature">Assinatura do Responsável</div>
                    <div class="total-box">
                        <span class="total-label">Total Vencido + A Vencer</span>
                        <span class="total-value">${formatCurrency(totalVencido + totalAVencer7d)}</span>
                    </div>
                </div>

                <script>
                    window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };
                </script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-24">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100">
                <div className="flex items-center gap-5">
                    <div className="p-3 md:p-4 bg-red-50 text-red-600 rounded-2xl md:rounded-3xl shadow-inner">
                        <TrendingDown size={28} className="md:w-8 md:h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black uppercase italic text-blue-950 tracking-tighter leading-none">
                            Gestão de <span className="text-red-600">Despesas</span>
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <select 
                                value={selectedMonth} 
                                onChange={e => setSelectedMonth(Number(e.target.value))}
                                className="bg-gray-50 border-none rounded-lg px-2 py-1 text-[9px] font-black uppercase text-gray-500 outline-none cursor-pointer hover:bg-gray-100 transition-all"
                            >
                                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <select 
                                value={selectedYear} 
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="bg-gray-50 border-none rounded-lg px-2 py-1 text-[9px] font-black uppercase text-gray-500 outline-none cursor-pointer hover:bg-gray-100 transition-all"
                            >
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full md:flex md:w-auto">
                    <button 
                        onClick={() => setShowSangriaModal(true)}
                        className="px-4 md:px-6 py-3 md:py-4 bg-red-600 text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-2 border-b-4 border-red-900 active:scale-95"
                    >
                        <Plus size={16} /> <span className="truncate">Nova Sangria</span>
                    </button>
                    <button 
                        onClick={() => setShowFutureDebtModal(true)}
                        className="px-4 md:px-6 py-3 md:py-4 bg-purple-600 text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all flex items-center justify-center gap-2 border-b-4 border-purple-900 active:scale-95"
                    >
                        <Clock size={16} /> <span className="truncate">Nova Conta a Pagar</span>
                    </button>
                </div>
            </div>

            {/* CARDS DE RESUMO */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
                <div className="bg-white p-6 md:p-8 rounded-[40px] border-2 border-red-100 shadow-sm relative">
                    <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-[40px] pointer-events-none">
                        <TrendingDown size={80} className="absolute -top-2 -right-2 opacity-10" />
                    </div>
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block mb-4 relative">Sangrias do Mês</span>
                    <h3 className="text-lg md:text-2xl font-black text-red-700 italic break-words leading-tight relative">{formatCurrency(totalSangriasMonth)}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-2 relative">Total de saídas avulsas</p>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-[40px] border-2 border-red-100 shadow-sm relative">
                    <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-[40px] pointer-events-none">
                        <AlertCircle size={80} className="absolute -top-2 -right-2 opacity-10 text-red-500" />
                    </div>
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block mb-4 relative">Vencido</span>
                    <h3 className="text-lg md:text-2xl font-black text-red-700 italic break-words leading-tight relative">{formatCurrency(totalVencido)}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-2 relative">Contas em atraso</p>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-[40px] border-2 border-yellow-100 shadow-sm relative">
                    <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-[40px] pointer-events-none">
                        <Clock size={80} className="absolute -top-2 -right-2 opacity-10 text-yellow-500" />
                    </div>
                    <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest block mb-4 relative">A Vencer (7 dias)</span>
                    <h3 className="text-lg md:text-2xl font-black text-yellow-700 italic break-words leading-tight relative">{formatCurrency(totalAVencer7d)}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-2 relative">Próximos vencimentos</p>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-[40px] border-2 border-purple-100 shadow-sm relative">
                    <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-[40px] pointer-events-none">
                        <DollarSign size={80} className="absolute -top-2 -right-2 opacity-10 text-purple-500" />
                    </div>
                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest block mb-4 relative">Total do Mês</span>
                    <h3 className="text-lg md:text-2xl font-black text-purple-700 italic break-words leading-tight relative">{formatCurrency(totalMesAtual)}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-2 relative">Compromissos em aberto</p>
                </div>

                <div className="bg-blue-950 p-6 md:p-8 rounded-[40px] shadow-2xl relative font-sans">
                    <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-[40px] pointer-events-none">
                        <CheckCircle2 size={80} className="absolute -top-2 -right-2 opacity-10 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-4 relative">Pago no Mês</span>
                    <h3 className="text-lg md:text-2xl font-black text-white italic break-words leading-tight relative">{formatCurrency(totalPagoMes)}</h3>
                    <p className="text-[10px] font-bold text-blue-300/50 uppercase mt-2 relative">Já quitado</p>
                </div>
            </div>

            {/* NAVEGAÇÃO SUB-ABAS */}
            <div className="bg-white p-1.5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
                <button 
                    onClick={() => setActiveSubTab('sangrias')}
                    className={`px-6 md:px-8 py-2.5 md:py-3 rounded-2xl text-[10px] md:text-xs font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeSubTab === 'sangrias' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                    <DollarSign size={16} /> Sangrias
                </button>
                <button 
                    onClick={() => setActiveSubTab('dividas')}
                    className={`px-6 md:px-8 py-2.5 md:py-3 rounded-2xl text-[10px] md:text-xs font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeSubTab === 'dividas' ? 'bg-purple-600 text-white shadow-lg shadow-purple-100' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                    <Clock size={16} /> Contas a Pagar
                </button>
                <button 
                    onClick={() => setActiveSubTab('categorias')}
                    className={`px-6 md:px-8 py-2.5 md:py-3 rounded-2xl text-[10px] md:text-xs font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeSubTab === 'categorias' ? 'bg-blue-900 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                    <Settings size={16} /> Categorias
                </button>
            </div>

            {/* CONTEÚDO DAS SUB-ABAS */}
            <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
                {activeSubTab === 'sangrias' && (
                    <div className="p-8 space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="BUSCAR POR DESCRIÇÃO OU CATEGORIA..."
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black uppercase text-[10px] outline-none border-2 border-transparent focus:border-red-100 transition-all"
                                />
                            </div>
                            <button 
                                onClick={handlePrint}
                                className="w-full md:w-auto px-6 py-4 bg-red-700 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-red-800 transition-all"
                            >
                                <Printer size={16} /> Imprimir Sangrias
                            </button>
                        </div>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                    <tr>
                                        <th className="px-6 py-5">Data / Hora</th>
                                        <th className="px-6 py-5">Categoria</th>
                                        <th className="px-6 py-5">Descrição</th>
                                        <th className="px-6 py-5">Responsável</th>
                                        <th className="px-6 py-5 text-right">Valor</th>
                                        <th className="px-6 py-5 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                    {filteredSangrias.map(s => (
                                        <tr key={s.id} className="hover:bg-red-50/20 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-black text-blue-950">{new Date((s.transaction_date || s.created_at!) + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                                <div className="text-[8px] text-gray-400 uppercase">{new Date(s.created_at!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[8px] font-black uppercase tracking-tighter">
                                                    {sangriaCategories.find(c => c.id === s.category_id)?.name || 'OUTROS'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 italic max-w-[200px] truncate">{s.description || '---'}</td>
                                            <td className="px-6 py-4 uppercase text-gray-400">
                                                {adminUsers.find(u => u.id === s.user_id)?.name || 'SISTEMA'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-red-600 font-black text-sm italic">{formatCurrency(s.amount)}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditSangria(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><PencilLine size={16}/></button>
                                                    <button onClick={() => handleDeleteSangria(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredSangrias.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-20">
                                                    <Search size={48} />
                                                    <p className="font-black uppercase italic tracking-widest">Nenhuma sangria encontrada</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeSubTab === 'dividas' && (
                    <div className="p-8 space-y-6">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        value={debtSearchTerm}
                                        onChange={e => setDebtSearchTerm(e.target.value)}
                                        placeholder="BUSCAR FORNECEDOR OU DESCRIÇÃO..."
                                        className="pl-12 pr-4 py-3 bg-gray-50 rounded-2xl font-black uppercase text-[10px] outline-none border-2 border-transparent focus:border-purple-100 w-full md:w-80 transition-all"
                                    />
                                </div>
                                <select
                                    value={debtStatusFilter}
                                    onChange={e => setDebtStatusFilter(e.target.value as any)}
                                    className="px-4 py-3 bg-gray-50 rounded-2xl font-black uppercase text-[10px] outline-none border-2 border-transparent focus:border-purple-100 cursor-pointer"
                                >
                                    <option value="pending">PENDENTES (EM ABERTO/VENCIDOS)</option>
                                    <option value="overdue">ATRASADOS (VENCIDOS)</option>
                                    <option value="paid">PAGOS</option>
                                    <option value="all">TODOS</option>
                                </select>
                            </div>
                            <button
                                onClick={handlePrintContasPagar}
                                className="w-full md:w-auto px-6 py-3 bg-purple-700 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-purple-800 transition-all"
                            >
                                <Printer size={16} /> Imprimir Contas a Pagar
                            </button>
                        </div>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                    <tr>
                                        <th className="px-6 py-5">Vencimento</th>
                                        <th className="px-6 py-5">Fornecedor</th>
                                        <th className="px-6 py-5">Categoria</th>
                                        <th className="px-6 py-5">Parcela</th>
                                        <th className="px-6 py-5 text-right">Valor</th>
                                        <th className="px-6 py-5 text-center">Status</th>
                                        <th className="px-6 py-5 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                    {filteredFutureDebts.map(debt => {
                                        const statusColors = {
                                            paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                                            overdue: 'bg-red-50 text-red-700 border-red-100 animate-pulse',
                                            due_soon: 'bg-yellow-50 text-yellow-700 border-yellow-100',
                                            ok: 'bg-blue-50 text-blue-700 border-blue-100'
                                        }[debt.computedStatus];

                                        const statusLabels = {
                                            paid: 'PAGO',
                                            overdue: 'VENCIDO',
                                            due_soon: 'A VENCER (7D)',
                                            ok: 'EM DIA'
                                        }[debt.computedStatus];

                                        return (
                                            <tr key={debt.id} className="hover:bg-purple-50/20 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-black text-blue-950">{new Date(debt.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                                    {debt.status === 'paid' && debt.payment_date && (
                                                        <div className="text-[8px] text-emerald-600 uppercase mt-0.5">
                                                            Pago em {new Date(debt.payment_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                            {(debt as any).payment_method && ` · ${(debt as any).payment_method}`}
                                                        </div>
                                                    )}
                                                    {debt.status === 'paid' && (debt as any).paid_amount != null && Number((debt as any).paid_amount) !== Number(debt.installment_amount) && (
                                                        <div className="text-[8px] text-amber-600 font-black uppercase mt-0.5">
                                                            Pago: {formatCurrency(Number((debt as any).paid_amount))}
                                                        </div>
                                                    )}
                                                    {debt.status === 'paid' && (debt as any).payment_notes && (
                                                        <div className="text-[8px] text-gray-400 italic mt-0.5 max-w-[160px] truncate" title={(debt as any).payment_notes}>
                                                            {(debt as any).payment_notes}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-black text-blue-950 uppercase">{debt.supplier_name}</div>
                                                    {debt.description && <div className="text-[8px] text-gray-400 italic font-medium uppercase mt-0.5">{debt.description}</div>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 bg-gray-50 border border-gray-100 rounded-full text-[8px] font-black uppercase tracking-tighter text-gray-500">
                                                        {sangriaCategories.find(c => c.id === debt.category_id)?.name || 'OUTROS'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-400 uppercase">
                                                    {debt.installment_number} / {debt.total_installments}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-purple-700 font-black text-sm italic">{formatCurrency(debt.installment_amount)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter border ${statusColors}`}>
                                                        {statusLabels}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {debt.status !== 'paid' ? (
                                                            <button 
                                                                onClick={() => handleOpenPayModal(debt)}
                                                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                                title="Marcar como Pago"
                                                            >
                                                                 <CheckCircle2 size={16} />
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => handleUndoPayDebt(debt)}
                                                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                                                title="Desfazer Pagamento"
                                                            >
                                                                <RotateCcw size={16} />
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleEditFutureDebt(debt)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                            title="Editar"
                                                        >
                                                            <PencilLine size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteFutureDebt(debt.id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredFutureDebts.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-20">
                                                    <CheckCircle2 size={48} />
                                                    <p className="font-black uppercase italic tracking-widest">Nenhuma conta encontrada</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeSubTab === 'categorias' && (
                    <div className="p-8 max-w-2xl mx-auto space-y-8">
                        <div className="bg-blue-50 p-8 rounded-[32px] border-2 border-blue-100 space-y-6">
                            <h4 className="text-sm font-black text-blue-900 uppercase italic flex items-center gap-3">
                                <Plus size={20} /> Nova Categoria de Despesa
                            </h4>
                            <div className="flex gap-3">
                                <input 
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    placeholder="EX: ALUGUEL, ENERGIA, MANUTENÇÃO..."
                                    className="flex-1 p-5 bg-white rounded-2xl font-black uppercase text-xs outline-none shadow-inner border-2 border-transparent focus:border-blue-300 transition-all"
                                />
                                <button 
                                    onClick={handleSaveCategory}
                                    disabled={isSubmitting || !newCategoryName.trim()}
                                    className="px-8 bg-blue-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-blue-950 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {sangriaCategories
                                .filter(c => c.store_id === effectiveStoreId)
                                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                                .map(cat => (
                                <div key={cat.id} className="flex justify-between items-center p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                                        <span className="text-[10px] font-black text-blue-950 uppercase italic tracking-tight">{cat.name}</span>
                                    </div>
                                    <button 
                                        onClick={() => onDeleteSangriaCategory(cat.id)}
                                        className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS */}
            <SangriaModal 
                isOpen={showSangriaModal}
                onClose={() => setShowSangriaModal(false)}
                onSubmit={handleAddSangria}
                form={sangriaForm}
                setForm={setSangriaForm}
                date={sangriaDate}
                setDate={setSangriaDate}
                categories={sangriaCategories}
                isSubmitting={isSubmitting}
                onManageCategories={() => { setShowSangriaModal(false); setActiveSubTab('categorias'); }}
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

            <EditSangriaModal 
                isOpen={showEditSangriaModal}
                onClose={() => setShowEditSangriaModal(false)}
                onSubmit={handleSaveEditSangria}
                form={editSangriaForm}
                setForm={setEditSangriaForm}
                categories={sangriaCategories}
                isSubmitting={isSubmitting}
            />

            <EditFutureDebtModal 
                isOpen={showEditFutureDebtModal}
                onClose={() => setShowEditFutureDebtModal(false)}
                form={editDebtForm}
                setForm={setEditDebtForm}
                categories={sangriaCategories}
                isSubmitting={isSubmitting}
                onSubmit={handleSaveEditFutureDebt}
                isPaid={editingDebt?.status === 'paid'}
            />

            <PayFutureDebtModal 
                isOpen={showPayDebtModal}
                onClose={() => setShowPayDebtModal(false)}
                debtInfo={payingDebt ? { supplier_name: payingDebt.supplier_name, installment_amount: Number(payingDebt.installment_amount) } : null}
                form={payDebtForm}
                setForm={setPayDebtForm}
                isSubmitting={isSubmitting}
                onSubmit={handleConfirmPayDebt}
            />
        </div>
    );
};

export default DespesasTab;
