import React, { useState, useMemo } from 'react';
import { User, IceCreamDailySale, IceCreamTransaction, CashRegisterClosure, Receipt, CashError } from '../types';
import { formatCurrency } from '../constants';
import { 
    DollarSign, Save, Calendar, FileText, CreditCard, AlertTriangle, 
    Plus, Trash2, Search, TrendingUp, TrendingDown, Printer 
} from 'lucide-react';

interface CashRegisterModuleProps {
    user: User;
    sales: IceCreamDailySale[];
    finances: IceCreamTransaction[];
    closures: CashRegisterClosure[];
    receipts: Receipt[]; // Novo
    errors: CashError[]; // Novo
    onAddClosure: (closure: any) => Promise<void>;
    onAddReceipt: (receipt: any) => Promise<void>; // Novo
    onAddError: (error: any) => Promise<void>; // Novo
    onDeleteError: (id: string) => Promise<void>; // Novo
}

const CashRegisterModule: React.FC<CashRegisterModuleProps> = ({ 
    user, sales, finances, closures, receipts, errors, 
    onAddClosure, onAddReceipt, onAddError, onDeleteError 
}) => {
    const [activeTab, setActiveTab] = useState<'caixa' | 'recibos' | 'cartoes' | 'quebras'>('caixa');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- STATES PARA RECIBOS ---
    const [receiptForm, setReceiptForm] = useState({ issuer: '', payer: '', recipient: '', value: '', valueInWords: '', reference: '' });

    // --- STATES PARA QUEBRAS ---
    const [errorForm, setErrorForm] = useState({ value: '', reason: '', type: 'lack' });

    // --- CÁLCULOS DO CAIXA DO DIA ---
    const dailyStats = useMemo(() => {
        const daySales = sales.filter(s => s.createdAt?.startsWith(selectedDate) && s.status !== 'canceled' && s.storeId === user.storeId);
        const dayFinances = finances.filter(f => f.date === selectedDate && f.storeId === user.storeId);
        
        const totalSales = daySales.reduce((acc, curr) => acc + Number(curr.total_value), 0);
        
        // Entradas manuais no financeiro (suprimentos)
        const totalEntries = dayFinances.filter(f => f.type === 'entry').reduce((acc, curr) => acc + Number(curr.value), 0);
        
        // Saídas (sangrias/despesas)
        const totalExits = dayFinances.filter(f => f.type === 'exit').reduce((acc, curr) => acc + Number(curr.value), 0);

        // Dinheiro em espécie (aproximado)
        const moneySales = daySales.filter(s => s.payment_method === 'Dinheiro').reduce((acc, curr) => acc + Number(curr.total_value), 0);

        return { totalSales, totalEntries, totalExits, moneySales, finalBalance: (moneySales + totalEntries) - totalExits };
    }, [sales, finances, selectedDate, user.storeId]);

    // --- CÁLCULOS DE CARTÕES ---
    const cardStats = useMemo(() => {
        // Pega vendas do mês atual
        const currentMonth = selectedDate.substring(0, 7); 
        const monthSales = sales.filter(s => s.createdAt?.startsWith(currentMonth) && s.status !== 'canceled' && s.storeId === user.storeId);
        
        const credit = monthSales.filter(s => s.payment_method === 'Cartão' || s.payment_method === 'Crédito').reduce((acc, s) => acc + Number(s.total_value), 0);
        const debit = monthSales.filter(s => s.payment_method === 'Débito').reduce((acc, s) => acc + Number(s.total_value), 0);
        const pix = monthSales.filter(s => s.payment_method === 'Pix').reduce((acc, s) => acc + Number(s.total_value), 0);

        return { credit, debit, pix, total: credit + debit + pix };
    }, [sales, selectedDate, user.storeId]);

    // --- HANDLERS ---
    const handleCloseRegister = async () => {
        setIsSubmitting(true);
        try {
            await onAddClosure({
                storeId: user.storeId,
                date: selectedDate,
                totalSales: dailyStats.totalSales,
                totalExpenses: dailyStats.totalExits,
                balance: dailyStats.finalBalance,
                notes: `Fechamento realizado por ${user.name}`
            });
            alert("Caixa fechado com sucesso!");
        } catch (e) { alert("Erro ao fechar caixa."); }
        finally { setIsSubmitting(false); }
    };

    const handleSaveReceipt = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onAddReceipt({
                ...receiptForm,
                storeId: user.storeId,
                date: selectedDate,
                value: parseFloat(receiptForm.value.replace(',', '.'))
            });
            setReceiptForm({ issuer: '', payer: '', recipient: '', value: '', valueInWords: '', reference: '' });
            alert("Recibo gerado!");
        } catch (error) { alert("Erro ao salvar recibo."); }
        finally { setIsSubmitting(false); }
    };

    const handleSaveError = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onAddError({
                storeId: user.storeId,
                userId: user.id,
                date: selectedDate,
                value: parseFloat(errorForm.value.replace(',', '.')),
                type: errorForm.type,
                reason: errorForm.reason
            });
            setErrorForm({ value: '', reason: '', type: 'lack' });
            alert("Quebra registrada!");
        } catch (error) { alert("Erro ao registrar quebra."); }
        finally { setIsSubmitting(false); }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* TOP BAR COM ABAS */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-600 text-white rounded-lg shadow-lg">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-800 uppercase italic tracking-tighter">Gestão de Caixa</h1>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Financeiro Operacional</p>
                    </div>
                </div>
                
                {/* MENU DE ABAS (Igual Gelateria) */}
                <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto">
                    {[
                        { id: 'caixa', label: 'Fluxo Diário', icon: DollarSign },
                        { id: 'recibos', label: 'Recibos', icon: FileText },
                        { id: 'cartoes', label: 'Cartões', icon: CreditCard },
                        { id: 'quebras', label: 'Quebra de Caixa', icon: AlertTriangle },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                                activeTab === tab.id 
                                ? 'bg-white text-green-700 shadow-sm' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <tab.icon size={14} /> {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border">
                    <Calendar size={16} className="text-gray-400 ml-2" />
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)} 
                        className="bg-transparent border-none text-xs font-bold text-gray-700 outline-none p-1"
                    />
                </div>
            </div>

            {/* CONTEÚDO */}
            <div className="flex-1 overflow-y-auto p-6">
                
                {/* ABA 1: CAIXA DIÁRIO (Fluxo) */}
                {activeTab === 'caixa' && (
                    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendas Totais</p>
                                <p className="text-2xl font-black text-blue-900 mt-2">{formatCurrency(dailyStats.totalSales)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Entradas (Suprimento)</p>
                                <p className="text-2xl font-black text-green-600 mt-2">+ {formatCurrency(dailyStats.totalEntries)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saídas (Sangrias)</p>
                                <p className="text-2xl font-black text-red-600 mt-2">- {formatCurrency(dailyStats.totalExits)}</p>
                            </div>
                            <div className="bg-gray-900 p-6 rounded-2xl shadow-lg text-white">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo em Gaveta (Est.)</p>
                                <p className="text-2xl font-black text-green-400 mt-2">{formatCurrency(dailyStats.finalBalance)}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700">Histórico de Fechamentos</h3>
                                <button onClick={handleCloseRegister} disabled={isSubmitting} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-green-700 transition-all flex items-center gap-2">
                                    <Save size={14}/> Fechar Caixa Hoje
                                </button>
                            </div>
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 text-gray-400 uppercase font-black">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Responsável</th>
                                        <th className="px-6 py-4 text-right">Saldo Final</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {closures.filter(c => c.storeId === user.storeId).map(c => (
                                        <tr key={c.id}>
                                            <td className="px-6 py-4 font-bold text-gray-700">{new Date(c.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-gray-500">{c.closedBy}</td>
                                            <td className="px-6 py-4 text-right font-black text-green-600">{formatCurrency(c.balance)}</td>
                                        </tr>
                                    ))}
                                    {closures.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400 italic">Nenhum fechamento registrado</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ABA 2: RECIBOS */}
                {activeTab === 'recibos' && (
                    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4">
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <FileText size={16} /> Emitir Novo Recibo
                            </h3>
                            <form onSubmit={handleSaveReceipt} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Emitente</label>
                                        <input required value={receiptForm.issuer} onChange={e => setReceiptForm({...receiptForm, issuer: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-green-100" placeholder="Sua Empresa / Nome" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Pagador</label>
                                        <input required value={receiptForm.payer} onChange={e => setReceiptForm({...receiptForm, payer: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-green-100" placeholder="Nome do Cliente" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Valor (R$)</label>
                                        <input required value={receiptForm.value} onChange={e => setReceiptForm({...receiptForm, value: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-green-100" placeholder="0,00" />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Valor por Extenso</label>
                                        <input required value={receiptForm.valueInWords} onChange={e => setReceiptForm({...receiptForm, valueInWords: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-green-100" placeholder="Ex: Duzentos reais" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Referente à</label>
                                    <input required value={receiptForm.reference} onChange={e => setReceiptForm({...receiptForm, reference: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-green-100" placeholder="Ex: Pagamento de serviços..." />
                                </div>
                                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-gray-900 text-white rounded-xl font-black uppercase text-xs shadow-lg hover:bg-black transition-all">
                                    Gerar e Salvar Recibo
                                </button>
                            </form>
                        </div>

                        <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 text-gray-400 uppercase font-black">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Pagador</th>
                                        <th className="px-6 py-4">Ref.</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                        <th className="px-6 py-4 text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {receipts.filter(r => r.storeId === user.storeId).map(r => (
                                        <tr key={r.id}>
                                            <td className="px-6 py-4 font-bold text-gray-700">{new Date(r.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-gray-500 uppercase">{r.payer}</td>
                                            <td className="px-6 py-4 text-gray-400 italic">{r.reference}</td>
                                            <td className="px-6 py-4 text-right font-black text-green-600">{formatCurrency(r.value)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button className="text-blue-500 hover:text-blue-700"><Printer size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ABA 3: CARTÕES (Resumo) */}
                {activeTab === 'cartoes' && (
                    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4">
                        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden">
                            <CreditCard className="absolute right-[-20px] bottom-[-20px] opacity-10" size={200} />
                            <h3 className="text-lg font-black uppercase italic tracking-widest mb-1">Movimento de Cartões</h3>
                            <p className="text-blue-200 text-xs font-bold uppercase mb-8">Acumulado do Mês (PDV)</p>
                            
                            <div className="grid grid-cols-3 gap-8 relative z-10">
                                <div>
                                    <p className="text-[10px] font-bold text-blue-300 uppercase">Crédito</p>
                                    <p className="text-2xl font-black">{formatCurrency(cardStats.credit)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-blue-300 uppercase">Débito</p>
                                    <p className="text-2xl font-black">{formatCurrency(cardStats.debit)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-blue-300 uppercase">Pix</p>
                                    <p className="text-2xl font-black text-green-400">{formatCurrency(cardStats.pix)}</p>
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-blue-700/50 flex justify-between items-center">
                                <span className="text-xs font-bold text-blue-200 uppercase">Total Geral</span>
                                <span className="text-3xl font-black">{formatCurrency(cardStats.total)}</span>
                            </div>
                        </div>
                        
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 text-center">
                            <p className="text-gray-400 text-xs uppercase font-bold italic">
                                * Os valores acima são calculados automaticamente com base nas vendas registradas no PDV.
                                <br/>Para conciliação bancária detalhada, utilize o relatório DRE.
                            </p>
                        </div>
                    </div>
                )}

                {/* ABA 4: QUEBRAS DE CAIXA */}
                {activeTab === 'quebras' && (
                    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4">
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 border-l-4 border-l-red-500">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-500" /> Registrar Divergência
                            </h3>
                            <form onSubmit={handleSaveError} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Tipo</label>
                                    <select value={errorForm.type} onChange={e => setErrorForm({...errorForm, type: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none">
                                        <option value="lack">Falta (Quebra)</option>
                                        <option value="surplus">Sobra</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Valor (R$)</label>
                                    <input required value={errorForm.value} onChange={e => setErrorForm({...errorForm, value: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none" placeholder="0,00" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Justificativa</label>
                                    <div className="flex gap-2">
                                        <input required value={errorForm.reason} onChange={e => setErrorForm({...errorForm, reason: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none" placeholder="Motivo..." />
                                        <button type="submit" disabled={isSubmitting} className="p-3 bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 transition-all"><Plus size={20}/></button>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 text-gray-400 uppercase font-black">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Tipo</th>
                                        <th className="px-6 py-4">Motivo</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                        <th className="px-6 py-4 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {errors.filter(e => e.storeId === user.storeId).map(err => (
                                        <tr key={err.id}>
                                            <td className="px-6 py-4 font-bold text-gray-700">{new Date(err.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] uppercase font-black ${err.type === 'lack' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {err.type === 'lack' ? 'Falta' : 'Sobra'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 uppercase italic">{err.reason}</td>
                                            <td className={`px-6 py-4 text-right font-black ${err.type === 'lack' ? 'text-red-600' : 'text-blue-600'}`}>{formatCurrency(err.value)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => onDeleteError(err.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CashRegisterModule;
