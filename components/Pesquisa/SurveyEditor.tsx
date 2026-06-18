import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ensureSession } from '../../services/authService';
import { toast } from 'sonner';
import {
  Plus, X, Save, ChevronRight, ChevronLeft, Check, Trash,
  ShieldAlert, UserCheck, Users, Copy, Eye, Loader2,
  Camera, ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Survey, SurveyQuestion, SurveyTargetType, SurveyTargetCategory,
  SurveyResultVisibility, Store, User
} from '../../types';

const QUESTION_TYPES = [
  { value: 'short_text',      label: 'Texto livre' },
  { value: 'rating',          label: 'Avaliação (1-5 estrelas)' },
  { value: 'yes_no',          label: 'Sim / Não' },
  { value: 'multiple_choice', label: 'Múltipla escolha' },
  { value: 'product_item',    label: '📦 Pesquisa de Item' },
];

const PRODUCT_CATEGORIES = [
  { value: 'masculino',  label: 'Masculino' },
  { value: 'feminino',   label: 'Feminino' },
  { value: 'infantil',   label: 'Infantil' },
  { value: 'acessorio',  label: 'Acessório' },
];

const generateToken = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

const emptyQuestion = (order: number): Partial<SurveyQuestion> => ({
  question_text: '',
  question_type: 'short_text',
  is_required: true,
  sort_order: order,
  options: [],
});

const calcPrecoVenda = (custo: number, markup: number): number => {
  if (!custo || !markup || custo <= 0 || markup <= 0) return 0;
  const valorBase = custo * markup;
  const dezena = Math.floor(valorBase / 10) * 10;
  return valorBase < dezena + 5 ? dezena + 9.99 : dezena + 19.99;
};

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
  const [savedSurveyId, setSavedSurveyId] = useState<string | null>(editingSurvey?.id || null);

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
  const [uploadingPhotoIdx, setUploadingPhotoIdx] = useState<number | null>(null);
  const [tipoSuggestions, setTipoSuggestions] = useState<string[]>([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);

  // ── Lojas: fallback próprio se prop vier vazio ─────────────────────────────
  const [localStores, setLocalStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);

  useEffect(() => {
    if (!stores || stores.length === 0) {
      fetchLocalStores();
    }
  }, []);

  const fetchLocalStores = async () => {
    setLoadingStores(true);
    try {
      await ensureSession();
      const { data } = await supabase
        .from('stores')
        .select('id, number, name, city')
        .order('number', { ascending: true });
      if (data) setLocalStores(data as Store[]);
    } catch (err) {
      console.error('Erro ao buscar lojas:', err);
    } finally {
      setLoadingStores(false);
    }
  };

  // Usa o prop se disponível, senão usa o fetch local
  const effectiveStores = (stores && stores.length > 0) ? stores : localStores;

  // Navegação Enter entre campos do produto
  const focusNextProductField = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const card = (e.currentTarget as HTMLElement).closest('[data-question-card]');
    if (!card) return;
    const fields = Array.from(card.querySelectorAll<HTMLElement>('[data-product-nav]'));
    const currentIdx = fields.indexOf(e.currentTarget as HTMLElement);
    const next = fields[currentIdx + 1];
    if (next) next.focus();
  };

  const searchTipos = async (term: string) => {
    if (term.length < 2) {
      setTipoSuggestions([]);
      return;
    }
    try {
      const { data } = await supabase
        .from('buy_order_items')
        .select('tipo')
        .ilike('tipo', `%${term}%`)
        .not('tipo', 'is', null)
        .limit(50);
      
      if (data) {
        const unique = [...new Set(data.map(d => d.tipo).filter(Boolean))] as string[];
        unique.sort((a, b) => {
          const aStarts = a.toLowerCase().startsWith(term.toLowerCase()) ? 0 : 1;
          const bStarts = b.toLowerCase().startsWith(term.toLowerCase()) ? 0 : 1;
          return aStarts - bStarts || a.localeCompare(b);
        });
        setTipoSuggestions(unique.slice(0, 8));
      }
    } catch {}
  };

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
      if (field === 'question_type') {
        if (value === 'product_item') {
          next[idx].options = {} as any;
          next[idx].question_text = 'Deseja este produto?';
        } else if (value !== 'multiple_choice') {
          next[idx].options = [];
        }
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

  const autoSaveSurvey = async (): Promise<string | null> => {
    if (savedSurveyId) return savedSurveyId;
    
    try {
      await ensureSession();
      const slug = (title || 'pesquisa-rascunho')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-') + '-' + Date.now();

      const { data, error } = await supabase
        .from('surveys')
        .insert([{
          title: title || 'Pesquisa (rascunho)',
          description,
          is_active: false,
          allow_anonymous: allowAnonymous,
          target_type: targetType,
          target_category: targetType === 'internal' ? targetCategory : null,
          results_visible_to: resultsVisibleTo,
          store_id: (currentUser as any).store_id || (currentUser as any).storeId || null,
          target_store_ids: targetStoreIds.length > 0 ? targetStoreIds : null,
          created_by: currentUser.id,
          slug,
          public_token: generateToken(),
        }])
        .select()
        .single();

      if (error) throw error;
      setSavedSurveyId(data.id);
      toast.success('Pesquisa salva como rascunho');
      return data.id;
    } catch (err: any) {
      toast.error('Erro ao criar rascunho: ' + err.message);
      return null;
    }
  };

  const handleProductPhotoUpload = async (file: File, idx: number) => {
    setUploadingPhotoIdx(idx);
    try {
      // Auto-salvar pesquisa se ainda não tem ID
      const surveyId = await autoSaveSurvey();
      if (!surveyId) {
        toast.error('Não foi possível salvar a pesquisa');
        setUploadingPhotoIdx(null);
        return;
      }
      
      await ensureSession();
      const q = questions[idx];
      const productData = q.options as any || {};
      const ref = (productData.referencia || 'item').toLowerCase().replace(/\s+/g, '-');
      const timestamp = Date.now();
      const path = `${surveyId}/${timestamp}_${ref}.webp`;

      // Converter para webp com resize
      const bitmap = await createImageBitmap(file);
      const maxW = 800;
      const scale = bitmap.width > maxW ? maxW / bitmap.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width * scale;
      canvas.height = bitmap.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(b => resolve(b!), 'image/webp', 0.8);
      });

      const { error: upErr } = await supabase.storage
        .from('Pesquisa')
        .upload(path, blob, { contentType: 'image/webp', upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('Pesquisa').getPublicUrl(path);
      const imageUrl = urlData.publicUrl;

      // Salvar na tabela survey_photos
      const { data: photoRow, error: phErr } = await supabase
        .from('survey_photos')
        .insert({
          survey_id: surveyId,
          marca: productData.marca || null,
          referencia: productData.referencia || null,
          cor: productData.cor || null,
          descricao: productData.descricao || null,
          preco_custo: productData.preco_custo ? parseFloat(productData.preco_custo) : null,
          preco_venda: productData.preco_venda ? parseFloat(productData.preco_venda) : null,
          image_url: imageUrl,
          sort_order: idx,
          created_by: currentUser.id,
        })
        .select()
        .single();
      if (phErr) throw phErr;

      // Atualizar a question com a URL e photo_id no options
      updateQuestion(idx, 'options', { ...productData, image_url: imageUrl, photo_id: photoRow.id });
      
      toast.success('Foto enviada!');
    } catch (err: any) {
      toast.error('Erro no upload: ' + err.message);
    } finally {
      setUploadingPhotoIdx(null);
    }
  };

  const handleRemoveProductPhoto = async (idx: number) => {
    const q = questions[idx];
    const productData = q.options as any || {};
    if (productData.photo_id) {
      try {
        await supabase.from('survey_photos').delete().eq('id', productData.photo_id);
      } catch {}
    }
    updateQuestion(idx, 'options', { ...productData, image_url: null, photo_id: null });
  };

  const handleToggleQuestionActive = async (question: Partial<SurveyQuestion>, idx: number) => {
    const newValue = question.is_active === false ? true : false;
    if (question.id) {
      try {
        await supabase
          .from('survey_questions')
          .update({ is_active: newValue, updated_at: new Date().toISOString() })
          .eq('id', question.id);
      } catch (err) {
        console.error('Erro ao atualizar status da pergunta:', err);
      }
    }
    setQuestions(prev => prev.map((q, i) => 
      i === idx ? { ...q, is_active: newValue } : q
    ));
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
        updated_at: new Date().toISOString(),
      };

      // Campos que só entram na criação (INSERT)
      if (!savedSurveyId && !editingSurvey) {
        surveyData.store_id = (currentUser as any).store_id || (currentUser as any).storeId || null;
        surveyData.created_by = currentUser.id;
      }

      let surveyId = savedSurveyId || editingSurvey?.id;

      if (surveyId) {
        const { error } = await supabase.from('surveys').update(surveyData).eq('id', surveyId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('surveys').insert([{ ...surveyData, slug, public_token: generateToken() }]).select().single();
        if (error) throw error;
        surveyId = data.id;
      }

      // Salvar perguntas
      const keptIds: string[] = [];

      for (const [idx, q] of questions.entries()) {
        const rawPhotoId = (q as any).photo_id || (q.options as any)?.photo_id;
        const photoId = rawPhotoId?.length === 36 ? rawPhotoId : undefined;

        const qData: any = {
          survey_id: surveyId,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options || [],
          is_required: q.is_required ?? true,
          is_active: q.is_active !== false,
          sort_order: idx,
          ...(photoId ? { photo_id: photoId } : {}),
        };

        if ((q as any).id) {
          // Pergunta existente → UPDATE (preserva FK da foto)
          await supabase
            .from('survey_questions')
            .update(qData)
            .eq('id', (q as any).id);
          keptIds.push((q as any).id);
        } else {
          // Pergunta nova → INSERT
          const { data: newQ, error: inErr } = await supabase
            .from('survey_questions')
            .insert(qData)
            .select('id')
            .single();
          if (inErr) throw inErr;
          if (newQ) keptIds.push(newQ.id);
        }
      }

      // Deleta só as perguntas que o usuário removeu
      if (keptIds.length > 0) {
        await supabase
          .from('survey_questions')
          .delete()
          .eq('survey_id', surveyId)
          .not('id', 'in', `(${keptIds.join(',')})`);
      } else {
        await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
      }

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
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">

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
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">

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

                    {/* Lojas alvo */}
                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Lojas alvo
                        <span className="text-xs text-slate-400 ml-2">
                          {targetStoreIds.length === 0
                            ? '(todas as lojas)'
                            : `(${targetStoreIds.length} selecionada${targetStoreIds.length > 1 ? 's' : ''})`}
                        </span>
                      </label>

                      {loadingStores ? (
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                          <Loader2 size={13} className="animate-spin" /> Carregando lojas...
                        </div>
                      ) : effectiveStores.length === 0 ? (
                        <p className="text-xs text-slate-400 mt-2">Nenhuma loja disponível.</p>
                      ) : (
                        <>
                          {/* Botão Todas */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setTargetStoreIds([])}
                              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                                targetStoreIds.length === 0
                                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:border-slate-300'
                              }`}
                            >
                              Todas
                            </button>

                            {/* Botões individuais por loja */}
                            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
                              {effectiveStores.map(store => (
                                <button
                                  key={store.id}
                                  type="button"
                                  onClick={() => toggleStore(store.id)}
                                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all flex items-center gap-1 ${
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
                        </>
                      )}
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
                          data-question-card
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden group hover:border-blue-300 dark:hover:border-blue-700 transition-all ${
                            q.is_active === false ? 'opacity-50' : ''
                          }`}
                        >
                          {/* Linha superior */}
                          <div className="flex items-start gap-3 p-4">
                            <span className="text-xs text-slate-400 font-medium mt-1 w-5 flex-shrink-0 text-center">{idx + 1}</span>
                            <input
                              type="text"
                              value={q.question_text || ''}
                              onChange={e => updateQuestion(idx, 'question_text', e.target.value)}
                              placeholder="Digite a pergunta..."
                              className={`flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400 min-w-0 ${
                                q.is_active === false ? 'line-through text-slate-400' : ''
                              }`}
                            />
                            <select
                              value={q.question_type || 'short_text'}
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

                          {q.question_type === 'product_item' && (
                            <div className="px-4 pb-4 pl-12 space-y-3">
                              {/* Título automático */}
                              {!q.question_text && (() => {
                                // Auto-preencher a pergunta se vazio
                                setTimeout(() => updateQuestion(idx, 'question_text', 'Deseja este produto?'), 0);
                                return null;
                              })()}

                              {/* Linha 1: Marca + Referência */}
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  data-product-nav
                                  onKeyDown={focusNextProductField}
                                  type="text"
                                  placeholder="Marca"
                                  value={(q.options as any)?.marca || ''}
                                  onChange={e => updateQuestion(idx, 'options', { ...(q.options as any || {}), marca: e.target.value })}
                                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400"
                                />
                                <input
                                  data-product-nav
                                  onKeyDown={focusNextProductField}
                                  type="text"
                                  placeholder="Referência"
                                  value={(q.options as any)?.referencia || ''}
                                  onChange={e => updateQuestion(idx, 'options', { ...(q.options as any || {}), referencia: e.target.value })}
                                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400"
                                />
                              </div>

                              {/* Linha 2: Cor 1 + Cor 2 + Cor 3 */}
                              <div className="grid grid-cols-3 gap-2">
                                <input
                                  data-product-nav
                                  onKeyDown={focusNextProductField}
                                  type="text"
                                  placeholder="Cor 1 (principal)"
                                  value={(q.options as any)?.cor1 || ''}
                                  onChange={e => updateQuestion(idx, 'options', { ...(q.options as any || {}), cor1: e.target.value })}
                                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400"
                                />
                                <input
                                  data-product-nav
                                  onKeyDown={focusNextProductField}
                                  type="text"
                                  placeholder="Cor 2 (opcional)"
                                  value={(q.options as any)?.cor2 || ''}
                                  onChange={e => updateQuestion(idx, 'options', { ...(q.options as any || {}), cor2: e.target.value })}
                                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400"
                                />
                                <input
                                  data-product-nav
                                  onKeyDown={focusNextProductField}
                                  type="text"
                                  placeholder="Cor 3 (opcional)"
                                  value={(q.options as any)?.cor3 || ''}
                                  onChange={e => updateQuestion(idx, 'options', { ...(q.options as any || {}), cor3: e.target.value })}
                                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400"
                                />
                              </div>

                              {/* Linha 3: Custo + Markup + Venda (MANTER EXATAMENTE COMO ESTÁ) */}
                              <div className="grid grid-cols-3 gap-2">
                                {/* Custo */}
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">R$</span>
                                  <input
                                    data-product-nav
                                    onKeyDown={focusNextProductField}
                                    type="number"
                                    step="0.01"
                                    placeholder="Custo"
                                    value={(q.options as any)?.preco_custo || ''}
                                    onChange={e => {
                                      const custo = parseFloat(e.target.value) || 0;
                                      const markup = parseFloat((q.options as any)?.markup) || 0;
                                      const venda = calcPrecoVenda(custo, markup);
                                      updateQuestion(idx, 'options', { 
                                        ...(q.options as any || {}), 
                                        preco_custo: e.target.value,
                                        ...(venda > 0 ? { preco_venda: venda.toFixed(2) } : {})
                                      });
                                    }}
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">custo</span>
                                </div>

                                {/* Markup */}
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">×</span>
                                  <input
                                    data-product-nav
                                    onKeyDown={focusNextProductField}
                                    type="number"
                                    step="0.01"
                                    placeholder="Markup"
                                    value={(q.options as any)?.markup || ''}
                                    onChange={e => {
                                      const markup = parseFloat(e.target.value) || 0;
                                      const custo = parseFloat((q.options as any)?.preco_custo) || 0;
                                      const venda = calcPrecoVenda(custo, markup);
                                      updateQuestion(idx, 'options', { 
                                        ...(q.options as any || {}), 
                                        markup: e.target.value,
                                        ...(venda > 0 ? { preco_venda: venda.toFixed(2) } : {})
                                      });
                                    }}
                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">markup</span>
                                </div>

                                {/* Venda (auto-calculado, editável) */}
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-green-500 font-medium">R$</span>
                                  <input
                                    data-product-nav
                                    onKeyDown={focusNextProductField}
                                    type="number"
                                    step="0.01"
                                    placeholder="Venda"
                                    value={(q.options as any)?.preco_venda || ''}
                                    onChange={e => updateQuestion(idx, 'options', { ...(q.options as any || {}), preco_venda: e.target.value })}
                                    className="w-full pl-8 pr-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-700 dark:text-green-400 outline-none focus:border-green-400 font-bold"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-green-500">venda</span>
                                </div>
                              </div>

                              {/* Linha 4: Descrição com autocomplete */}
                              <div className="relative">
                                <input
                                  data-product-nav
                                  type="text"
                                  placeholder="Descrição do item (ex: CHINELO MASCULINO)"
                                  value={(q.options as any)?.descricao || ''}
                                  onChange={e => {
                                    updateQuestion(idx, 'options', { ...(q.options as any || {}), descricao: e.target.value });
                                    setActiveSuggestionIdx(idx);
                                    searchTipos(e.target.value);
                                  }}
                                  onFocus={() => {
                                    const val = (q.options as any)?.descricao || '';
                                    if (val.length >= 2) {
                                      setActiveSuggestionIdx(idx);
                                      searchTipos(val);
                                    }
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setActiveSuggestionIdx(null);
                                      setTipoSuggestions([]);
                                    }, 200);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      if (tipoSuggestions.length > 0 && activeSuggestionIdx === idx) {
                                        // Seleciona primeira sugestão do autocomplete
                                        e.preventDefault();
                                        updateQuestion(idx, 'options', {
                                          ...(q.options as any || {}),
                                          descricao: tipoSuggestions[0],
                                        });
                                        setTipoSuggestions([]);
                                        setActiveSuggestionIdx(null);
                                      } else {
                                        // Último campo — não navega mais
                                        e.preventDefault();
                                      }
                                    }
                                  }}
                                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400"
                                />
                                {activeSuggestionIdx === idx && tipoSuggestions.length > 0 && (
                                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                    {tipoSuggestions.map((sugestao, i) => (
                                      <button
                                        key={i}
                                        type="button"
                                        onMouseDown={e => {
                                          e.preventDefault();
                                          updateQuestion(idx, 'options', { ...(q.options as any || {}), descricao: sugestao });
                                          setTipoSuggestions([]);
                                          setActiveSuggestionIdx(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 transition-all border-b border-slate-50 dark:border-slate-800 last:border-0"
                                      >
                                        {sugestao}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Categoria */}
                              <div>
                                <label className="text-[10px] font-semibold text-slate-400 mb-1 block">Categoria</label>
                                <div className="flex gap-1.5 flex-wrap">
                                  {PRODUCT_CATEGORIES.map(cat => (
                                    <button
                                      key={cat.value}
                                      type="button"
                                      onClick={() => updateQuestion(idx, 'options', { ...(q.options as any || {}), categoria: cat.value })}
                                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                        (q.options as any)?.categoria === cat.value
                                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-slate-300'
                                      }`}
                                    >
                                      {cat.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Upload de foto */}
                              <div>
                                <label className="text-[10px] font-semibold text-slate-400 mb-1 block">Foto do Produto</label>
                                {(q.options as any)?.image_url ? (
                                  <div className="relative inline-block">
                                    <img
                                      src={(q.options as any).image_url}
                                      alt="Produto"
                                      className="w-32 h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                                      referrerPolicy="no-referrer"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveProductPhoto(idx)}
                                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow-lg"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                                    uploadingPhotoIdx === idx
                                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}>
                                    {uploadingPhotoIdx === idx ? (
                                      <div className="flex items-center gap-2 text-blue-500">
                                        <Loader2 size={20} className="animate-spin" />
                                        <span className="text-xs font-medium">Enviando...</span>
                                      </div>
                                    ) : (
                                      <>
                                        <Camera size={24} className="text-slate-400 mb-1" />
                                        <span className="text-xs text-slate-400">Tirar foto ou escolher arquivo</span>
                                      </>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      className="hidden"
                                      disabled={uploadingPhotoIdx === idx}
                                      onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleProductPhotoUpload(file, idx);
                                        }
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
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
                            <div className="flex items-center gap-2">
                              {/* Toggle Ativo/Inativo */}
                              <button
                                type="button"
                                onClick={() => handleToggleQuestionActive(q, idx)}
                                className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                                  q.is_active !== false
                                    ? 'bg-green-500' 
                                    : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                title={q.is_active !== false ? 'Desativar pergunta' : 'Ativar pergunta'}
                              >
                                <span className={`inline-block w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                                  q.is_active !== false ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </button>

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
          <aside className="hidden lg:flex flex-col w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 gap-4 overflow-y-auto">
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
                    {q.question_type === 'yes_no' && (
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-400">Sim</span>
                        <span className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-400">Não</span>
                      </div>
                    )}
                    {q.question_type === 'short_text' && (
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

                    {q.question_type === 'product_item' && (
                      <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-1.5">
                        {(q.options as any)?.image_url ? (
                          <img src={(q.options as any).image_url} alt="" className="w-full h-20 object-cover rounded-md" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-16 bg-slate-100 dark:bg-slate-600 rounded-md flex items-center justify-center">
                            <ImageIcon size={16} className="text-slate-400" />
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            {(q.options as any)?.marca || 'Marca'}
                          </span>
                          <div className="flex gap-2">
                            {(q.options as any)?.preco_custo && (
                              <span className="text-[10px] text-slate-400">
                                C: R$ {(q.options as any).preco_custo}
                              </span>
                            )}
                            {(q.options as any)?.preco_venda && (
                              <span className="text-[10px] text-green-600 font-medium">
                                V: R$ {(q.options as any).preco_venda}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 dark:bg-slate-600 dark:text-blue-300 rounded">{(q.options as any)?.categoria || '...'}</span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {[(q.options as any)?.cor1 || (q.options as any)?.cor, (q.options as any)?.cor2, (q.options as any)?.cor3].filter(Boolean).join(' / ') || ''}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] px-2 py-1 border border-slate-200 rounded-lg text-slate-400">Sim</span>
                          <span className="text-[10px] px-2 py-1 border border-slate-200 rounded-lg text-slate-400">Não</span>
                        </div>
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

export default SurveyEditor;
