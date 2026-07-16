import React, { useState } from 'react';
import { X, Truck, Loader2, Save } from 'lucide-react';
import { IceCreamStock } from '../../../types';

interface PurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: any, stockId?: string) => Promise<void>;
    filteredStock: IceCreamStock[];
    effectiveStoreId: string;
    fetchData?: () => Promise<void>;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({
    isOpen,
    onClose,
    onUpdateStock,
    filteredStock,
    effectiveStoreId,
    fetchData
}) => {
    const [purchaseForm, setPurchaseForm] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const updates = Object.entries(purchaseForm)
                .filter(([_, val]) => val && parseFloat(val.replace(',', '.')) > 0)
                .map(([stockId, val]) => {
                    const st = filteredStock.find(s => s.stock_id === stockId);
                    if (!st) return Promise.resolve();
                    return onUpdateStock(effectiveStoreId, st.product_base, parseFloat(val.replace(',', '.')), st.unit, 'purchase', stockId);
                });
            
            if (updates.length > 0) {
                await Promise.all(updates);
                if (fetchData) await fetchData();
                alert("Compras lançadas com sucesso!");
                onClose();
                setPurchaseForm({});
            }
        } catch (e: any) {
            alert("Erro ao lançar compras: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 flex flex-col overflow-hidden">
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                        <Truck className="text-blue-600" /> Lançar <span className="text-blue-600">Compras</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-10 space-y-4 no-scrollbar">
                    {filteredStock.map(s => (
                        <div key={s.stock_id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-blue-950 uppercase italic leading-none">{s.product_base}</p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">Atual: {s.stock_current} {s.unit}</p>
                            </div>
                            <div className="w-32 relative">
                                <input 
                                    value={purchaseForm[s.stock_id] || ''} 
                                    onChange={e => setPurchaseForm({...purchaseForm, [s.stock_id]: e.target.value})} 
                                    className="w-full p-3 bg-white border border-blue-100 rounded-xl font-black text-blue-900 text-center text-sm outline-none focus:ring-4 focus:ring-blue-50" 
                                    placeholder="0" 
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-blue-300 uppercase">{s.unit}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-10 border-t bg-gray-50 flex justify-center shrink-0">
                    <button 
                        onClick={handleSave} 
                        disabled={isSubmitting} 
                        className="w-full py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-950 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR COMPRAS
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseModal;
