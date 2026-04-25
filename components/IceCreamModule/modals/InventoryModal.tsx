import React, { useState, useEffect, useMemo } from 'react';
import { X, PencilLine, Loader2, Save, Search } from 'lucide-react';
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
    const [searchTerm, setSearchTerm] = useState('');

    // ✅ NOVO: Ordenação alfabética + Busca
    const filteredAndSortedStock = useMemo(() => {
        return [...filteredStock]
            .sort((a, b) => a.product_base.localeCompare(b.product_base, 'pt-BR'))
            .filter(item => 
                item.product_base.toUpperCase().includes(searchTerm.toUpperCase())
            );
    }, [filteredStock, searchTerm]);

    useEffect(() => {
        if (isOpen) {
            setInventoryForm(initialInventory);
            setSearchTerm(''); // ✅ Limpar busca ao abrir
        }
    }, [isOpen, initialInventory]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            console.log('═══════════════════════════════════════════');
            console.log('📦 [InventoryModal] INICIANDO ATUALIZAÇÃO DE INVENTÁRIO');
            console.log('═══════════════════════════════════════════');
            
            const updates = Object.entries(inventoryForm).map(([stockId, val]) => {
                const st = filteredStock.find(s => s.stock_id === stockId);
                if (!st) {
                    console.warn(`⚠️ Insumo ${stockId} não encontrado no estoque`);
                    return Promise.resolve();
                }
                
                const newVal = parseFloat(val.replace(',', '.')) || 0;
                const currentVal = st.stock_current;
                
                // ✅ CORREÇÃO CRÍTICA: Calcular diferença INVERTIDA para inventário
                // Inventário = SUBSTITUIÇÃO, não soma
                // Se atual = -12 e novo = 0, precisa ADICIONAR +12
                // Se atual = 12 e novo = 0, precisa REMOVER -12
                const diff = newVal - currentVal;
                
                console.log('────────────────────────────────────────────');
                console.log(`📊 Insumo: ${st.product_base}`);
                console.log(`   Stock ID: ${stockId}`);
                console.log(`   Valor ATUAL no banco: ${currentVal} ${st.unit}`);
                console.log(`   Valor NOVO digitado: ${newVal} ${st.unit}`);
                console.log(`   DIFERENÇA calculada: ${diff > 0 ? '+' : ''}${diff} ${st.unit}`);
                
                if (Math.abs(diff) < 0.0001) {
                    console.log('   ⏭️ SEM MUDANÇA - Pulando...');
                    return Promise.resolve();
                }
                
                console.log(`   ✅ APLICANDO: ${diff > 0 ? 'ADICIONAR' : 'REMOVER'} ${Math.abs(diff)} ${st.unit}`);
                console.log(`   📈 Resultado esperado: ${currentVal} + (${diff}) = ${newVal} ${st.unit}`);
                
                return onUpdateStock(
                    effectiveStoreId, 
                    st.product_base, 
                    diff,  // ✅ Passa a diferença correta
                    st.unit, 
                    'INVENTARIO',  // ✅ Tipo específico para rastreamento
                    stockId
                );
            });
            
            console.log('────────────────────────────────────────────');
            console.log(`🔄 Aplicando ${updates.length} atualizações...`);
            
            await Promise.all(updates);
            
            console.log('✅ TODAS AS ATUALIZAÇÕES CONCLUÍDAS!');
            console.log('🔄 Recarregando dados...');
            
            if (fetchData) await fetchData();
            
            console.log('✅ Dados recarregados com sucesso!');
            console.log('═══════════════════════════════════════════');
            
            alert("Inventário atualizado com sucesso!");
            onClose();
        } catch (e: any) {
            console.error('═══════════════════════════════════════════');
            console.error('❌ ERRO AO ATUALIZAR INVENTÁRIO');
            console.error('Erro:', e);
            console.error('Mensagem:', e?.message);
            console.error('═══════════════════════════════════════════');
            
            alert("Erro ao atualizar inventário: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] shadow-2xl animate-in zoom-in duration-300 border-t-8 border-orange-600 flex flex-col overflow-hidden">
                {/* ✅ HEADER */}
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                            <PencilLine className="text-orange-600" /> Atualizar <span className="text-orange-600">Inventário</span>
                        </h3>
                        <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">
                            ⚠️ Digite o valor REAL em estoque (não a diferença)
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600">
                        <X size={24}/>
                    </button>
                </div>

                {/* ✅ BARRA DE BUSCA */}
                <div className="p-6 border-b bg-white shrink-0">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar insumo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-200 transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    {searchTerm && (
                        <p className="text-[9px] font-bold text-gray-400 uppercase mt-2 text-center">
                            {filteredAndSortedStock.length} {filteredAndSortedStock.length === 1 ? 'insumo encontrado' : 'insumos encontrados'}
                        </p>
                    )}
                </div>

                {/* ✅ LISTA DE INSUMOS (Ordenada alfabeticamente + Filtrada) */}
                <div className="flex-1 overflow-y-auto p-10 space-y-4 no-scrollbar">
                    {filteredAndSortedStock.length === 0 ? (
                        <div className="text-center py-20">
                            <Search className="mx-auto text-gray-300 mb-4" size={48} />
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">
                                Nenhum insumo encontrado
                            </p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-2">
                                Tente outro termo de busca
                            </p>
                        </div>
                    ) : (
                        filteredAndSortedStock.map(s => (
                            <div key={s.stock_id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-orange-200 transition-all">
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-blue-950 uppercase italic leading-none">{s.product_base}</p>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">
                                        Sistema: <span className={`${s.stock_current < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                            {s.stock_current} {s.unit}
                                        </span>
                                    </p>
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
                                {/* ✅ Indicador visual de mudança */}
                                {inventoryForm[s.stock_id] && parseFloat(inventoryForm[s.stock_id].replace(',', '.')) !== s.stock_current && (
                                    <div className="text-[8px] font-black uppercase min-w-[60px] text-right">
                                        {parseFloat(inventoryForm[s.stock_id].replace(',', '.')) > s.stock_current ? (
                                            <span className="text-green-600">↑ +{(parseFloat(inventoryForm[s.stock_id].replace(',', '.')) - s.stock_current).toFixed(2)}</span>
                                        ) : (
                                            <span className="text-red-600">↓ {(parseFloat(inventoryForm[s.stock_id].replace(',', '.')) - s.stock_current).toFixed(2)}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* ✅ FOOTER */}
                <div className="p-10 border-t bg-gray-50 flex flex-col gap-3 shrink-0">
                    <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 text-center">
                        <p className="text-[9px] font-black text-orange-700 uppercase leading-relaxed">
                            💡 Digite o valor CONTADO fisicamente<br/>
                            O sistema calcula automaticamente a diferença
                        </p>
                    </div>
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