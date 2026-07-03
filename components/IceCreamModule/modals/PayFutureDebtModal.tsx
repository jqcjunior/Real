import React from 'react';
import { X, CheckCircle2, Loader2, Calendar, FileText, Wallet, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../../constants';

interface PayFutureDebtModalProps {
    isOpen: boolean;
    onClose: () => void;
    debtInfo: { supplier_name: string; installment_amount: number } | null;
    form: { payment_date: string; payment_method: string; payment_notes: string; paid_amount: string };
    setForm: React.Dispatch<React.SetStateAction<any>>;
    isSubmitting: boolean;
    onSubmit: () => Promise<void>;
}

const PAYMENT_METHODS = ['PIX', 'DINHEIRO', 'CARTÃO', 'TRANSFERÊNCIA', 'BOLETO'];

const PayFutureDebtModal: React.FC<PayFutureDebtModalProps> = ({
    isOpen, onClose, debtInfo, form, setForm, isSubmitting, onSubmit
}) => {
    if (!isOpen || !debtInfo) return null;

    const paidAmountNum = parseFloat(form.paid_amount.replace(',', '.')) || 0;
    const diff = paidAmountNum - debtInfo.installment_amount;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden border-t-8 border-green-600 animate-in zoom-in duration-300">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-black uppercase italic text-green-950 flex items-center gap-3">
                        <CheckCircle2 size={20} className="text-green-600" /> Confirmar <span className="text-green-600">Pagamento</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="bg-green-50 p-5 rounded-2xl border border-green-100">
                        <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Fornecedor</p>
                        <p className="text-sm font-black text-blue-950 uppercase truncate mb-3">{debtInfo.supplier_name}</p>
                        <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Valor da Parcela</p>
                        <p className="text-lg font-black text-green-700 italic">{formatCurrency(debtInfo.installment_amount)}</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                            <DollarSign size={12} /> Valor Pago
                        </label>
                        <input
                            value={form.paid_amount}
                            onChange={e => setForm({ ...form, paid_amount: e.target.value })}
                            placeholder="0,00"
                            className="w-full p-4 bg-gray-950 text-white border-none rounded-[20px] font-black text-lg text-center outline-none focus:ring-4 focus:ring-green-500/20"
                        />
                        {diff !== 0 && paidAmountNum > 0 && (
                            <p className={`text-[9px] font-black uppercase ml-2 ${diff < 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                                {diff < 0 ? `Desconto de ${formatCurrency(Math.abs(diff))}` : `A mais: ${formatCurrency(diff)}`}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                            <Calendar size={12} /> Data do Pagamento
                        </label>
                        <input
                            type="date"
                            value={form.payment_date}
                            onChange={e => setForm({ ...form, payment_date: e.target.value })}
                            className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-xs outline-none focus:ring-4 focus:ring-green-500/20"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                            <Wallet size={12} /> Forma de Pagamento <span className="normal-case font-medium text-gray-400">(opcional)</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {PAYMENT_METHODS.map(method => (
                                <button
                                    key={method}
                                    type="button"
                                    onClick={() => setForm({ ...form, payment_method: form.payment_method === method ? '' : method })}
                                    className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${
                                        form.payment_method === method
                                            ? 'bg-green-600 text-white shadow-md'
                                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                    }`}
                                >
                                    {method}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2">
                            <FileText size={12} /> Descrição <span className="normal-case font-medium text-gray-400">(opcional)</span>
                        </label>
                        <textarea
                            value={form.payment_notes}
                            onChange={e => setForm({ ...form, payment_notes: e.target.value.toUpperCase() })}
                            placeholder="EX: PAGO COM DESCONTO, PAGAMENTO PARCIAL..."
                            rows={2}
                            className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-xs outline-none focus:ring-4 focus:ring-green-500/20 uppercase resize-none"
                        />
                    </div>

                    <button
                        onClick={onSubmit}
                        disabled={isSubmitting || !form.payment_date || !form.paid_amount}
                        className="w-full py-5 bg-green-600 text-white rounded-[25px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-green-800 flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                        CONFIRMAR PAGAMENTO
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PayFutureDebtModal;
