import React, { useState, useEffect, useMemo } from 'react';
import { X, PackagePlus, Save, Loader2, Trash2, Zap } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../constants';
import { IceCreamCategory, IceCreamRecipeItem } from '../../../types';
 
interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingProduct: any;
    form: any;
    setForm: (form: any) => void;
    onSave: (product: any) => Promise<void>;
    stock: any[];
    effectiveStoreId: string;
    fetchData?: () => Promise<void>;
}
 
const ProductModal: React.FC<ProductModalProps> = ({
    isOpen,
    onClose,
    editingProduct,
    form,
    setForm,
    onSave,
    stock,
    effectiveStoreId,
    fetchData
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newRecipeItem, setNewRecipeItem] = useState({ stock_base_name: '', quantity: '1' });

    // ✅ Insumos ordenados alfabeticamente
    const sortedStock = useMemo(() => {
        return stock
            .filter(s => s.store_id === effectiveStoreId && s.is_active !== false)
            .sort((a, b) => a.product_base.localeCompare(b.product_base, 'pt-BR'));
    }, [stock, effectiveStoreId]);

    // ✅ RESETAR form quando modal abre/fecha
    useEffect(() => {
        if (isOpen) {
            console.log('📂 [ProductModal] Modal aberto');
            console.log('📝 Editing?', editingProduct ? 'SIM' : 'NÃO');
            console.log('📋 Form inicial:', form);
        }
    }, [isOpen, editingProduct, form]);
 
    if (!isOpen) return null;
 
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        console.log('═══════════════════════════════════════════');
        console.log('💾 [ProductModal] handleSubmit CHAMADO');
        console.log('📦 Form atual:', form);
        console.log('🏪 Store ID:', effectiveStoreId);
        
        // ✅ VALIDAÇÕES
        if (!form.name || !form.category || form.price === undefined) {
            console.error('❌ [ProductModal] Campos obrigatórios vazios!');
            alert('Preencha todos os campos obrigatórios (Nome, Categoria, Preço)!');
            return;
        }
 
        // ✅ PREPARAR DADOS
        const productData = {
            ...form,
            storeId: effectiveStoreId,
            price: parseFloat(form.price) || 0,
            active: form.active !== false,
            recipe: form.recipe || []
        };
 
        console.log('📤 [ProductModal] Dados preparados:', productData);
 
        setIsSubmitting(true);
        
        try {
            console.log('⏳ [ProductModal] Chamando onSave...');
            
            await onSave(productData);
            
            console.log('✅ [ProductModal] onSave executado com sucesso!');
            console.log('🔄 [ProductModal] Recarregando dados...');
            
            if (fetchData) {
                await fetchData();
                console.log('✅ [ProductModal] Dados recarregados!');
            }
            
            console.log('❌ [ProductModal] Fechando modal...');
            onClose();
            
            console.log('═══════════════════════════════════════════');
            
        } catch (error: any) {
            console.error('═══════════════════════════════════════════');
            console.error('❌ [ProductModal] ERRO ao salvar');
            console.error('Erro:', error);
            console.error('Mensagem:', error?.message);
            console.error('Stack:', error?.stack);
            console.error('═══════════════════════════════════════════');
            
            alert("Erro ao salvar produto: " + (error?.message || 'Erro desconhecido'));
        } finally {
            setIsSubmitting(false);
        }
    };
 
    const addRecipeItem = () => {
        console.log('➕ [ProductModal] Adicionando item à receita:', newRecipeItem);
        
        if (!newRecipeItem.stock_base_name || !newRecipeItem.quantity) {
            console.warn('⚠️ [ProductModal] Item de receita incompleto');
            return;
        }
        
        const updatedRecipe = [...(form.recipe || []), { 
            stock_base_name: newRecipeItem.stock_base_name, 
            quantity: parseFloat(newRecipeItem.quantity.replace(',', '.')) 
        }];
        
        setForm({ ...form, recipe: updatedRecipe });
        setNewRecipeItem({ stock_base_name: '', quantity: '1' });
        
        console.log('✅ [ProductModal] Receita atualizada:', updatedRecipe);
    };
 
    const removeRecipeItem = (index: number) => {
        console.log('🗑️ [ProductModal] Removendo item da receita:', index);
        
        const updatedRecipe = (form.recipe || []).filter((_: any, idx: number) => idx !== index);
        setForm({ ...form, recipe: updatedRecipe });
        
        console.log('✅ [ProductModal] Receita atualizada:', updatedRecipe);
    };
 
    console.log('🎨 [ProductModal] Renderizando...');
 
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-4xl max-h-[90vh] shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 flex flex-col overflow-hidden">
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                        <PackagePlus className="text-blue-600" /> {editingProduct ? 'Editar' : 'Novo'} <span className="text-blue-600">Produto</span>
                    </h3>
                    <button 
                        onClick={() => {
                            console.log('❌ [ProductModal] Fechando sem salvar');
                            onClose();
                        }} 
                        className="text-gray-400 hover:text-red-600 transition-all"
                    >
                        <X size={24}/>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <form onSubmit={handleSubmit} className="p-10 space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2">Informações Gerais</h4>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Nome do Produto</label>
                                    <input 
                                        required 
                                        value={form.name || ''} 
                                        onChange={e => {
                                            console.log('✏️ [ProductModal] Nome alterado:', e.target.value);
                                            setForm({...form, name: e.target.value});
                                        }} 
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black uppercase italic outline-none focus:ring-4 focus:ring-blue-50" 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Categoria</label>
                                        <select 
                                            value={form.category || 'Copinho'} 
                                            onChange={e => {
                                                console.log('📂 [ProductModal] Categoria alterada:', e.target.value);
                                                setForm({...form, category: e.target.value as IceCreamCategory});
                                            }} 
                                            className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-slate-900 outline-none"
                                        >
                                            {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Preço de Venda</label>
                                        <input 
                                            required 
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.price || 0} 
                                            onChange={e => {
                                                console.log('💰 [ProductModal] Preço alterado:', e.target.value);
                                                setForm({...form, price: parseFloat(e.target.value) || 0});
                                            }} 
                                            className="w-full p-4 bg-blue-50 border-none rounded-2xl font-black text-blue-700 outline-none text-xl shadow-inner" 
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                                    <label className="text-[10px] font-black text-gray-500 uppercase">Status:</label>
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const newActive = !form.active;
                                            console.log('🔄 [ProductModal] Status alterado:', newActive ? 'ATIVO' : 'INATIVO');
                                            setForm({...form, active: newActive});
                                        }} 
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${form.active ? 'bg-green-600 text-white shadow-lg' : 'bg-red-600 text-white'}`}
                                    >
                                        {form.active ? 'Visível no PDV' : 'Oculto no PDV'}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2">Receita / Baixa Automática</h4>
                                <div className="p-6 bg-gray-950 rounded-3xl space-y-4 shadow-xl">
                                    <div className="grid grid-cols-2 gap-3">
                                        <select 
                                            value={newRecipeItem.stock_base_name} 
                                            onChange={e => setNewRecipeItem({...newRecipeItem, stock_base_name: e.target.value})} 
                                            className="bg-white/10 border-none rounded-xl p-3 text-xs font-black text-white outline-none"
                                        >
                                            <option value="" className="text-black">SELECIONE INSUMO...</option>
                                            {sortedStock.map(s => (
                                                <option key={s.stock_id} value={s.product_base} className="text-black">
                                                    {s.product_base} ({s.unit})
                                                </option>
                                            ))}
                                        </select>
                                        <input 
                                            value={newRecipeItem.quantity} 
                                            onChange={e => setNewRecipeItem({...newRecipeItem, quantity: e.target.value})} 
                                            placeholder="QTD" 
                                            className="bg-white/10 border-none rounded-xl p-3 text-xs font-black text-white text-center outline-none" 
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={addRecipeItem} 
                                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg border-b-2 border-blue-900 active:scale-95 transition-all"
                                    >
                                        Vincular p/ Baixa
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-[150px] overflow-y-auto no-scrollbar">
                                    {(form.recipe || []).map((r: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-blue-900 uppercase italic">{r.stock_base_name}</span>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">Abate: {r.quantity} por venda</span>
                                            </div>
                                            <button type="button" onClick={() => removeRecipeItem(i)} className="p-2 text-red-300 hover:text-red-600">
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="w-full py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all border-b-4 border-blue-950 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR CADASTRO
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
 
export default ProductModal;