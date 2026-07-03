import React from 'react';
import { X, Save, Loader2, Calendar, DollarSign, Tag, FileText, CheckCircle2 } from 'lucide-react';
import { IceCreamSangriaCategory } from '../../../types';

interface EditFutureDebtModalProps {
    isOpen: boolean;
    onClose: () => void;
    form: {
        supplier_name: string;
        installment_amount: string;
        due_date: string;
        categoryId: string;
        description: string;
        payment_date: string;
        payment_method: string;
    };
    setForm: React.Dispatch<React.SetStateAction<any>>;
    categories: IceCreamSangriaCategory[];
    isSubmitting: boolean;
    onSubmit: () => Promise<void>;
    isPaid?: boolean;
}

const EditFutureDebtModal: React.FC<EditFutureDebtModalProps> = ({
    isOpen, onClose, form, setForm, categories, isSubmitting, onSubmit, isPaid
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden border-t-8 border-purple-600 animate-in zoom-in duration-300">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-black uppercase italic text-purple-950 flex items-center gap-3">
                        <DollarSign size={20} className="text-purple-600" /> Editar <span className="text-purple-600">Conta</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600 transition-colors" id="btn-close-edit-debt">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                            <Tag size={12} /> Fornecedor / Credor
                        </label>
                        <input
                            id="edit-debt-supplier"
                            value={form.supplier_name}
                            onChange={e => setForm({ ...form, supplier_name: e.target.value.toUpperCase() })}
                            className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-xs outline-none focus:ring-4 focus:ring-purple-500/20 uppercase"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                                <DollarSign size={12} /> Valor da Parcela
                            </label>
                            <input
                                id="edit-debt-amount"
                                value={form.installment_amount}
                                onChange={e => setForm({ ...form, installment_amount: e.target.value })}
                                placeholder="0,00"
                                className="w-full p-4 bg-gray-950 text-white border-none rounded-[20px] font-black text-lg text-center outline-none focus:ring-4 focus:ring-purple-500/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                                <Calendar size={12} /> Vencimento
                            </label>
                            <input
                                id="edit-debt-due-date"
                                type="date"
                                value={form.due_date}
                                onChange={e => setForm({ ...form, due_date: e.target.value })}
                                className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-xs outline-none focus:ring-4 focus:ring-purple-500/20"
                            />
                        </div>
                    </div>

                    {isPaid && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 space-y-4">
                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 size={14} /> Dados do pagamento
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Data do Pagamento</label>
                                    <input
                                        type="date"
                                        value={form.payment_date}
                                        onChange={e => setForm({ ...form, payment_date: e.target.value })}
                                        className="w-full p-3 bg-white border-none rounded-[16px] font-black text-xs outline-none focus:ring-4 focus:ring-emerald-500/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Forma de Pagamento</label>
                                    <select
                                        value={form.payment_method}
                                        onChange={e => setForm({ ...form, payment_method: e.target.value })}
                                        className="w-full p-3 bg-white border-none rounded-[16px] font-black text-xs outline-none focus:ring-4 focus:ring-emerald-500/20"
                                    >
                                        <option value="">Selecione...</option>
                                        {['PIX', 'DINHEIRO', 'CARTÃO', 'TRANSFERÊNCIA', 'BOLETO'].map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                            <Tag size={12} /> Categoria
                        </label>
                        <select
                            id="edit-debt-category"
                            value={form.categoryId}
                            onChange={e => setForm({ ...form, categoryId: e.target.value })}
                            className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-xs outline-none focus:ring-4 focus:ring-purple-500/20"
                        >
                            <option value="">SELECIONE...</option>
                            {[...categories].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                            <FileText size={12} /> Observações
                        </label>
                        <textarea
                            id="edit-debt-description"
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value.toUpperCase() })}
                            rows={3}
                            className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-xs outline-none focus:ring-4 focus:ring-purple-500/20 uppercase resize-none"
                        />
                    </div>

                    <button
                        id="edit-debt-submit"
                        onClick={onSubmit}
                        disabled={isSubmitting || !form.supplier_name || !form.installment_amount}
                        className="w-full py-5 bg-purple-600 text-white rounded-[25px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-purple-800 flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        SALVAR ALTERAÇÕES
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditFutureDebtModal;
