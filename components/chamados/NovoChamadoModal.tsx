import React, { useState } from 'react';
import { XCircle, Loader2 } from 'lucide-react';
import { Store, DemandV2Priority } from '../../types';

interface NovoChamadoModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAdmin: boolean;
    stores: Store[];
    userStoreId: string | null;
    isSubmitting: boolean;
    onSubmit: (data: { title: string; description: string; priority: DemandV2Priority; category: string; storeId: string }) => Promise<void>;
}

const NovoChamadoModal: React.FC<NovoChamadoModalProps> = ({ isOpen, onClose, isAdmin, stores, userStoreId, isSubmitting, onSubmit }) => {
    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const title = formData.get('title') as string;
        const description = formData.get('description') as string;
        const priority = formData.get('priority') as DemandV2Priority;
        const category = formData.get('category') as string;
        const storeId = isAdmin ? (formData.get('store_id') as string) : (userStoreId || '');
        if (!title || !description || !storeId) return;
        await onSubmit({ title, description, priority, category, storeId });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic">Novo Chamado</h3>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Abertura de Ordem de Serviço</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-rose-500 transition-all">
                        <XCircle size={24} />
                    </button>
                </div>
                <form className="p-8 space-y-6 overflow-y-auto" onSubmit={handleSubmit}>
                    {isAdmin && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Loja Solicitante</label>
                            <select name="store_id" className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none">
                                {stores.map(s => <option key={s.id} value={s.id}>Loja {s.number} - {s.city}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Título do Chamado</label>
                        <input name="title" type="text" required placeholder="Ex: Problema no Ar Condicionado" className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Prioridade</label>
                            <select name="priority" className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none">
                                <option value="baixa">Baixa</option>
                                <option value="media">Média</option>
                                <option value="alta">Alta</option>
                                <option value="urgente">Urgente</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoria</label>
                            <select name="category" className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none">
                                <option value="compra">Compra</option>
                                <option value="defeito">Defeito</option>
                                <option value="produto">Produto</option>
                                <option value="reclamacao">Reclamação</option>
                                <option value="relatorio">Relatório</option>
                                <option value="reposicao">Reposição</option>
                                <option value="sistema">Sistema</option>
                                <option value="solicitacao">Solicitação</option>
                                <option value="outro">Outro</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Descrição Detalhada</label>
                        <textarea name="description" required rows={4} placeholder="Descreva o problema com o máximo de detalhes possível..." className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"></textarea>
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Abrir Chamado Agora'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NovoChamadoModal;
