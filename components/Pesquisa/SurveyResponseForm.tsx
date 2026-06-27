import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Star, 
  CheckCircle2,
  Loader2,
  Check,
  UserX,
  User,
  Package,
  ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Survey, SurveyQuestion, User as UserType } from '../../types';

interface SurveyResponseFormProps {
  survey: Survey;
  user?: UserType;
  invitationToken?: string;
  onClose: () => void;
  onComplete: () => void;
}

const ACESSORIO_TAMANHOS = ['UN', 'P', 'M', 'G', 'GG'];

const SurveyResponseForm: React.FC<SurveyResponseFormProps> = ({
  survey,
  user,
  invitationToken,
  onClose,
  onComplete,
}) => {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [gradeTemplates, setGradeTemplates] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, any>>({});
  const [respondentInfo, setRespondentInfo] = useState({ name: '', email: '', phone: '' });
  const [respondentRole, setRespondentRole] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Para pesquisa externa começa em -1 (tela de identificação)
  // Para pesquisa interna começa em 0 (primeira pergunta)
  const hasWelcome = !!(survey as any).welcome_message;
  const startStep = hasWelcome ? -2 : (survey.target_type === 'external' ? -1 : 0);
  const [currentStep, setCurrentStep] = useState(startStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, [survey.id]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', survey.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const activeQuestions = (data || []).filter((q: any) => q.is_active !== false);
      setQuestions(activeQuestions);

      const { data: tplData } = await supabase
        .from('survey_grade_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (tplData) setGradeTemplates(tplData);
    } catch (err) {
      console.error('Erro ao buscar perguntas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers({ ...answers, [questionId]: value });
    // Limpar motivo se mudou para SIM
    if (value === 'SIM') {
      const newMotivos = { ...motivos };
      delete newMotivos[questionId];
      setMotivos(newMotivos);
    }
    // Limpar motivo de rating se nota subiu acima de 3
    if (typeof value === 'number' && value > 3) {
      const newMotivos = { ...motivos };
      delete newMotivos[questionId];
      setMotivos(newMotivos);
    }
  };

  const handleChooseAnonymous = () => {
    setIsAnonymous(true);
    setRespondentInfo({ name: '', email: '', phone: '' });
    setCurrentStep(0);
  };

  const handleChooseIdentified = () => {
    setIsAnonymous(false);
    // Não avança ainda — usuário preenche o form
  };

  const canAdvanceFromIdentification = () => {
    if (isAnonymous) return true;
    // Se não anônimo exige pelo menos o nome
    return respondentInfo.name.trim().length > 0;
  };

  const handleSubmit = async () => {
    const missingRequired = questions.filter(q => q.is_required && !answers[q.id]);
    if (missingRequired.length > 0) {
      alert('Por favor, responda todas as perguntas obrigatórias.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalResponses: Record<string, any> = {};
      Object.entries(answers).forEach(([qId, val]) => {
        const question = questions.find(q => q.id === qId);
        
        if (question?.question_type === 'product_item') {
          // Produto: salvar resposta + grade selecionada
          const gradeInfo = grades[qId] || {};
          finalResponses[qId] = {
            value: val,
            grade: val === 'SIM' ? (gradeInfo.tamanhos || {}) : {},
            total_pares: val === 'SIM' ? (gradeInfo.total_pares || 0) : 0,
            ...(val === 'NÃO' && motivos[qId] ? { motivo: motivos[qId] } : {}),
          };
        } else if (val === 'NÃO' && motivos[qId]) {
          finalResponses[qId] = { value: 'NÃO', motivo: motivos[qId] };
        } else if (typeof val === 'number' && val <= 3 && motivos[qId]) {
          finalResponses[qId] = { value: val, motivo: motivos[qId] };
        } else {
          finalResponses[qId] = val;
        }
      });

      const { error: rError } = await supabase
        .from('survey_responses')
        .insert([{
          survey_id: survey.id,
          user_id: user?.id || null,
          store_id: user?.storeId || null,
          responses: finalResponses,
          respondent_name: isAnonymous ? null : (respondentInfo.name || null),
          respondent_email: isAnonymous ? null : (respondentInfo.email || null),
          respondent_phone: isAnonymous ? null : (respondentInfo.phone || null),
          respondent_role: respondentRole || null,
        }]);

      if (rError) throw rError;

      setIsCompleted(true);
      setTimeout(() => { onComplete(); }, 3000);
    } catch (err: any) {
      console.error('Erro ao enviar resposta:', err);
      alert('Erro ao enviar resposta: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── LOADING ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[1100] bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  // ── CONCLUÍDO ─────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="fixed inset-0 z-[1100] bg-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4 max-w-sm w-full"
        >
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={44} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Obrigado por participar!</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            {survey.thank_you_message || 'Sua resposta foi registrada com sucesso e será analisada pela nossa equipe.'}
          </p>
          <div className="pt-4">
            <Loader2 className="animate-spin text-blue-600 mx-auto" size={20} />
            <p className="text-xs text-slate-400 mt-2">Redirecionando...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = currentStep >= 0 ? questions[currentStep] : null;
  const progress = currentStep >= 0 ? ((currentStep + 1) / questions.length) * 100 : 0;
  const isLastStep = currentStep === questions.length - 1;
  const isFirstStep = currentStep === startStep;

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-50 flex flex-col overflow-hidden">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all flex-shrink-0"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 truncate leading-tight">{survey.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentStep === -2
                ? 'Boas-vindas'
                : currentStep >= 0
                  ? `Pergunta ${currentStep + 1} de ${questions.length}`
                  : 'Identificação'}
            </p>
          </div>
        </div>

        {/* Barra de progresso — só durante perguntas */}
        {currentStep >= 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-24 sm:w-36 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-blue-600 rounded-full"
              />
            </div>
            <span className="text-xs font-semibold text-blue-600 w-8 text-right">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </header>

      {/* ── CONTEÚDO ── */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-10 flex items-start justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg"
          >

            {/* ── STEP -2: BOAS-VINDAS ── */}
            {currentStep === -2 && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                    {survey.title}
                  </h2>
                  {survey.description && (
                    <p className="text-sm text-slate-400 mt-1">{survey.description}</p>
                  )}
                  <p className="text-base text-slate-700 dark:text-slate-300 mt-4 leading-relaxed whitespace-pre-line">
                    {(survey as any).welcome_message}
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep(survey.target_type === 'external' ? -1 : 0)}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold rounded-2xl transition-all"
                >
                  Começar →
                </button>
              </div>
            )}

            {/* ── STEP -1: IDENTIFICAÇÃO ── */}
            {currentStep === -1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                    {survey.title}
                  </h2>
                  {survey.description && (
                    <p className="text-sm text-slate-500 mt-1">{survey.description}</p>
                  )}
                  <p className="text-sm text-slate-400 mt-3">Preencha os dados abaixo para participar.</p>
                </div>

                {/* Botão anônimo */}
                {(survey as any).allow_anonymous !== false && (
                  <button
                    onClick={handleChooseAnonymous}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                      isAnonymous
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isAnonymous ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <UserX size={20} />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${isAnonymous ? 'text-blue-700' : 'text-slate-700'}`}>
                        Prefiro não me identificar
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Sua resposta será registrada de forma anônima
                      </p>
                    </div>
                    {isAnonymous && (
                      <Check size={18} className="text-blue-600 ml-auto flex-shrink-0" />
                    )}
                  </button>
                )}

                {/* Separador */}
                {(survey as any).allow_anonymous !== false && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400">ou</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}

                {/* Form de identificação */}
                <div
                  className={`space-y-3 transition-opacity ${isAnonymous ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
                  onClick={() => isAnonymous && setIsAnonymous(false)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} className="text-slate-400" />
                    <span className="text-sm text-slate-500">Identificar-me</span>
                  </div>
                  {/* Cargo */}
                  <select
                    value={respondentRole}
                    onChange={e => {
                      setIsAnonymous(false);
                      setRespondentRole(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-blue-500 rounded-2xl text-sm text-slate-900 outline-none transition-all"
                  >
                    <option value="">Cargo (opcional)</option>
                    <option value="Caixa">Caixa</option>
                    <option value="Cobrança">Cobrança</option>
                    <option value="Estoquista">Estoquista</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Indenização">Indenização</option>
                    <option value="Vendedor">Vendedor</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={respondentInfo.name}
                    onChange={e => {
                      setIsAnonymous(false);
                      setRespondentInfo({ ...respondentInfo, name: e.target.value });
                    }}
                    className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-blue-500 rounded-2xl text-sm text-slate-900 outline-none transition-all"
                  />
                  <input
                    type="email"
                    placeholder="E-mail (opcional)"
                    value={respondentInfo.email}
                    onChange={e => {
                      setIsAnonymous(false);
                      setRespondentInfo({ ...respondentInfo, email: e.target.value });
                    }}
                    className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-blue-500 rounded-2xl text-sm text-slate-900 outline-none transition-all"
                  />
                  <input
                    type="tel"
                    placeholder="Telefone (opcional)"
                    value={respondentInfo.phone}
                    onChange={e => {
                      setIsAnonymous(false);
                      setRespondentInfo({ ...respondentInfo, phone: e.target.value });
                    }}
                    className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-blue-500 rounded-2xl text-sm text-slate-900 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* ── PERGUNTAS ── */}
            {currentStep >= 0 && currentQuestion && (
              <div className="space-y-8">
                {/* Cabeçalho de seção — só aparece quando a seção muda */}
                {(currentQuestion as any).section &&
                 (currentStep === 0 ||
                  (currentQuestion as any).section !== (questions[currentStep - 1] as any)?.section
                 ) && (
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-px flex-1 bg-blue-100 dark:bg-blue-900" />
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400 px-2">
                      {(currentQuestion as any).section}
                    </span>
                    <div className="h-px flex-1 bg-blue-100 dark:bg-blue-900" />
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5 shadow-md shadow-blue-200">
                    {currentStep + 1}
                  </span>
                  <h2 className="text-lg sm:text-2xl font-bold text-slate-900 leading-snug">
                    {currentQuestion.question_text}
                    {currentQuestion.is_required && <span className="text-red-500 ml-1">*</span>}
                  </h2>
                </div>

                <div className="space-y-4">

                  {/* TEXTO */}
                  {currentQuestion.question_type === 'short_text' && (
                    <textarea
                      autoFocus
                      value={answers[currentQuestion.id] || ''}
                      onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Digite sua resposta aqui..."
                      rows={4}
                      className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-white border-2 border-transparent focus:border-blue-600 rounded-2xl text-sm sm:text-base text-slate-900 outline-none shadow-md shadow-slate-100 transition-all resize-none"
                    />
                  )}

                  {/* RATING */}
                  {currentQuestion.question_type === 'rating' && (
                    <div className="space-y-4">
                      <div className="flex justify-between gap-2">
                        {[1, 2, 3, 4, 5].map(val => (
                          <button
                            key={val}
                            onClick={() => handleAnswerChange(currentQuestion.id, val)}
                            className={`flex-1 py-4 sm:py-6 rounded-2xl flex flex-col items-center justify-center gap-1 sm:gap-2 transition-all border-2 ${
                              answers[currentQuestion.id] === val
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                                : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'
                            }`}
                          >
                            <Star
                              size={20}
                              className="sm:w-7 sm:h-7"
                              fill={answers[currentQuestion.id] === val ? 'currentColor' : 'none'}
                            />
                            <span className="text-base sm:text-xl font-bold">{val}</span>
                          </button>
                        ))}
                      </div>

                      {/* Campo de motivo para rating <= 3 */}
                      <AnimatePresence>
                        {answers[currentQuestion.id] >= 1 && answers[currentQuestion.id] <= 3 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <textarea
                              autoFocus
                              value={motivos[currentQuestion.id] || ''}
                              onChange={e => setMotivos({ ...motivos, [currentQuestion.id]: e.target.value })}
                              placeholder="Conte-nos o motivo da avaliação baixa... (opcional)"
                              rows={3}
                              className="w-full mt-2 px-4 py-3 bg-white border-2 border-transparent focus:border-blue-600 rounded-2xl text-sm text-slate-900 outline-none shadow-md shadow-slate-100 transition-all resize-none"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* MÚLTIPLA ESCOLHA */}
                  {currentQuestion.question_type === 'multiple_choice' && (
                    <div className="flex flex-col gap-3">
                      {currentQuestion.options.map((opt: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => handleAnswerChange(currentQuestion.id, opt)}
                          className={`w-full px-4 py-4 rounded-2xl text-left font-medium text-sm transition-all border-2 flex items-center justify-between ${
                            answers[currentQuestion.id] === opt
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                              : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200'
                          }`}
                        >
                          {opt}
                          {answers[currentQuestion.id] === opt && <Check size={18} />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* BOOLEAN — SIM / NÃO */}
                  {currentQuestion.question_type === 'yes_no' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {['SIM', 'NÃO'].map(val => (
                          <button
                            key={val}
                            onClick={() => handleAnswerChange(currentQuestion.id, val)}
                            className={`w-full py-8 sm:py-10 rounded-2xl font-bold text-lg sm:text-xl transition-all border-2 ${
                              answers[currentQuestion.id] === val
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                                : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>

                      {/* Campo de motivo para NÃO */}
                      <AnimatePresence>
                        {answers[currentQuestion.id] === 'NÃO' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, y: -10 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <textarea
                              autoFocus
                              value={motivos[currentQuestion.id] || ''}
                              onChange={e => setMotivos({ ...motivos, [currentQuestion.id]: e.target.value })}
                              placeholder="Conte-nos o motivo... (opcional)"
                              rows={3}
                              className="w-full mt-2 px-4 py-3 bg-white border-2 border-transparent focus:border-blue-600 rounded-2xl text-sm text-slate-900 outline-none shadow-md shadow-slate-100 transition-all resize-none"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* ESCALA DE CARINHAS */}
                  {currentQuestion.question_type === 'emoji_scale' && (
                    <div className="flex justify-between gap-2">
                      {[
                        { emoji: '😢', label: 'Péssimo',   value: 1 },
                        { emoji: '😕', label: 'Ruim',      value: 2 },
                        { emoji: '😐', label: 'Normal',    value: 3 },
                        { emoji: '😊', label: 'Bom',       value: 4 },
                        { emoji: '😄', label: 'Ótimo',     value: 5 },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleAnswerChange(currentQuestion.id, opt.value)}
                          className={`flex-1 py-5 sm:py-7 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2 ${
                            answers[currentQuestion.id] === opt.value
                              ? 'bg-blue-50 border-blue-500 scale-105 shadow-lg shadow-blue-100'
                              : 'bg-white border-slate-100 hover:border-blue-200'
                          }`}
                        >
                          <span className="text-3xl sm:text-4xl">{opt.emoji}</span>
                          <span className={`text-[10px] sm:text-xs font-semibold ${
                            answers[currentQuestion.id] === opt.value ? 'text-blue-600' : 'text-slate-400'
                          }`}>
                            {opt.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* PRODUCT ITEM — Pesquisa de Item */}
                  {currentQuestion.question_type === 'product_item' && (() => {
                    const product = (currentQuestion.options && typeof currentQuestion.options === 'object' && !Array.isArray(currentQuestion.options))
                      ? currentQuestion.options as Record<string, any>
                      : {};
                    
                    return (
                      <div className="space-y-4">
                        {/* Card do produto */}
                        <div className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden shadow-md shadow-slate-100">
                          {/* Foto */}
                          {product.image_url ? (
                            <img 
                              src={product.image_url} 
                              alt={product.descricao || 'Produto'}
                              className="w-full h-48 sm:h-64 object-contain bg-slate-50"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-40 bg-slate-50 flex items-center justify-center">
                              <Package size={40} className="text-slate-300" />
                            </div>
                          )}
                          
                          {/* Dados do produto */}
                          <div className="p-4 space-y-3">
                            {/* Marca + Referência */}
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-lg font-bold text-slate-900">{product.marca || 'Sem marca'}</p>
                                <p className="text-xs text-slate-400">Ref: {product.referencia || '—'}</p>
                              </div>
                              {product.categoria && (
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                                  product.categoria === 'masculino' ? 'bg-blue-50 text-blue-600' :
                                  product.categoria === 'feminino' ? 'bg-pink-50 text-pink-600' :
                                  product.categoria === 'infantil' ? 'bg-yellow-50 text-yellow-600' :
                                  'bg-purple-50 text-purple-600'
                                }`}>
                                  {product.categoria === 'masculino' ? 'Masculino' :
                                   product.categoria === 'feminino' ? 'Feminino' :
                                   product.categoria === 'infantil' ? 'Infantil' : 'Acessório'}
                                </span>
                              )}
                            </div>

                            {/* Descrição */}
                            {product.descricao && (
                              <p className="text-sm text-slate-600">{product.descricao}</p>
                            )}

                            {/* Cor */}
                            {(product.cor1 || product.cor) && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-slate-400">Cor:</span>
                                {[product.cor1 || product.cor, product.cor2, product.cor3].filter(Boolean).map((c: string, i: number) => (
                                  <span key={i} className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Preços */}
                            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                              {product.preco_custo && (
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Custo</p>
                                  <p className="text-sm font-semibold text-slate-500">
                                    R$ {Number(product.preco_custo).toFixed(2).replace('.', ',')}
                                  </p>
                                </div>
                              )}
                              {product.preco_venda && (
                                <div>
                                  <p className="text-[10px] text-green-500 uppercase tracking-wide">Venda</p>
                                  <p className="text-lg font-bold text-green-600">
                                    R$ {Number(product.preco_venda).toFixed(2).replace('.', ',')}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botões SIM / NÃO */}
                        <div className="grid grid-cols-2 gap-3">
                          {['SIM', 'NÃO'].map(val => (
                            <button
                              key={val}
                              onClick={() => handleAnswerChange(currentQuestion.id, val)}
                              className={`w-full py-6 rounded-2xl font-bold text-lg transition-all border-2 ${
                                answers[currentQuestion.id] === val
                                  ? val === 'SIM'
                                    ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-200 scale-105'
                                    : 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200 scale-105'
                                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              {val === 'SIM' ? '✅ SIM' : '❌ NÃO'}
                            </button>
                          ))}
                        </div>

                        {/* Grade — aparece ao selecionar SIM */}
                        <AnimatePresence>
                          {answers[currentQuestion.id] === 'SIM' && product.categoria && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 bg-white rounded-2xl border-2 border-green-100 p-4 space-y-3">

                                {/* ── ACESSÓRIO: entrada manual ── */}
                                {product.categoria === 'acessorio' ? (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-semibold text-slate-700">
                                        Informe a quantidade por tamanho
                                      </p>
                                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                                        {(Object.values(grades[currentQuestion.id]?.tamanhos || {}) as any[]).reduce((s: number, v: any) => s + Number(v || 0), 0)} un.
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {ACESSORIO_TAMANHOS.map(tam => {
                                        const qty = (grades[currentQuestion.id]?.tamanhos || {})[tam] || 0;
                                        return (
                                          <div key={tam} className="flex flex-col items-center gap-1">
                                            <span className={`text-xs font-bold ${qty > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                              {tam}
                                            </span>
                                            <div className="flex items-center gap-0.5">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const current = grades[currentQuestion.id]?.tamanhos || {};
                                                  const newQty = Math.max(0, (current[tam] || 0) - 1);
                                                  const updated = { ...current };
                                                  if (newQty === 0) delete updated[tam]; else updated[tam] = newQty;
                                                  const total = Object.values(updated).reduce((s: number, v: any) => s + Number(v), 0);
                                                  setGrades(prev => ({
                                                    ...prev,
                                                    [currentQuestion.id]: { tamanhos: updated, total_pares: total, letra: 'CUSTOM' }
                                                  }));
                                                }}
                                                disabled={qty === 0}
                                                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 flex items-center justify-center text-sm font-bold transition-all"
                                              >−</button>
                                              <span className={`w-8 h-8 flex items-center justify-center text-sm font-bold rounded-lg ${
                                                qty > 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'text-slate-300'
                                              }`}>{qty}</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const current = grades[currentQuestion.id]?.tamanhos || {};
                                                  const updated = { ...current, [tam]: (current[tam] || 0) + 1 };
                                                  const total = Object.values(updated).reduce((s: number, v: any) => s + Number(v), 0);
                                                  setGrades(prev => ({
                                                    ...prev,
                                                    [currentQuestion.id]: { tamanhos: updated, total_pares: total, letra: 'CUSTOM' }
                                                  }));
                                                }}
                                                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-green-50 hover:text-green-600 flex items-center justify-center text-sm font-bold transition-all"
                                              >+</button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </>
                                ) : (
                                  /* ── CALÇADO: grades pré-definidas (A, B, C...) ── */
                                  <>
                                    <p className="text-sm font-semibold text-slate-700">
                                      Escolha a grade desejada
                                    </p>
                                    <div className="space-y-2">
                                      {gradeTemplates
                                        .filter(t => t.categoria === product.categoria)
                                        .map(template => {
                                          const isSelected = grades[currentQuestion.id]?.templateId === template.id;
                                          const tamanhos = template.tamanhos || {};
                                          const tamanhosList = Object.entries(tamanhos)
                                            .sort(([a], [b]) => Number(a) - Number(b))
                                            .map(([tam, qty]) => `${tam}(${qty})`)
                                            .join('  ');
                                          
                                          return (
                                            <button
                                              key={template.id}
                                              type="button"
                                              onClick={() => {
                                                setGrades(prev => ({
                                                  ...prev,
                                                  [currentQuestion.id]: {
                                                    templateId: template.id,
                                                    letra: template.letra,
                                                    tamanhos: template.tamanhos,
                                                    total_pares: template.total_pares,
                                                  }
                                                }));
                                              }}
                                              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                                                isSelected
                                                  ? 'border-green-500 bg-green-50 shadow-md shadow-green-100'
                                                  : 'border-slate-100 bg-white hover:border-slate-300'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${
                                                    isSelected ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'
                                                  }`}>{template.letra}</span>
                                                  <span className={`text-sm font-bold ${
                                                    isSelected ? 'text-green-700' : 'text-slate-700'
                                                  }`}>{template.nome}</span>
                                                </div>
                                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                                                  isSelected ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-500'
                                                }`}>{template.total_pares} pares</span>
                                              </div>
                                              <p className={`text-[11px] font-mono tracking-wide ${
                                                isSelected ? 'text-green-600' : 'text-slate-400'
                                              }`}>{tamanhosList}</p>
                                            </button>
                                          );
                                        })}
                                    </div>
                                    {grades[currentQuestion.id]?.templateId && (
                                      <div className="flex items-center gap-2 pt-2 border-t border-green-100">
                                        <Check size={14} className="text-green-500" />
                                        <span className="text-xs font-semibold text-green-600">
                                          Grade {grades[currentQuestion.id]?.letra} selecionada — {grades[currentQuestion.id]?.total_pares} pares
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Campo de motivo para NÃO */}
                        <AnimatePresence>
                          {answers[currentQuestion.id] === 'NÃO' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <textarea
                                autoFocus
                                value={motivos[currentQuestion.id] || ''}
                                onChange={e => setMotivos({ ...motivos, [currentQuestion.id]: e.target.value })}
                                placeholder="Conte-nos o motivo... (opcional)"
                                rows={3}
                                className="w-full mt-2 px-4 py-3 bg-white border-2 border-transparent focus:border-blue-600 rounded-2xl text-sm text-slate-900 outline-none shadow-md shadow-slate-100 transition-all resize-none"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}

                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── FOOTER ── */}
      {currentStep !== -2 && (
        <footer className="bg-white border-t border-slate-200 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between shrink-0 gap-3">

          {/* Voltar */}
          <button
            disabled={isFirstStep}
            onClick={() => setCurrentStep(currentStep - 1)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
              isFirstStep
                ? 'text-slate-200 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ChevronLeft size={18} /> Voltar
          </button>

          {/* Finalizar ou Próxima */}
          {isLastStep ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !!(currentQuestion?.is_required && !answers[currentQuestion.id])}
              className={`flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-semibold text-sm shadow-lg shadow-green-200 transition-all active:scale-95 ${
                isSubmitting || (currentQuestion?.is_required && !answers[currentQuestion?.id])
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              {isSubmitting
                ? <Loader2 className="animate-spin" size={18} />
                : <Send size={18} />}
              Enviar resposta
            </button>
          ) : (
            <button
              onClick={() => {
                if (currentStep === -1 && canAdvanceFromIdentification()) {
                  setCurrentStep(0);
                } else if (currentStep >= 0) {
                  setCurrentStep(currentStep + 1);
                }
              }}
              disabled={
                (currentStep === -1 && !canAdvanceFromIdentification()) ||
                (currentStep >= 0 && !!(currentQuestion?.is_required && !answers[currentQuestion?.id]))
              }
              className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-semibold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 ${
                (currentStep === -1 && !canAdvanceFromIdentification()) ||
                (currentStep >= 0 && currentQuestion?.is_required && !answers[currentQuestion?.id])
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              Próxima <ChevronRight size={18} />
            </button>
          )}
        </footer>
      )}
    </div>
  );
};

export default SurveyResponseForm;