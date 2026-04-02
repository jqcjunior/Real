import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { DemandCategory } from '../types';
import { Plus, Edit2, Trash2, Check, X, Settings, Eye } from 'lucide-react';

interface DemandCategoriesManagerProps {
    onCategoriesChange?: () => void;
}

const DemandCategoriesManager: React.FC<DemandCategoriesManagerProps> = ({ onCategoriesChange }) => {
    const [categories, setCategories] = useState<DemandCategory[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<DemandCategory | null>(null);
    const [formData, setFormData] = useState({ name: '', label: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('demands_categories')
                .select('*')
                .order('label', { ascending: true });

            if (error) throw error;
            setCategories(data || []);
        } catch (err) {
            console.error('Erro ao buscar categorias:', err);
        }
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.label || isSubmitting) return;

        setIsSubmitting(true);
        try {
            if (editingCategory) {
                // Atualizar categoria existente
                const { error } = await supabase
                    .from('demands_categories')
                    .update({
                        name: formData.name.toLowerCase().replace(/\s+/g, '_'),
                        label: formData.label,
                    })
                    .eq('id', editingCategory.id);

                if (error) throw error;
            } else {
                // Criar nova categoria
                const { error } = await supabase
                    .from('demands_categories')
                    .insert([{
                        name: formData.name.toLowerCase().replace(/\s+/g, '_'),
                        label: formData.label,
                        is_active: true
                    }]);

                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingCategory(null);
            setFormData({ name: '', label: '' });
            await fetchCategories();
            
            // Notificar componente pai para recarregar categorias
            if (onCategoriesChange) {
                onCategoriesChange();
            }
        } catch (err: any) {
            console.error('Erro ao salvar categoria:', err);
            alert(`Erro: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleActive = async (category: DemandCategory) => {
        try {
            const { error } = await supabase
                .from('demands_categories')
                .update({ is_active: !category.is_active })
                .eq('id', category.id);

            if (error) throw error;
            await fetchCategories();
            
            if (onCategoriesChange) {
                onCategoriesChange();
            }
        } catch (err) {
            console.error('Erro ao alterar status:', err);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;

        try {
            const { error } = await supabase
                .from('demands_categories')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchCategories();
            
            if (onCategoriesChange) {
                onCategoriesChange();
            }
        } catch (err: any) {
            console.error('Erro ao excluir categoria:', err);
            alert(`Erro ao excluir: ${err.message}. Pode haver demandas usando esta categoria.`);
        }
    };

    const openEditModal = (category: DemandCategory) => {
        setEditingCategory(category);
        setFormData({ name: category.name, label: category.label });
        setIsModalOpen(true);
    };

    return (
        <>
            <button
                onClick={() => {
                    setEditingCategory(null);
                    setFormData({ name: '', label: '' });
                    setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all"
                title="Gerenciar Categorias"
            >
                <Settings size={14} />
                Categorias
            </button>

            {isModalOpen && (
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-6">
                            Gerenciar Categorias de Demandas
                        </h2>

                        {/* Formulário de Adição/Edição */}
                        <form onSubmit={handleSaveCategory} className="mb-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase mb-4">
                                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                            </h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                                        Nome (ID Interno)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ex: tecnologia"
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                        required
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Será convertido para snake_case automaticamente</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                                        Rótulo (Exibição)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.label}
                                        onChange={e => setFormData({ ...formData, label: e.target.value })}
                                        placeholder="Ex: Tecnologia"
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                        required
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Como será exibido nos filtros e formulários</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingCategory(null);
                                        setFormData({ name: '', label: '' });
                                    }}
                                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        'Salvando...'
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            {editingCategory ? 'Salvar Alterações' : 'Adicionar Categoria'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Lista de Categorias */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase mb-3">
                                Categorias Existentes
                            </h3>
                            {categories.map(cat => (
                                <div
                                    key={cat.id}
                                    className={`flex items-center justify-between p-3 rounded-xl border ${
                                        cat.is_active
                                            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                            : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 opacity-60'
                                    }`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <p className="font-bold text-slate-900 dark:text-white">{cat.label}</p>
                                            <span className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                {cat.name}
                                            </span>
                                            {!cat.is_active && (
                                                <span className="text-[10px] text-red-500 font-bold uppercase bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                                                    Inativa
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggleActive(cat)}
                                            className={`p-2 rounded-lg text-xs font-bold ${
                                                cat.is_active
                                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200'
                                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                                            }`}
                                            title={cat.is_active ? 'Desativar' : 'Ativar'}
                                        >
                                            {cat.is_active ? <Eye size={14} /> : <Check size={14} />}
                                        </button>
                                        <button
                                            onClick={() => openEditModal(cat)}
                                            className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200"
                                            title="Editar"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCategory(cat.id)}
                                            className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200"
                                            title="Excluir"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-600"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DemandCategoriesManager;