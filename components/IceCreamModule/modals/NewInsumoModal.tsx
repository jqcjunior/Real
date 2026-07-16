import React, { useState, useEffect } from 'react';
import { X, Package, Loader2, Save, Edit } from 'lucide-react';
 
interface NewInsumoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (base: string, unit: string, storeId: string) => Promise<void>;
    onUpdate?: (id: string, base: string, unit: string) => Promise<void>;
    effectiveStoreId: string;
    fetchData?: () => Promise<void>;
    editingItem?: { id: string; product_base: string; unit: string } | null;
}
 
const UNIDADES = [
    { value: 'kg', label: 'Quilos (kg)' },
    { value: 'g', label: 'Gramas (g)' },
    { value: 'l', label: 'Litros (l)' },
    { value: 'ml', label: 'Mililitros (ml)' },
    { value: 'un', label: 'Unidades' },
    { value: 'bombona', label: 'Bombonas' },
    { value: 'lata', label: 'Latas' },
    { value: 'balde', label: 'Baldes' },
    { value: 'caixa', label: 'Caixas' },
    { value: 'barra', label: 'Barras' },
    { value: 'pacote', label: 'Pacotes' },
    { value: 'pct', label: 'Pacotes (pct)' }
];
 
const NewInsumoModal: React.FC<NewInsumoModalProps> = ({
    isOpen,
    onClose,
    onAdd,
    onUpdate,
    effectiveStoreId,
    fetchData,
    editingItem
}) => {
    const [form, setForm] = useState({ base: '', unit: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEditing = !!editingItem;
 
    useEffect(() => {
        if (editingItem) {
            setForm({
                base: editingItem.product_base,
                unit: editingItem.unit || ''
            });
        } else {
            setForm({ base: '', unit: '' });
        }
    }, [editingItem, isOpen]);
 
    if (!isOpen) return null;
 
    const handleSubmit = async () => {
        if (!form.base.trim() || !form.unit) {
            alert('Preencha todos os campos!');
            return;
        }
 
        setIsSubmitting(true);
        try {
            if (isEditing && editingItem && onUpdate) {
                await onUpdate(editingItem.id, form.base.toUpperCase().trim(), form.unit);
            } else {
                await onAdd(form.base.toUpperCase().trim(), form.unit, effectiveStoreId);
            }
            
            if (fetchData) await fetchData();
            setForm({ base: '', unit: '' });
            onClose();
        } catch (e: any) {
            alert('Erro: ' + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };
 
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[120] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 overflow-hidden">
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                        {isEditing ? <Edit className="text-orange-600" /> : <Package className="text-blue-600" />}
                        {isEditing ? 'Editar' : 'Novo'} <span className="text-blue-600">Insumo</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600">
                        <X size={24}/>
                    </button>
                </div>
 
                <div className="p-10 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                            Nome do Insumo / Base
                        </label>
                        <input
                            value={form.base}
                            onChange={e => setForm({...form, base: e.target.value.toUpperCase()})}
                            className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-sm outline-none shadow-inner border-2 border-transparent focus:border-blue-100 transition-all"
                            placeholder="EX: LEITE CONDENSADO"
                            autoFocus
                        />
                    </div>
 
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                            Unidade de Medida
                        </label>
                        <select
                            value={form.unit}
                            onChange={e => setForm({...form, unit: e.target.value})}
                            className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-xs outline-none shadow-inner border-2 border-transparent focus:border-blue-100 transition-all"
                        >
                            <option value="">SELECIONE A UNIDADE</option>
                            {UNIDADES.map(u => (
                                <option key={u.value} value={u.value}>
                                    {u.label}
                                </option>
                            ))}
                        </select>
                    </div>
 
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !form.base.trim() || !form.unit}
                        className="w-full py-5 bg-blue-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl shadow-blue-200 flex items-center justify-center gap-3 active:scale-95 transition-all border-b-4 border-blue-800 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>}
                        {isEditing ? 'ATUALIZAR INSUMO' : 'ADICIONAR INSUMO'}
                    </button>
                </div>
            </div>
        </div>
    );
};
 
export default NewInsumoModal;