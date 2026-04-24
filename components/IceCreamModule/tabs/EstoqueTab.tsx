import React, { useState } from 'react';
import { Package, Plus, Trash2, Edit, Archive, ShoppingCart, ClipboardList, AlertTriangle } from 'lucide-react';
import NewInsumoModal from '../modals/NewInsumoModal';
 
interface EstoqueTabProps {
    filteredStock: any[];
    isAdmin: boolean;
    onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: any, stockId?: string) => Promise<void>;
    onAddStockBase: (base: string, unit: string, storeId: string) => Promise<void>;
    onUpdateStockBase?: (id: string, base: string, unit: string) => Promise<void>;
    onDeleteStockBase: (id: string) => Promise<void>;
    onToggleFreezeStock: (id: string, active: boolean) => Promise<void>;
    effectiveStoreId: string;
    fetchData?: () => Promise<void>;
    // ✅ NOVOS HANDLERS PARA ABRIR MODAIS
    onOpenPurchaseModal?: () => void;
    onOpenInventoryModal?: () => void;
    onOpenWastageModal?: () => void;
}
 
const EstoqueTab: React.FC<EstoqueTabProps> = ({
    filteredStock,
    isAdmin,
    onAddStockBase,
    onUpdateStockBase,
    onDeleteStockBase,
    onToggleFreezeStock,
    effectiveStoreId,
    fetchData,
    onOpenPurchaseModal,
    onOpenInventoryModal,
    onOpenWastageModal
}) => {
    const [showNewInsumoModal, setShowNewInsumoModal] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: string; product_base: string; unit: string } | null>(null);
 
    const handleEdit = (item: any) => {
        setEditingItem({
            id: item.id,
            product_base: item.product_base,
            unit: item.unit
        });
        setShowNewInsumoModal(true);
    };
 
    const handleCloseModal = () => {
        setShowNewInsumoModal(false);
        setEditingItem(null);
    };
 
    // ✅ Ordenar ingredientes alfabeticamente
    const sortedStock = [...filteredStock].sort((a, b) => 
        a.product_base.localeCompare(b.product_base, 'pt-BR')
    );
 
    return (
        <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-700 rounded-3xl">
                        <Package size={32}/>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">
                            Gestão de <span className="text-blue-700">Estoque</span>
                        </h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                            Controle de insumos e ingredientes
                        </p>
                    </div>
                </div>
                
                {/* ✅ BOTÕES DE AÇÃO - NOVA SEÇÃO */}
                <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => {
                                    setEditingItem(null);
                                    setShowNewInsumoModal(true);
                                }}
                                className="px-4 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all border-b-4 border-blue-800"
                            >
                                <Plus size={16}/> Novo Insumo
                            </button>
                            
                            {onOpenPurchaseModal && (
                                <button
                                    onClick={onOpenPurchaseModal}
                                    className="px-4 py-3 bg-green-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-green-700 transition-all border-b-4 border-green-800"
                                    title="Registrar entrada de mercadoria"
                                >
                                    <ShoppingCart size={16}/> Entrada
                                </button>
                            )}
                            
                            {onOpenInventoryModal && (
                                <button
                                    onClick={onOpenInventoryModal}
                                    className="px-4 py-3 bg-purple-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-purple-700 transition-all border-b-4 border-purple-800"
                                    title="Fazer inventário completo"
                                >
                                    <ClipboardList size={16}/> Inventário
                                </button>
                            )}
                            
                            {onOpenWastageModal && (
                                <button
                                    onClick={onOpenWastageModal}
                                    className="px-4 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-red-700 transition-all border-b-4 border-red-800"
                                    title="Registrar avarias/perdas"
                                >
                                    <AlertTriangle size={16}/> Avarias
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
 
            <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase border-b">
                        <tr>
                            <th className="px-8 py-5">Insumo / Base</th>
                            <th className="px-8 py-5">Unidade</th>
                            <th className="px-8 py-5 text-right">Estoque Atual</th>
                            {isAdmin && <th className="px-8 py-5 text-center">Ações</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                        {sortedStock.map((item: any) => (
                            <tr key={item.id} className="hover:bg-blue-50/30 transition-all">
                                <td className="px-8 py-5">
                                    <span className="text-xs font-black text-blue-950 uppercase italic">
                                        {item.product_base}
                                    </span>
                                </td>
                                <td className="px-8 py-5">
                                    <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase border bg-gray-50 text-gray-700 border-gray-200">
                                        {item.unit || 'N/A'}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <span className="text-sm font-black text-gray-900">
                                        {item.stock_current} {item.unit}
                                    </span>
                                </td>
                                {isAdmin && (
                                    <td className="px-8 py-5">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-2 text-orange-400 hover:text-orange-600 transition-all"
                                                title="Editar Insumo"
                                            >
                                                <Edit size={18}/>
                                            </button>
                                            <button
                                                onClick={() => onToggleFreezeStock(item.id, !item.is_active)}
                                                className="p-2 text-gray-400 hover:text-gray-600 transition-all"
                                                title={item.is_active ? "Desativar" : "Ativar"}
                                            >
                                                <Archive size={18}/>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Desativar "${item.product_base}"?`)) {
                                                        onDeleteStockBase(item.id);
                                                    }
                                                }}
                                                className="p-2 text-red-400 hover:text-red-600 transition-all"
                                                title="Excluir Insumo"
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {sortedStock.length === 0 && (
                            <tr>
                                <td colSpan={isAdmin ? 4 : 3} className="px-8 py-16 text-center text-gray-400 uppercase font-black tracking-widest italic">
                                    Nenhum insumo cadastrado
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
 
            <NewInsumoModal
                isOpen={showNewInsumoModal}
                onClose={handleCloseModal}
                onAdd={onAddStockBase}
                onUpdate={onUpdateStockBase}
                effectiveStoreId={effectiveStoreId}
                fetchData={fetchData}
                editingItem={editingItem}
            />
        </div>
    );
};
 
export default EstoqueTab;