import React, { useState } from 'react';
import { X, DollarSign, Info, Edit2, Trash2, AlertTriangle } from 'lucide-react';
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
    // ✅ Estado para controlar o modal de confirmação
    const [confirmDelete, setConfirmDelete] = useState<{
        isOpen: boolean;
        sangriaId: string;
        sangriaDescription: string;
    } | null>(null);
 
    if (!isOpen) return null;
 
    // ✅ Handler de exclusão com confirmação
    const handleDeleteClick = (sangria: any) => {
        setConfirmDelete({
            isOpen: true,
            sangriaId: sangria.id,
            sangriaDescription: sangria.description || 'esta despesa'
        });
    };
 
    const handleConfirmDelete = async () => {
        if (confirmDelete && onDeleteSangria) {
            try {
                await onDeleteSangria(confirmDelete.sangriaId);
                setConfirmDelete(null);
            } catch (error) {
                console.error('Erro ao excluir sangria:', error);
                alert('Erro ao excluir sangria');
            }
        }
    };
 
    return (
        <>
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
                            <div key={s.id} className="bg-white p-6 rounded-[25px] border border-gray-100 flex justify-between items-center hover:shadow-md transition-all group">
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-blue-950 uppercase italic tracking-tighter">{s.description || 'SEM DESCRIÇÃO'}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[8px] font-black text-gray-400 uppercase px-2 py-0.5 bg-gray-100 rounded-full">
                                            {categories.find(c => c.id === s.category_id)?.name || 'OUTROS'}
                                        </span>
                                        <span className="text-[8px] text-gray-300">•</span>
                                        <span className="text-[8px] font-bold text-gray-500 uppercase">
                                            {new Date(s.transaction_date || s.created_at).toLocaleDateString('pt-BR')}
                                        </span>
                                        {s.userName && (
                                            <>
                                                <span className="text-[8px] text-gray-300">•</span>
                                                <span className="text-[8px] font-black text-purple-600 uppercase italic">
                                                    Lançado por: {s.userName}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-lg font-black text-red-600 italic tracking-tighter">
                                        {formatCurrency(Number(s.amount || s.value || 0))}
                                    </span>
                                    {isAdmin && (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => onEditSangria?.(s)}
                                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                                                title="Editar"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            {/* ✅ BOTÃO CORRIGIDO - Agora abre modal ao invés de confirm() */}
                                            <button 
                                                onClick={() => handleDeleteClick(s)}
                                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                                                title="Excluir"
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
                        <span className="text-2xl font-black text-red-600 italic">
                            {formatCurrency(sangrias.reduce((acc, s) => acc + Number(s.amount || s.value || 0), 0))}
                        </span>
                    </div>
                </div>
            </div>
 
            {/* ✅ MODAL DE CONFIRMAÇÃO INTEGRADO */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-50 to-red-100 px-8 py-6 flex justify-between items-center border-b border-red-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-200 rounded-xl">
                                    <AlertTriangle size={24} className="text-red-700" />
                                </div>
                                <h3 className="text-lg font-black uppercase italic text-red-900 tracking-tight">
                                    Excluir Despesa
                                </h3>
                            </div>
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="text-red-400 hover:text-red-600 transition-all p-1"
                            >
                                <X size={24} />
                            </button>
                        </div>
 
                        {/* Content */}
                        <div className="p-8">
                            <p className="text-sm font-bold text-gray-700 leading-relaxed">
                                Deseja realmente excluir a despesa <span className="text-red-600 font-black">"{confirmDelete.sangriaDescription}"</span>?
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                Esta ação não pode ser desfeita.
                            </p>
                        </div>
 
                        {/* Footer */}
                        <div className="flex gap-3 px-8 pb-8">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-xs hover:bg-gray-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-red-700 transition-all border-b-4 border-red-800"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
 
export default SangriaDetailModal;