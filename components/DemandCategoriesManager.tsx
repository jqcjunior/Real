import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { DemandCategory } from '../types';
import { Settings, Plus, Trash2, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DemandCategoriesManagerProps {
  onCategoriesChange?: () => void;
}

const DemandCategoriesManager: React.FC<DemandCategoriesManagerProps> = ({ onCategoriesChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<DemandCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', label: '' });
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('demands_categories')
        .select('*')
        .order('label', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError('Erro ao carregar categorias');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.label || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const slug = formData.name.toLowerCase().trim().replace(/\s+/g, '_');
      const { error } = await supabase
        .from('demands_categories')
        .insert([{ name: slug, label: formData.label.trim(), is_active: true }]);

      if (error) throw error;

      setFormData({ name: '', label: '' });
      await fetchCategories();
      onCategoriesChange?.();
    } catch (err: any) {
      console.error('Error adding category:', err);
      setError(err.message || 'Erro ao adicionar categoria');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('demands_categories')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      await fetchCategories();
      onCategoriesChange?.();
    } catch (err: any) {
      console.error('Error toggling status:', err);
      setError('Erro ao atualizar status');
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      const { error } = await supabase
        .from('demands_categories')
        .delete()
        .eq('id', deleteConfirmId);

      if (error) throw error;
      await fetchCategories();
      onCategoriesChange?.();
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error('Error deleting category:', err);
      setError('Erro ao excluir categoria. Verifique se existem demandas vinculadas a ela.');
      setDeleteConfirmId(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"
        title="Gerenciar Categorias"
      >
        <Settings size={20} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings className="text-accent" />
                  Categorias de Demandas
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <form onSubmit={handleAddCategory} className="mb-8 space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Slug (name)</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="ex: financeiro"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rótulo (label)</label>
                      <input
                        type="text"
                        value={formData.label}
                        onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                        placeholder="ex: Financeiro"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/50"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-accent hover:bg-accent/90 text-black font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    Adicionar Categoria
                  </button>
                  {error && (
                    <div className="flex items-center gap-2 text-red-500 text-xs font-medium">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  )}
                </form>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Categorias Existentes</h3>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="animate-spin text-accent" />
                    </div>
                  ) : categories.length === 0 ? (
                    <p className="text-center py-8 text-gray-500 text-sm italic">Nenhuma categoria cadastrada.</p>
                  ) : (
                    categories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-800 rounded-xl group hover:border-accent/30 transition-all"
                      >
                        <div>
                          <p className="font-bold text-sm text-gray-900 dark:text-white">{cat.label}</p>
                          <p className="text-[10px] text-gray-500 font-mono uppercase">{cat.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleStatus(cat.id, cat.is_active)}
                            className={`p-2 rounded-lg transition-colors ${
                              cat.is_active
                                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                            }`}
                            title={cat.is_active ? 'Desativar' : 'Ativar'}
                          >
                            {cat.is_active ? <Check size={16} /> : <X size={16} />}
                          </button>
                          <button
                            onClick={() => confirmDelete(cat.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <AnimatePresence>
                {deleteConfirmId && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[110] bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 text-center"
                  >
                    <div className="max-w-xs">
                      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Excluir Categoria?</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Esta ação não pode ser desfeita. A categoria será removida permanentemente.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDelete}
                          className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DemandCategoriesManager;
