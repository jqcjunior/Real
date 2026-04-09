import React, { useState } from 'react';
import { Warehouse, Plus, Truck, PencilLine, Package, Trash2, Info } from 'lucide-react';
import { IceCreamStock } from '../../../types';
import NewInsumoModal from '../modals/NewInsumoModal';
import PurchaseModal from '../modals/PurchaseModal';
import InventoryModal from '../modals/InventoryModal';

interface EstoqueTabProps {
    filteredStock: IceCreamStock[];
    isAdmin: boolean;
    onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: any, stockId?: string) => Promise<void>;
    onAddStockBase: (base: string, unit: string, storeId: string) => Promise<void>;
    onDeleteStockBase: (id: string) => Promise<void>;
    onToggleFreezeStock: (id: string, active: boolean) => Promise<void>;
    effectiveStoreId: string;
    fetchData?: () => Promise<void>;
}

const EstoqueTab: React.FC<EstoqueTabProps> = ({
    filteredStock,
    isAdmin,
    onUpdateStock,
    onAddStockBase,
    onDeleteStockBase,
    onToggleFreezeStock,
    effectiveStoreId,
    fetchData
}) => {
    const [showNewInsumoModal, setShowNewInsumoModal] = useState(false);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [purchaseForm, setPurchaseForm] = useState<any>({});
    const [inventoryForm, setInventoryForm] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleToggleFreezeStock = async (st: IceCreamStock) => {
        if (!confirm(`Deseja ${st.is_active === false ? 'reativar' : 'congelar'} o insumo ${st.product_base}?`)) return;
        try {
            await onToggleFreezeStock(st.stock_id, st.is_active === false);
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro: " + e.message);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-orange-50 text-orange-600 rounded-3xl">
                        <Warehouse size={32}/>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">
                            Controle de <span className="text-orange-600">Insumos</span>
                        </h3>
                    </div>
                </div>
                {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setShowNewInsumoModal(true)} className="px-4 py-2 bg-gray-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-black active:scale-95"><Plus size={14}/> Novo Insumo</button>
                        <button onClick={() => { setPurchaseForm({}); setShowPurchaseModal(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-blue-900 active:scale-95"><Truck size={14}/> Lançar Compra</button>
                        <button onClick={() => { const initialInv: Record<string, string> = {}; filteredStock.forEach(s => initialInv[s.stock_id] = s.stock_current.toString()); setInventoryForm(initialInv); setShowInventoryModal(true); }} className="px-4 py-2 bg-orange-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-orange-900 active:scale-95"><PencilLine size={14}/> Inventário</button>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredStock.map(st => (
                    <div key={st.stock_id} className={`bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 relative group overflow-hidden ${st.is_active === false ? 'opacity-40 grayscale' : ''}`}>
                        {isAdmin && (
                            <button 
                                onClick={() => handleToggleFreezeStock(st)} 
                                className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all z-10"
                                title={st.is_active === false ? "Reativar Insumo" : "Congelar Insumo"}
                            >
                                <Trash2 size={16}/>
                            </button>
                        )}
                        <div className={`p-2 rounded-xl text-white w-fit mb-4 ${st.stock_current <= 5 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}>
                            <Package size={16}/>
                        </div>
                        <h4 className="text-[10px] font-black text-blue-950 uppercase italic leading-none mb-2 truncate pr-6">{st.product_base}</h4>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-black italic tracking-tighter ${st.stock_current <= 5 ? 'text-red-600' : 'text-gray-900'}`}>{st.stock_current}</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{st.unit}</span>
                        </div>
                    </div>
                ))}
                {filteredStock.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-[32px]">
                        <Info className="mx-auto text-gray-300 mb-3" size={40}/>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhum insumo ativo no momento</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            <NewInsumoModal 
                isOpen={showNewInsumoModal}
                onClose={() => setShowNewInsumoModal(false)}
                onAdd={onAddStockBase}
                effectiveStoreId={effectiveStoreId}
                fetchData={fetchData}
            />
            <PurchaseModal 
                isOpen={showPurchaseModal}
                onClose={() => setShowPurchaseModal(false)}
                onUpdateStock={onUpdateStock}
                filteredStock={filteredStock}
                effectiveStoreId={effectiveStoreId}
                fetchData={fetchData}
            />
            <InventoryModal 
                isOpen={showInventoryModal}
                onClose={() => setShowInventoryModal(false)}
                onUpdateStock={onUpdateStock}
                filteredStock={filteredStock}
                effectiveStoreId={effectiveStoreId}
                fetchData={fetchData}
                initialInventory={inventoryForm}
            />
        </div>
    );
};

export default EstoqueTab;
