import React, { useState, useMemo } from 'react';
import { 
    DollarSign, Calendar, Plus, Filter, Search, 
    TrendingDown, Clock, Settings, Trash2, PencilLine, 
    CheckCircle2, Printer, ChevronDown, ChevronUp, AlertCircle
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
import CategoryManager from '../modals/CategoryManager';
import { printSangriasReport } from '../services/printService';

interface DespesasTabProps {
    sangrias: IceCreamSangria[];
    futureDebts: IceCreamFutureDebt[];
    sangriaCategories: IceCreamSangriaCategory[];
    onAddSangria: (sangria: any) => Promise<void>;
    onAddFutureDebt: (debt: any) => Promise<void>;
    onPayFutureDebt: (debtId: string) => Promise<void>;
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
    const [activeSubTab, setActiveSubTab] = useState<'sangrias' | 'dividas' | 'categorias'>('sangrias');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modals State
    const [showSangriaModal, setShowSangriaModal] = useState(false);
    const [showFutureDebtModal, setShowFutureDebtModal] = useState(false);
    const [showEditSangriaModal, setShowEditSangriaModal] = useState(false);
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

    const filteredFutureDebts = useMemo(() => {
        return futureDebts.filter(d => d.store_id === effectiveStoreId && d.status !== 'paid')
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    }, [futureDebts, effectiveStoreId]);

    // Totals
    const totalSangriasMonth = useMemo(() => filteredSangrias.reduce((acc, s) => acc + Number(s.amount), 0), [filteredSangrias]);
    const totalFutureDebts = useMemo(() => filteredFutureDebts.reduce((acc, d) => acc + Number(d.installment_amount), 0), [filteredFutureDebts]);

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

                <div className="grid grid-cols-2 md:flex gap-3 w-full md:w-auto">
                    <button 
                        onClick={handlePrint}
                        className="px-4 md:px-6 py-3 md:py-4 bg-gray-900 text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs shadow-lg shadow-gray-100 hover:bg-gray-800 transition-all flex items-center justify-center gap-2 border-b-4 border-gray-700 active:scale-95"
                    >
                        <Printer size={16} /> <span className="truncate">Relatório</span>
                    </button>
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
                        <Clock size={16} /> <span className="truncate">Lançar Despesa</span>
                    </button>
                </div>
            </div>

            {/* CARDS DE RESUMO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[40px] border-2 border-red-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingDown size={80} />
                    </div>
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block mb-4">Sangrias do Mês</span>
                    <h3 className="text-4xl font-black text-red-700 italic">{formatCurrency(totalSangriasMonth)}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">Total de saídas avulsas</p>
                </div>

                <div className="bg-white p-8 rounded-[40px] border-2 border-purple-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Clock size={80} />
                    </div>
                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest block mb-4">Débitos Futuros</span>
                    <h3 className="text-4xl font-black text-purple-700 italic">{formatCurrency(totalFutureDebts)}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">Parcelas a vencer</p>
                </div>

                <div className="bg-blue-950 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <DollarSign size={80} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-4">Total Despesas</span>
                    <h3 className="text-4xl font-black text-white italic">{formatCurrency(totalSangriasMonth + totalFutureDebts)}</h3>
                    <p className="text-[10px] font-bold text-blue-300/50 uppercase mt-2">Comprometimento mensal</p>
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
                    <Clock size={16} /> Dívidas Parceladas
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
                                className="w-full md:w-auto px-6 py-4 bg-gray-950 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-gray-800 transition-all"
                            >
                                <Printer size={16} /> Imprimir Relatório
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredFutureDebts.map(debt => (
                                <div key={debt.id} className="bg-white rounded-3xl border-2 border-purple-50 p-6 space-y-4 hover:border-purple-200 transition-all group">
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:scale-110 transition-transform">
                                            <Clock size={20} />
                                        </div>
                                        <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[8px] font-black uppercase">
                                            Parc. {debt.installment_number}/{debt.total_installments}
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="font-black text-blue-950 uppercase text-xs truncate">{debt.supplier_name}</h4>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Vence em: {new Date(debt.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div className="pt-4 border-t flex justify-between items-center">
                                        <span className="text-xl font-black text-purple-700 italic">{formatCurrency(debt.installment_amount)}</span>
                                        <button 
                                            onClick={() => onPayFutureDebt(debt.id)}
                                            className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all active:scale-90"
                                            title="Marcar como Pago"
                                        >
                                            <CheckCircle2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {filteredFutureDebts.length === 0 && (
                                <div className="col-span-full py-20 text-center opacity-20">
                                    <CheckCircle2 size={48} className="mx-auto mb-4" />
                                    <p className="font-black uppercase italic tracking-widest">Tudo em dia! Sem dívidas pendentes.</p>
                                </div>
                            )}
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
        </div>
    );
};

export default DespesasTab;
