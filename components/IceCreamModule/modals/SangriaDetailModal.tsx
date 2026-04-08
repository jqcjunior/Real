import React from 'react';
import { X, DollarSign, Info, Edit2, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../constants';

interface SangriaDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    sangrias: any[];
    categories: any[];
    isAdmin?: boolean;
    onEditSangria?: (sangria: any) => void;
    onDeleteSangria?: (id: string) => void;
}

const SangriaDetailModal: React.FC<SangriaDetailModalProps> = ({
    isOpen,
    onClose,
    title,
    sangrias,
    categories,
    isAdmin,
    onEditSangria,
    onDeleteSangria
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[80vh] shadow-2xl animate-in zoom-in duration-300 flex flex-col overflow-hidden">
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                        <DollarSign className="text-red-600" /> {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
                    {sangrias.map((s: any) => (
                        <div key={s.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex justify-between items-center">
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-blue-950 uppercase italic">{s.description || 'SEM DESCRIÇÃO'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[8px] font-bold text-gray-400 uppercase">{categories.find(c => c.id === s.category_id)?.name || 'OUTROS'}</span>
                                    <span className="text-[8px] text-gray-300">•</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase">{new Date(s.transaction_date).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-lg font-black text-red-600 italic">{formatCurrency(s.amount)}</span>
                                {isAdmin && (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => onEditSangria?.(s)}
                                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                            onClick={() => onDeleteSangria?.(s.id)}
                                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {sangrias.length === 0 && (
                        <div className="py-20 text-center">
                            <Info className="mx-auto text-gray-300 mb-3" size={40}/>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhuma sangria encontrada</p>
                        </div>
                    )}
                </div>
                <div className="p-8 border-t bg-gray-50 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Total do Período</span>
                    <span className="text-2xl font-black text-red-600 italic">{formatCurrency(sangrias.reduce((acc, s) => acc + s.amount, 0))}</span>
                </div>
            </div>
        </div>
    );
};

export default SangriaDetailModal;
