import React, { useState, useEffect, useMemo } from 'react';
import { X, PencilLine, Loader2, Save } from 'lucide-react';
import { IceCreamStock } from '../../../types';

interface InventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: any, stockId?: string) => Promise<void>;
    filteredStock: IceCreamStock[];
    effectiveStoreId: string;
    fetchData?: () => Promise<void>;
    initialInventory: Record<string, string>;
}

const InventoryModal: React.FC<InventoryModalProps> = ({
    isOpen,
    onClose,
    onUpdateStock,
    filteredStock,
    effectiveStoreId,
    fetchData,
    initialInventory
}) => {
    const [inventoryForm, setInventoryForm] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Ordem alfabética para os insumos
    const sortedStock = useMemo(() => {
        return [...filteredStock].sort((a, b) => 
            a.product_base.localeCompare(b.product_base, 'pt-BR')
        );
    }, [filteredStock]);

    useEffect(() => {
        if (isOpen) {
            setInventoryForm(initialInventory);
        }
    }, [isOpen, initialInventory]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const updates = Object.entries(inventoryForm).map(([stockId, val]) => {
                const st = filteredStock.find(s => s.stock_id === stockId);
                if (!st) return Promise.resolve();
                const newVal = parseFloat(val.replace(',', '.')) || 0;
                const diff = newVal - st.stock_current;
                if (Math.abs(diff) < 0.0001) return Promise.resolve();
                return onUpdateStock(effectiveStoreId, st.product_base, diff, st.unit, 'inventory', stockId);
            });
            
            await Promise.all(updates);
            if (fetchData) await fetchData();
            alert("Inventário atualizado com sucesso!");
            onClose();
        } catch (e: any) {
            alert("Erro ao atualizar inventário: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] shadow-2xl animate-in zoom-in duration-300 border-t-8 border-orange-600 flex flex-col overflow-hidden">
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                        <PencilLine className="text-orange-600" /> Atualizar <span className="text-orange-600">Inventário</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-10 space-y-4 no-scrollbar">
                    {sortedStock.map(s => (
                        <div key={s.stock_id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-blue-950 uppercase italic leading-none">{s.product_base}</p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">Atual em Banco: {s.stock_current} {s.unit}</p>
                            </div>
                            <div className="w-32 relative">
                                <input 
                                    value={inventoryForm[s.stock_id] || ''} 
                                    onChange={e => setInventoryForm({...inventoryForm, [s.stock_id]: e.target.value})} 
                                    className="w-full p-3 bg-white border border-orange-100 rounded-xl font-black text-orange-700 text-center text-sm outline-none focus:ring-4 focus:ring-orange-50" 
                                    placeholder="0" 
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-orange-300 uppercase">{s.unit}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-10 border-t bg-gray-50 flex justify-center shrink-0">
                    <button 
                        onClick={handleSave} 
                        disabled={isSubmitting} 
                        className="w-full py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR INVENTÁRIO
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InventoryModal;
