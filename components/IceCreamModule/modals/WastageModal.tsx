import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, Loader2, Trash } from 'lucide-react';
import { IceCreamStock, User } from '../../../types';
import { supabase } from '../../../services/supabaseClient';

interface WastageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: any, stockId?: string) => Promise<void>;
    filteredStock: IceCreamStock[];
    effectiveStoreId: string;
    fetchData?: () => Promise<void>;
    user: User;
}

const WastageModal: React.FC<WastageModalProps> = ({
    isOpen,
    onClose,
    onUpdateStock,
    filteredStock,
    effectiveStoreId,
    fetchData,
    user
}) => {
    const [wastageForm, setWastageForm] = useState({ stockId: '', quantity: '', reason: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Ordem alfabética para os insumos
    const sortedStock = useMemo(() => {
        return [...filteredStock].sort((a, b) => 
            a.product_base.localeCompare(b.product_base, 'pt-BR')
        );
    }, [filteredStock]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!wastageForm.stockId || !wastageForm.quantity) return;
        setIsSubmitting(true);
        try {
            const st = filteredStock.find(s => s.stock_id === wastageForm.stockId);
            if (!st) throw new Error("Insumo não encontrado");

            const qty = parseFloat(wastageForm.quantity.replace(',', '.'));

            // 1. Log especificamente na tabela ice_cream_wastage
            const { error: wastageError } = await supabase.from('ice_cream_wastage').insert([{
                store_id: effectiveStoreId,
                stock_base_name: st.product_base,
                quantity: qty,
                reason: wastageForm.reason || null,
                created_by: user.name
            }]);

            if (wastageError) throw wastageError;

            // 2. Atualiza estoque
            await onUpdateStock(
                effectiveStoreId, 
                st.product_base, 
                -Math.abs(qty), 
                st.unit, 
                'wastage', 
                wastageForm.stockId
            );
            
            if (fetchData) await fetchData();
            alert("Baixa de avaria realizada com sucesso!");
            onClose();
            setWastageForm({ stockId: '', quantity: '', reason: '' });
        } catch (e: any) {
            console.error("Erro ao realizar baixa:", e);
            alert("Erro ao realizar baixa: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-orange-500 overflow-hidden">
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                        <AlertTriangle className="text-orange-500" /> Baixa <span className="text-orange-600">por Avaria</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                </div>
                <div className="p-10 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Insumo do Estoque</label>
                        <select 
                            value={wastageForm.stockId} 
                            onChange={e => setWastageForm({...wastageForm, stockId: e.target.value})} 
                            className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase outline-none shadow-inner border border-gray-100"
                        >
                            <option value="">SELECIONE O INSUMO...</option>
                            {sortedStock.map(s => (
                                <option key={s.stock_id} value={s.stock_id}>
                                    {s.product_base} (Disponível: {s.stock_current} {s.unit})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Quantidade Perdida</label>
                        <input 
                            value={wastageForm.quantity} 
                            onChange={e => setWastageForm({...wastageForm, quantity: e.target.value})} 
                            className="w-full p-4 bg-gray-50 rounded-2xl font-black text-center text-xl outline-none shadow-inner border border-orange-100" 
                            placeholder="0,00" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Justificativa / Motivo</label>
                        <textarea 
                            value={wastageForm.reason} 
                            onChange={e => setWastageForm({...wastageForm, reason: e.target.value.toUpperCase()})} 
                            className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-[10px] shadow-inner outline-none border border-gray-100 h-24 resize-none"
                            placeholder="DESCREVA O MOTIVO..."
                        />
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={isSubmitting || !wastageForm.stockId || !wastageForm.quantity} 
                        className="w-full py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Trash size={18}/>} EFETIVAR BAIXA
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WastageModal;
