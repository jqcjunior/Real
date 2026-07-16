import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ensureSession } from '../../services/authService';
import { toast } from 'sonner';
import {
  Plus, Search, Edit3, Trash2, Link, BarChart3, X, Check,
  Smartphone, Copy, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NfcPagesManager from './NfcPagesManager';
import SurveyEditor from './SurveyEditor';
import {
  Survey, Store, User
} from '../../types';

interface AdminSurveyManagementProps {
  currentUser: User;
  stores: Store[];
  onShowResults?: (survey: Survey) => void;
}

const generateToken = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

// ─────────────────────────────────────────────────────────────────────────────
const AdminSurveyManagement: React.FC<AdminSurveyManagementProps> = ({
  currentUser, stores, onShowResults
}) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [showNfcPages, setShowNfcPages] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);

  // States para filtros
  const [filterTarget, setFilterTarget] = useState<'all' | 'external' | 'internal'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'ordered'>('all');
  const [filterStoreId, setFilterStoreId] = useState<string>('all');

  // States para duplicação
  const [duplicatingSurvey, setDuplicatingSurvey] = useState<Survey | null>(null);
  const [duplicateTargetStoreIds, setDuplicateTargetStoreIds] = useState<string[]>([]);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchSurveys(); }, []);

  const fetchSurveys = async () => {
    setIsLoading(true);
    try {
      await ensureSession();
      const { data, error } = await supabase
        .from('surveys').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setSurveys(data || []);
    } catch (err) {
      console.error('Erro ao buscar pesquisas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditor = (survey?: Survey) => {
    setEditingSurvey(survey || null);
    setShowEditor(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await ensureSession();
      const { error } = await supabase.from('surveys').delete().eq('id', id);
      if (error) throw error;
      toast.success('Pesquisa excluída!');
      fetchSurveys();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const handleToggleActive = async (e: React.MouseEvent, survey: Survey) => {
    e.stopPropagation();
    
    // Otimista
    setSurveys(prev => prev.map(s => 
      s.id === survey.id ? { ...s, is_active: !s.is_active } : s
    ));

    try {
      await ensureSession();
      const { error } = await supabase
        .from('surveys')
        .update({ is_active: !survey.is_active })
        .eq('id', survey.id);
      
      if (error) {
        // Reverter se falhou
        setSurveys(prev => prev.map(s => 
          s.id === survey.id ? { ...s, is_active: survey.is_active } : s
        ));
        toast.error('Erro ao atualizar status');
      }
    } catch (err) {
      // Reverter se falhou
      setSurveys(prev => prev.map(s => 
        s.id === survey.id ? { ...s, is_active: survey.is_active } : s
      ));
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDuplicate = async () => {
    if (!duplicatingSurvey || duplicateTargetStoreIds.length === 0) return;
    setIsDuplicating(true);
    try {
      await ensureSession();

      // Buscar perguntas originais UMA vez só
      const { data: questions } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', duplicatingSurvey.id)
        .order('sort_order', { ascending: true });

      // Criar uma survey para cada loja selecionada
      for (const storeId of duplicateTargetStoreIds) {
        const slug = duplicatingSurvey.title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-') + '-' + Date.now() + '-' + storeId.slice(0, 4);

        const { data: newSurvey, error } = await supabase
          .from('surveys')
          .insert([{
            title: duplicatingSurvey.title,
            description: duplicatingSurvey.description,
            is_active: false,
            allow_anonymous: (duplicatingSurvey as any).allow_anonymous ?? true,
            target_type: duplicatingSurvey.target_type,
            target_category: duplicatingSurvey.target_category,
            target_store_ids: [storeId],
            store_id: storeId,
            results_visible_to: duplicatingSurvey.results_visible_to,
            created_by: currentUser.id,
            slug,
            public_token: generateToken(),
          }])
          .select()
          .single();

        if (error) throw error;

        // Copiar perguntas para esta survey
        if (questions && questions.length > 0) {
          const newQuestions = questions.map(q => ({
            survey_id: newSurvey.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options || [],
            is_required: q.is_required,
            sort_order: q.sort_order,
          }));
          await supabase.from('survey_questions').insert(newQuestions);
        }
      }

      toast.success(
        `Pesquisa duplicada para ${duplicateTargetStoreIds.length} loja${duplicateTargetStoreIds.length > 1 ? 's' : ''}! Lembre de ativar cada uma.`
      );
      setDuplicatingSurvey(null);
      setDuplicateTargetStoreIds([]);
      fetchSurveys();
    } catch (err: any) {
      toast.error('Erro ao duplicar: ' + err.message);
    } finally {
      setIsDuplicating(false);
    }
  };

  const filteredSurveys = surveys
    .filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(s => filterTarget === 'all' || s.target_type === filterTarget)
    .filter(s => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'active') return s.is_active && (s as any).order_status !== 'generated';
      if (filterStatus === 'inactive') return !s.is_active;
      if (filterStatus === 'ordered') return (s as any).order_status === 'generated';
      return true;
    })
    .filter(s => filterStoreId === 'all' || 
      (s as any).store_id === filterStoreId || 
      s.target_store_ids?.includes(filterStoreId)
    );

  // ── EDITOR ABERTO ──────────────────────────────────────────────────────────
  if (showEditor) {
    return (
      <SurveyEditor
        currentUser={currentUser}
        stores={stores}
        editingSurvey={editingSurvey}
        onClose={() => { setShowEditor(false); fetchSurveys(); }}
      />
    );
  }

  // ── NFC ABERTO ─────────────────────────────────────────────────────────────
  if (showNfcPages) {
    return <NfcPagesManager stores={stores} onBack={() => setShowNfcPages(false)} />;
  }

  // ── LISTA DE PESQUISAS ─────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pesquisas</h2>
          <p className="text-sm text-slate-500 mt-1">Crie e gerencie pesquisas para clientes e funcionários</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNfcPages(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all"
          >
            <Smartphone size={16} /> Páginas NFC
          </button>
          <button
            onClick={() => handleOpenEditor()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-200 dark:shadow-none"
          >
            <Plus size={16} /> Nova pesquisa
          </button>
        </div>
      </div>

      {/* Busca + stats */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar pesquisas..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">{surveys.length}</span> total
          </div>
          <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="font-semibold text-slate-900 dark:text-white">{surveys.filter(s => s.is_active).length}</span> ativas
          </div>
          <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">
              {surveys.filter(s => (s as any).order_status === 'generated').length}
            </span> pedidos
          </div>
        </div>
      </div>

      {/* Filtros em chips compactos horizontais */}
      <div className="flex flex-col gap-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm">
        {/* Público */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs font-semibold text-slate-400 w-16 flex-shrink-0">Público:</span>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap scroll-smooth">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'external', label: 'Clientes' },
              { id: 'internal', label: 'Funcionários' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setFilterTarget(item.id as any)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all ${
                  filterTarget === item.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {item.label} {filterTarget === item.id && '✓'}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs font-semibold text-slate-400 w-16 flex-shrink-0">Status:</span>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap scroll-smooth">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'active', label: 'Ativas' },
              { id: 'inactive', label: 'Inativas' },
              { id: 'ordered', label: '🛒 Pedido Gerado' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setFilterStatus(item.id as any)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all ${
                  filterStatus === item.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {item.label} {filterStatus === item.id && '✓'}
              </button>
            ))}
          </div>
        </div>

        {/* Loja */}
        {stores && stores.length > 0 && (
          <div className="flex items-center gap-2 overflow-hidden border-t border-slate-100 dark:border-slate-800 pt-2.5">
            <span className="text-xs font-semibold text-slate-400 w-16 flex-shrink-0">Loja:</span>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap scroll-smooth">
              <button
                onClick={() => setFilterStoreId('all')}
                className={`w-9 h-9 flex-shrink-0 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center ${
                  filterStoreId === 'all'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-blue-300'
                }`}
              >
                Tds
              </button>
              {stores.map(store => (
                <button
                  key={store.id}
                  onClick={() => setFilterStoreId(filterStoreId === store.id ? 'all' : store.id)}
                  className={`w-9 h-9 flex-shrink-0 rounded-lg border text-xs font-semibold transition-all ${
                    filterStoreId === store.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-blue-300'
                  }`}
                  title={store.name}
                >
                  {store.number}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
            ))
          : filteredSurveys.length === 0
          ? (
            <div className="col-span-full py-16 text-center">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <Search size={24} className="text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhuma pesquisa encontrada</p>
              <p className="text-sm text-slate-400 mt-1">Crie sua primeira pesquisa clicando em "Nova pesquisa"</p>
            </div>
          )
          : filteredSurveys.map(survey => (
            <motion.div
              key={survey.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-none transition-all flex flex-col"
            >
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                      survey.target_type === 'external'
                        ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800'
                        : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'
                    }`}>
                      {survey.target_type === 'external' ? 'Clientes' : 'Interno'}
                    </span>
                    {!survey.is_active && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-md dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400">
                        Inativa
                      </span>
                    )}
                    {(survey as any).order_status === 'generated' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-600 border border-green-100 rounded-md dark:bg-green-950/20 dark:border-green-900 dark:text-green-400">
                        🛒 Pedido
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleToggleActive(e, survey)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex-shrink-0 ${
                      survey.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600'
                        : 'bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-700'
                    }`}
                  >
                    {survey.is_active ? 'Ativa' : 'Inativa'}
                  </button>
                </div>

                <h3 className="font-semibold text-slate-900 dark:text-white leading-snug mb-1 line-clamp-2">
                  {(survey as any).numero && (
                    <span className="text-xs font-bold text-blue-600 mr-1.5">
                      #{(survey as any).numero}
                    </span>
                  )}
                  {survey.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {survey.description || 'Sem descrição'}
                </p>
              </div>

              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      if (survey.public_token) {
                        navigator.clipboard.writeText('https://www.realadmin.com.br/pesquisa/' + survey.public_token);
                        toast.success('Link copiado!');
                      }
                    }}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-green-600 hover:border-green-200 transition-all"
                    title="Copiar link"
                  >
                    <Link size={15} />
                  </button>
                  <button
                    onClick={() => handleOpenEditor(survey)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all"
                    title="Editar"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setDuplicatingSurvey(survey);
                      setDuplicateTargetStoreIds([]);
                    }}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-purple-600 hover:border-purple-200 transition-all"
                    title="Duplicar para outra loja"
                  >
                    <Copy size={15} />
                  </button>
                  {confirmDeleteId === survey.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(survey.id)}
                        className="px-2 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 transition-all"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(survey.id)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:border-red-200 transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => onShowResults && onShowResults(survey)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-600 dark:hover:text-white transition-all"
                >
                  <BarChart3 size={14} /> Resultados
                </button>
              </div>
            </motion.div>
          ))
        }
      </div>

      {/* Modal Simples de Duplicação */}
      <AnimatePresence>
        {duplicatingSurvey && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isDuplicating) {
                  setDuplicatingSurvey(null);
                  setDuplicateTargetStoreIds([]);
                }
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl w-full max-w-md z-10 flex flex-col gap-4"
            >
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Copy size={20} className="text-blue-500" />
                  Duplicar pesquisa
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Selecione as lojas de destino para a cópia de "{duplicatingSurvey.title}".
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 block">Lojas de Destino</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {stores.map(store => {
                    const isSelected = duplicateTargetStoreIds.includes(store.id);
                    return (
                      <button
                        key={store.id}
                        type="button"
                        disabled={isDuplicating}
                        onClick={() => {
                          setDuplicateTargetStoreIds(prev =>
                            prev.includes(store.id) ? prev.filter(s => s !== store.id) : [...prev, store.id]
                          );
                        }}
                        className={`p-3 rounded-xl border text-left text-xs font-medium transition-all flex flex-col justify-between relative ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 dark:hover:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>Loja {store.number}</span>
                          {isSelected && <Check size={14} className="text-blue-600 dark:text-blue-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5 truncate w-full">{store.city}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isDuplicating}
                  onClick={() => {
                    setDuplicatingSurvey(null);
                    setDuplicateTargetStoreIds([]);
                  }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={duplicateTargetStoreIds.length === 0 || isDuplicating}
                  onClick={handleDuplicate}
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-semibold transition-all shadow-md flex items-center justify-center gap-1.5 min-w-[120px]"
                >
                  {isDuplicating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Duplicando...</span>
                    </>
                  ) : (
                    <span>
                      {duplicateTargetStoreIds.length === 0
                        ? 'Duplicar'
                        : `Duplicar para ${duplicateTargetStoreIds.length} loja${duplicateTargetStoreIds.length > 1 ? 's' : ''}`}
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminSurveyManagement;
