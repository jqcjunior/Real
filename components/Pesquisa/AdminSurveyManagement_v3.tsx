import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ensureSession } from '../../services/authService';
import { toast } from 'sonner';
import {
  Plus, Search, Edit3, Trash2, Link, BarChart3, X, Save,
  ChevronRight, ChevronLeft, Check, PlusCircle, Trash,
  GripVertical, ShieldAlert, UserCheck, Users, Smartphone,
  Copy, ToggleLeft, ToggleRight, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NfcPagesManager from './NfcPagesManager';
import {
  Survey, SurveyQuestion, SurveyTargetType, SurveyTargetCategory,
  SurveyResultVisibility, Store, User
} from '../../types';

interface AdminSurveyManagementProps {
  currentUser: User;
  stores: Store[];
  onShowResults?: (survey: Survey) => void;
}

const QUESTION_TYPES = [
  { value: 'text',            label: 'Texto livre' },
  { value: 'rating',          label: 'Avaliação (1-5 estrelas)' },
  { value: 'boolean',         label: 'Sim / Não' },
  { value: 'multiple_choice', label: 'Múltipla escolha' },
];

const emptyQuestion = (order: number): Partial<SurveyQuestion> => ({
  question_text: '',
  question_type: 'text',
  is_required: true,
  sort_order: order,
  options: [],
});

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
    if (!confirm('Excluir esta pesquisa?')) return;
    try {
      await ensureSession();
      await supabase.from('survey_questions').delete().eq('survey_id', id);
      await supabase.from('survey_responses').delete().eq('survey_id', id);
      await supabase.from('survey_analytics').delete().eq('survey_id', id);
      const { error } = await supabase.from('surveys').delete().eq('id', id);
      if (error) throw error;
      toast.success('Pesquisa excluída');
      fetchSurveys();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const handleToggleActive = async (survey: Survey) => {
    try {
      await ensureSession();
      await supabase.from('surveys').update({ is_active: !survey.is_active }).eq('id', survey.id);
      fetchSurveys();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSurveys = surveys.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
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
        </div>
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
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                    survey.target_type === 'external'
                      ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800'
                      : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'
                  }`}>
                    {survey.target_type === 'external' ? 'Clientes' : 'Interno'}
                  </span>
                  <button
                    onClick={() => handleToggleActive(survey)}
                    className={`flex-shrink-0 transition-colors ${survey.is_active ? 'text-green-500' : 'text-slate-300'}`}
                    title={survey.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {survey.is_active
                      ? <ToggleRight size={22} />
                      : <ToggleLeft size={22} />}
                  </button>
                </div>

                <h3 className="font-semibold text-slate-900 dark:text-white leading-snug mb-1 line-clamp-2">
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
                    onClick={() => handleDelete(survey.id)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:border-red-200 transition-all"
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR — Wizard 3 etapas
// ─────────────────────────────────────────────────────────────────────────────
interface SurveyEditorProps {
  currentUser: User;
  stores: Store[];
  editingSurvey: Survey | null;
  onClose: () => void;
}

const SurveyEditor: React.FC<SurveyEditorProps> = ({
  currentUser, stores, editingSurvey, onClose
}) => {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1
  const [title, setTitle] = useState(editingSurvey?.title || '');
  const [description, setDescription] = useState(editingSurvey?.description || '');
  const [isActive, setIsActive] = useState(editingSurvey?.is_active ?? true);
  const [allowAnonymous, setAllowAnonymous] = useState<boolean>(
    (editingSurvey as any)?.allow_anonymous ?? true
  );

  // Step 2
  const [targetType, setTargetType] = useState<SurveyTargetType>(
    editingSurvey?.target_type || 'external'
  );
  const [targetCategory, setTargetCategory] = useState<SurveyTargetCategory>(
    editingSurvey?.target_category || 'all_managers'
  );
  const [targetStoreIds, setTargetStoreIds] = useState<string[]>(
    editingSurvey?.target_store_ids || []
  );
  const [resultsVisibleTo, setResultsVisibleTo] = useState<SurveyResultVisibility[]>(
    editingSurvey?.results_visible_to || ['admin']
  );

  // Step 3
  const [questions, setQuestions] = useState<Partial<SurveyQuestion>[]>([]);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);

  useEffect(() => {
    if (editingSurvey && !questionsLoaded) {
      loadQuestions(editingSurvey.id);
    } else if (!editingSurvey && !questionsLoaded) {
      setQuestions([emptyQuestion(0)]);
      setQuestionsLoaded(true);
    }
  }, [editingSurvey]);

  const loadQuestions = async (surveyId: string) => {
    try {
      const { data } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('sort_order', { ascending: true });
      setQuestions(data && data.length > 0 ? data : [emptyQuestion(0)]);
    } catch (err) {
      setQuestions([emptyQuestion(0)]);
    } finally {
      setQuestionsLoaded(true);
    }
  };

  const toggleStore = (id: string) => {
    setTargetStoreIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleVisibility = (v: SurveyResultVisibility) => {
    if (v === 'admin') return;
    setResultsVisibleTo(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, emptyQuestion(prev.length)]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: keyof SurveyQuestion, value: any) => {
    setQuestions(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'question_type' && value !== 'multiple_choice') {
        next[idx].options = [];
      }
      return next;
    });
  };

  const duplicateQuestion = (idx: number) => {
    setQuestions(prev => {
      const copy = { ...prev[idx], id: undefined };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const canGoNext = () => {
    if (step === 1) return title.trim().length > 0;
    if (step === 2) return true;
    if (step === 3) return questions.length > 0 && questions.every(q => q.question_text?.trim());
    return false;
  };

  const handleSave = async () => {
    if (!canGoNext()) return;
    setIsSaving(true);
    try {
      await ensureSession();

      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-') + '-' + Date.now();

      const surveyData: any = {
        title,
        description,
        is_active: isActive,
        allow_anonymous: allowAnonymous,
        target_type: targetType,
        target_category: targetType === 'internal' ? targetCategory : null,
        target_store_ids: targetStoreIds.length > 0 ? targetStoreIds : null,
        results_visible_to: resultsVisibleTo,
        store_id: (currentUser as any).store_id || (currentUser as any).storeId || null,
        created_by: currentUser.id,
      };

      let surveyId = editingSurvey?.id;

      if (editingSurvey) {
        const { error } = await supabase.from('surveys').update(surveyData).eq('id', editingSurvey.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('surveys').insert([{ ...surveyData, slug }]).select().single();
        if (error) throw error;
        surveyId = data.id;
      }

      // Salvar perguntas
      await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
      const questionsToInsert = questions.map((q, idx) => ({
        survey_id: surveyId,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options || [],
        is_required: q.is_required ?? true,
        sort_order: idx,
      }));
      const { error: qError } = await supabase.from('survey_questions').insert(questionsToInsert);
      if (qError) throw qError;

      toast.success(editingSurvey ? 'Pesquisa atualizada!' : 'Pesquisa criada!');
      onClose();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  const steps = ['Informações', 'Direcionamento', 'Perguntas'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">

      {/* ── HEADER DO EDITOR ── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 flex items-center gap-4 sticky top-0 z-40">
        <button
          onClick={onClose}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex-shrink-0"
        >
          <X size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base truncate">
            {editingSurvey ? 'Editar pesquisa' : 'Nova pesquisa'}
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block">
            {title || 'Sem título'}
          </p>
        </div>

        {/* Stepper compacto */}
        <div className="hidden sm:flex items-center gap-1">
          {steps.map((s, i) => {
            const n = i + 1;
            const isDone = n < step;
            const isActive = n === step;
            return (
              <React.Fragment key={n}>
                <button
                  onClick={() => n <= step && setStep(n)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isDone
                      ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      : 'text-slate-400 cursor-default'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    isActive ? 'bg-white/20' : isDone ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                    {isDone ? <Check size={10} /> : n}
                  </span>
                  {s}
                </button>
                {i < steps.length - 1 && (
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step mobile */}
        <span className="sm:hidden text-xs text-slate-400">
          {step}/{steps.length} · {steps[step - 1]}
        </span>
      </header>

      {/* ── BODY ── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0">

        {/* Coluna principal */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="max-w-2xl mx-auto space-y-6"
            >

              {/* ── STEP 1: INFORMAÇÕES ── */}
              {step === 1 && (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Informações básicas</h2>
                    <p className="text-sm text-slate-500 mt-1">Dê um nome e contexto para a pesquisa</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">
                        Título da pesquisa <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Ex: Pesquisa de satisfação"
                        autoFocus
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">
                        Descrição <span className="text-slate-400 text-xs">(opcional)</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Descreva o objetivo desta pesquisa..."
                        rows={3}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none transition-all resize-none"
                      />
                    </div>

                    {/* Toggles */}
                    <div className="space-y-3 pt-2">
                      <ToggleRow
                        label="Pesquisa ativa"
                        description="Clientes e funcionários podem responder"
                        value={isActive}
                        onChange={setIsActive}
                      />
                      <ToggleRow
                        label="Permitir resposta anônima"
                        description="O respondente pode optar por não se identificar"
                        value={allowAnonymous}
                        onChange={setAllowAnonymous}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ── STEP 2: DIRECIONAMENTO ── */}
              {step === 2 && (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Direcionamento</h2>
                    <p className="text-sm text-slate-500 mt-1">Defina quem vai responder e quem vê os resultados</p>
                  </div>

                  <div className="space-y-5">
                    {/* Tipo */}
                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Quem responderá?</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'external', label: 'Clientes', desc: 'Pesquisa pública via link/QR' },
                          { value: 'internal', label: 'Funcionários', desc: 'Acesso pelo painel interno' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setTargetType(opt.value as SurveyTargetType)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${
                              targetType === opt.value
                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                            }`}
                          >
                            <p className={`font-medium text-sm ${targetType === opt.value ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                              {opt.label}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Categoria (só interno) */}
                    {targetType === 'internal' && (
                      <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Categoria</label>
                        <select
                          value={targetCategory}
                          onChange={e => setTargetCategory(e.target.value as SurveyTargetCategory)}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none transition-all"
                        >
                          <option value="all_managers">Gerentes</option>
                          <option value="all_employees">Funcionários</option>
                          <option value="all_cashiers">Caixas</option>
                        </select>
                      </div>
                    )}

                    {/* Lojas */}
                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Lojas alvo
                        <span className="text-xs text-slate-400 ml-2">
                          {targetStoreIds.length === 0 ? '(todas as lojas)' : `(${targetStoreIds.length} selecionada${targetStoreIds.length > 1 ? 's' : ''})`}
                        </span>
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2 max-h-44 overflow-y-auto pr-1">
                        {stores.map(store => (
                          <button
                            key={store.id}
                            onClick={() => toggleStore(store.id)}
                            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all flex items-center justify-between gap-1 ${
                              targetStoreIds.includes(store.id)
                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            Loja {store.number}
                            {targetStoreIds.includes(store.id) && <Check size={11} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Visibilidade */}
                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Resultados visíveis para</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'admin', label: 'Administradores', icon: ShieldAlert, locked: true },
                          { id: 'store_manager', label: 'Gerente da loja', icon: UserCheck, locked: false },
                          { id: 'respondent', label: 'Respondente', icon: Users, locked: false },
                        ].map(item => (
                          <button
                            key={item.id}
                            disabled={item.locked}
                            onClick={() => toggleVisibility(item.id as SurveyResultVisibility)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                              resultsVisibleTo.includes(item.id as SurveyResultVisibility)
                                ? 'border-slate-800 bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 hover:border-slate-300'
                            } ${item.locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <item.icon size={13} /> {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── STEP 3: PERGUNTAS ── */}
              {step === 3 && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Perguntas</h2>
                      <p className="text-sm text-slate-500 mt-1">{questions.length} pergunta{questions.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={addQuestion}
                      className="flex items-center gap-1.5 px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium transition-all border border-blue-200 dark:border-blue-800"
                    >
                      <Plus size={15} /> Nova pergunta
                    </button>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence>
                      {questions.map((q, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden group hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                        >
                          {/* Linha superior */}
                          <div className="flex items-start gap-3 p-4">
                            <span className="text-xs text-slate-400 font-medium mt-1 w-5 flex-shrink-0 text-center">{idx + 1}</span>
                            <input
                              type="text"
                              value={q.question_text || ''}
                              onChange={e => updateQuestion(idx, 'question_text', e.target.value)}
                              placeholder="Digite a pergunta..."
                              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400 min-w-0"
                            />
                            <select
                              value={q.question_type || 'text'}
                              onChange={e => updateQuestion(idx, 'question_type', e.target.value)}
                              className="flex-shrink-0 text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 outline-none cursor-pointer"
                            >
                              {QUESTION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Opções múltipla escolha */}
                          {q.question_type === 'multiple_choice' && (
                            <div className="px-4 pb-3 pl-12">
                              <input
                                type="text"
                                value={Array.isArray(q.options) ? q.options.join(', ') : ''}
                                onChange={e => updateQuestion(idx, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                placeholder="Opção 1, Opção 2, Opção 3..."
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400 outline-none focus:border-blue-400 transition-all"
                              />
                              <p className="text-[10px] text-slate-400 mt-1">Separe as opções por vírgula</p>
                            </div>
                          )}

                          {/* Linha inferior */}
                          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={q.is_required ?? true}
                                onChange={e => updateQuestion(idx, 'is_required', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                              />
                              <span className="text-xs text-slate-500">Obrigatória</span>
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => duplicateQuestion(idx)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                title="Duplicar"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                onClick={() => removeQuestion(idx)}
                                disabled={questions.length === 1}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-30"
                                title="Remover"
                              >
                                <Trash size={13} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Botão adicionar grande */}
                    <button
                      onClick={addQuestion}
                      className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500 dark:hover:border-blue-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Adicionar pergunta
                    </button>
                  </div>
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </main>

        {/* Preview lateral — só desktop, só step 3 */}
        {step === 3 && (
          <aside className="hidden lg:flex flex-col w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 gap-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
            <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Eye size={13} /> Preview do formulário
            </p>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-4">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{title || 'Título da pesquisa'}</p>
                {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
              </div>
              <div className="space-y-3">
                {questions.filter(q => q.question_text?.trim()).map((q, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {idx + 1}. {q.question_text}
                      {q.is_required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {q.question_type === 'rating' && (
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(i => (
                          <span key={i} className="text-slate-300 text-sm">★</span>
                        ))}
                      </div>
                    )}
                    {q.question_type === 'boolean' && (
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-400">Sim</span>
                        <span className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-400">Não</span>
                      </div>
                    )}
                    {q.question_type === 'text' && (
                      <div className="h-8 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg" />
                    )}
                    {q.question_type === 'multiple_choice' && Array.isArray(q.options) && q.options.length > 0 && (
                      <div className="space-y-1">
                        {q.options.slice(0,3).map((opt, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0" />
                            <span className="text-xs text-slate-500">{opt}</span>
                          </div>
                        ))}
                        {q.options.length > 3 && (
                          <p className="text-[10px] text-slate-400">+{q.options.length - 3} mais</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 flex items-center justify-between gap-3 sticky bottom-0 z-40">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          <ChevronLeft size={16} />
          {step === 1 ? 'Cancelar' : 'Voltar'}
        </button>

        <div className="flex items-center gap-2">
          {/* Indicador mobile */}
          <div className="flex gap-1 sm:hidden">
            {[1,2,3].map(n => (
              <div key={n} className={`w-2 h-2 rounded-full transition-all ${n === step ? 'bg-blue-600' : n < step ? 'bg-blue-200' : 'bg-slate-200'}`} />
            ))}
          </div>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canGoNext()}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                canGoNext()
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 dark:shadow-none'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              Próximo <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving || !canGoNext()}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                !isSaving && canGoNext()
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200 dark:shadow-none'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSaving
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando...</>
                : <><Save size={15} /> Salvar pesquisa</>}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

// ── TOGGLE ROW ──────────────────────────────────────────────────────────────
const ToggleRow: React.FC<{
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}> = ({ label, description, value, onChange }) => (
  <div className="flex items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
    <div>
      <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-1'}`} />
    </button>
  </div>
);

export default AdminSurveyManagement;