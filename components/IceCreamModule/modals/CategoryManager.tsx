import React from 'react';
import { X, Settings, Plus, Trash2 } from 'lucide-react';
import { IceCreamSangriaCategory } from '../../../types';

interface CategoryManagerProps {
    isOpen: boolean;
    onClose: () => void;
    categories: IceCreamSangriaCategory[];
    newCategoryName: string;
    setNewCategoryName: (name: string) => void;
    onSave: () => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    isSubmitting: boolean;
    effectiveStoreId: string;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({
    isOpen,
    onClose,
    categories,
    newCategoryName,
    setNewCategoryName,
    onSave,
    onDelete,
    isSubmitting,
    effectiveStoreId
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 flex flex-col overflow-hidden">
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                        <Settings className="text-blue-600" /> Categorias de <span className="text-blue-600">Sangria</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                </div>
                <div className="p-10 space-y-6">
                    <div className="flex gap-2">
                        <input 
                            value={newCategoryName} 
                            onChange={e => setNewCategoryName(e.target.value)} 
                            className="flex-1 p-4 bg-gray-50 rounded-2xl font-black uppercase text-xs outline-none" 
                            placeholder="NOVA CATEGORIA..." 
                        />
                        <button 
                            onClick={onSave} 
                            disabled={isSubmitting} 
                            className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            <Plus size={20}/>
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                        {categories.filter(c => c.store_id === effectiveStoreId).map(c => (
                            <div key={c.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <span className="text-[10px] font-black text-blue-950 uppercase italic">{c.name}</span>
                                <button 
                                    onClick={() => onDelete(c.id)} 
                                    className="text-red-300 hover:text-red-600 transition-all"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryManager;
