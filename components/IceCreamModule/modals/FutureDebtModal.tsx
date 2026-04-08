import React, { useMemo } from 'react';
import { X, Plus, Loader2, Calendar, DollarSign, Tag, FileText } from 'lucide-react';
import { formatCurrency } from '../../../constants';
import { IceCreamSangriaCategory } from '../../../types';

interface FutureDebtModalProps {
    isOpen: boolean;
    onClose: () => void;
    form: {
        supplier_name: string;
        total_amount: string;
        total_installments: string;
        first_due_date: string;
        categoryId: string;
        description: string;
    };
    setForm: React.Dispatch<React.SetStateAction<any>>;
    categories: IceCreamSangriaCategory[];
    isSubmitting: boolean;
    onSubmit: () => Promise<void>;
}

const FutureDebtModal: React.FC<FutureDebtModalProps> = ({
    isOpen,
    onClose,
    form,
    setForm,
    categories,
    isSubmitting,
    onSubmit
}) => {
    const installmentValue = useMemo(() => {
        const total = parseFloat(form.total_amount.replace(',', '.')) || 0;
        const count = parseInt(form.total_installments) || 1;
        return total / count;
    }, [form.total_amount, form.total_installments]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden border-t-8 border-purple-600 animate-in zoom-in duration-300">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-black uppercase italic text-purple-950 flex items-center gap-3">
                        <DollarSign size={20} className="text-purple-600" /> Lançar <span className="text-purple-600">Dívida Parcelada</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
                    <div className="grid grid-cols-1 gap-6">
                        {/* Fornecedor */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                                <Tag size={12} /> Fornecedor / Credor
                            </label>
                            <input
                                required
                                value={form.supplier_name}
                                onChange={e => setForm({ ...form, supplier_name: e.target.value.toUpperCase() })}
                                placeholder="EX: DISTRIBUIDORA DE EMBALAGENS"
                                className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-xs outline-none focus:ring-4 focus:ring-purple-500/20 uppercase"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Valor Total */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                                    <DollarSign size={12} /> Valor Total
                                </label>
                                <input
                                    required
                                    value={form.total_amount}
                                    onChange={e => setForm({ ...form, total_amount: e.target.value })}
                                    placeholder="0,00"
                                    className="w-full p-4 bg-gray-950 text-white border-none rounded-[20px] font-black text-lg text-center outline-none focus:ring-4 focus:ring-purple-500/20"
                                />
                            </div>

                            {/* Parcelas */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                                    <FileText size={12} /> N° Parcelas
                                </label>
                                <select
                                    value={form.total_installments}
                                    onChange={e => setForm({ ...form, total_installments: e.target.value })}
                                    className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-lg outline-none focus:ring-4 focus:ring-purple-500/20"
                                >
                                    {[...Array(12)].map((_, i) => (
                                        <option key={i + 1} value={i + 1}>{i + 1}x</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Preview Parcelas */}
                        {parseFloat(form.total_amount) > 0 && (
                            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 flex items-center justify-between">
                                <span className="text-[10px] font-black text-purple-900 uppercase">Resumo do Parcelamento:</span>
                                <span className="text-sm font-black text-purple-600 italic">
                                    {form.total_installments}x de {formatCurrency(installmentValue)}
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {/* Primeiro Vencimento */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                                    <Calendar size={12} /> 1° Vencimento
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={form.first_due_date}
                                    onChange={e => setForm({ ...form, first_due_date: e.target.value })}
                                    className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-xs outline-none focus:ring-4 focus:ring-purple-500/20"
                                />
                            </div>

                            {/* Categoria */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                                    <Tag size={12} /> Categoria
                                </label>
                                <select
                                    required
                                    value={form.categoryId}
                                    onChange={e => setForm({ ...form, categoryId: e.target.value })}
                                    className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-xs outline-none focus:ring-4 focus:ring-purple-500/20"
                                >
                                    <option value="">SELECIONE...</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Descrição */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                                <FileText size={12} /> Observações (Opcional)
                            </label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value.toUpperCase() })}
                                placeholder="DETALHES ADICIONAIS..."
                                rows={3}
                                className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-xs outline-none focus:ring-4 focus:ring-purple-500/20 uppercase resize-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={onSubmit}
                        disabled={isSubmitting || !form.supplier_name || !form.total_amount || !form.categoryId}
                        className="w-full py-5 bg-purple-600 text-white rounded-[25px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-purple-800 flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        CONFIRMAR LANÇAMENTO
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FutureDebtModal;
