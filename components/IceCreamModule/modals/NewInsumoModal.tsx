import React, { useState } from 'react';
import { X, Plus, Loader2, Save } from 'lucide-react';

interface NewInsumoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (base: string, unit: string, storeId: string) => Promise<void>;
    effectiveStoreId: string;
    fetchData?: () => Promise<void>;
}

const NewInsumoModal: React.FC<NewInsumoModalProps> = ({
    isOpen,
    onClose,
    onAdd,
    effectiveStoreId,
    fetchData
}) => {
    const [newInsumo, setNewInsumo] = useState({ name: '', unit: 'un', initial: '0' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!newInsumo.name) return;
        setIsSubmitting(true);
        try {
            await onAdd(newInsumo.name.toUpperCase(), newInsumo.unit, effectiveStoreId);
            if (fetchData) await fetchData();
            onClose();
            setNewInsumo({ name: '', unit: 'un', initial: '0' });
        } catch (e: any) {
            alert("Erro: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-orange-500 overflow-hidden">
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                        <Plus className="text-orange-600" /> Novo <span className="text-orange-600">Insumo</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                </div>
                <div className="p-10 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Nome do Insumo (EX: COPO 300ML)</label>
                        <input 
                            value={newInsumo.name} 
                            onChange={e => setNewInsumo({...newInsumo, name: e.target.value})} 
                            className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 uppercase shadow-inner outline-none" 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Unidade</label>
                            <select 
                                value={newInsumo.unit} 
                                onChange={e => setNewInsumo({...newInsumo, unit: e.target.value})} 
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black text-slate-900 outline-none"
                            >
                                <option value="un">un</option>
                                <option value="kg">kg</option>
                                <option value="ml">ml</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Qtd Inicial</label>
                            <input 
                                value={newInsumo.initial} 
                                onChange={e => setNewInsumo({...newInsumo, initial: e.target.value})} 
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black text-center outline-none" 
                                placeholder="0" 
                            />
                        </div>
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={isSubmitting || !newInsumo.name} 
                        className="w-full py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR INSUMO
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewInsumoModal;
