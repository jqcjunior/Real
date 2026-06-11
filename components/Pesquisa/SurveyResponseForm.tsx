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

const GRADE_TAMANHOS: Record<string, string[]> = {
  masculino: ['37','38','39','40','41','42','43','44','45'],
  feminino:  ['33','34','35','36','37','38','39','40'],
  infantil:  ['17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34'],
  acessorio: ['UNICO'],
};

const SurveyResponseForm: React.FC<SurveyResponseFormProps> = ({
  survey,
  user,
  invitationToken,
  onClose,
  onComplete,
}) => {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, Record<string, number>>>({});
  const [respondentInfo, setRespondentInfo] = useState({ name: '', email: '', phone: '' });
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Para pesquisa externa começa em -1 (tela de identificação)
  // Para pesquisa interna começa em 0 (primeira pergunta)
  const startStep = survey.target_type === 'external' ? -1 : 0;
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

  const handleGradeChange = (questionId: string, tamanho: string, delta: number) => {
    setGrades(prev => {
      const current = prev[questionId] || {};
      const newQty = Math.max(0, (current[tamanho] || 0) + delta);
      const updated = { ...current };
      if (newQty === 0) {
        delete updated[tamanho];
      } else {
        updated[tamanho] = newQty;
      }
      return { ...prev, [questionId]: updated };
    });
  };

  const getTotalPares = (questionId: string): number => {
    const g = grades[questionId] || {};
    return Object.values(g).reduce((sum, qty) => sum + qty, 0);
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
          finalResponses[qId] = {
            value: val,
            grade: val === 'SIM' ? (grades[qId] || {}) : {},
            total_pares: val === 'SIM' ? getTotalPares(qId) : 0,
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
              {currentStep >= 0
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

            {/* ── STEP -1: IDENTIFICAÇÃO ── */}
            {currentStep === -1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                    Como você quer participar?
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Você pode se identificar ou responder de forma anônima.
                  </p>
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
                            {product.cor && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Cor:</span>
                                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {product.cor}
                                </span>
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

                        {/* Grade de tamanhos — aparece ao selecionar SIM */}
                        <AnimatePresence>
                          {answers[currentQuestion.id] === 'SIM' && product.categoria && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 bg-white rounded-2xl border-2 border-green-100 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-slate-700">
                                    Selecione a grade desejada
                                  </p>
                                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                                    {getTotalPares(currentQuestion.id)} {product.categoria === 'acessorio' ? 'un.' : 'pares'}
                                  </span>
                                </div>
                                
                                <div className={`grid gap-2 ${
                                  product.categoria === 'acessorio' 
                                    ? 'grid-cols-1' 
                                    : product.categoria === 'infantil' 
                                    ? 'grid-cols-6' 
                                    : 'grid-cols-5'
                                }`}>
                                  {(GRADE_TAMANHOS[product.categoria] || GRADE_TAMANHOS['masculino']).map(tam => {
                                    const qty = (grades[currentQuestion.id] || {})[tam] || 0;
                                    return (
                                      <div key={tam} className="flex flex-col items-center">
                                        <span className={`text-[10px] font-semibold mb-1 ${
                                          qty > 0 ? 'text-green-600' : 'text-slate-400'
                                        }`}>
                                          {tam}
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            onClick={() => handleGradeChange(currentQuestion.id, tam, -1)}
                                            disabled={qty === 0}
                                            className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 flex items-center justify-center text-sm font-bold transition-all"
                                          >
                                            −
                                          </button>
                                          <span className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg ${
                                            qty > 0 
                                              ? 'bg-green-50 text-green-700 border border-green-200' 
                                              : 'text-slate-300'
                                          }`}>
                                            {qty}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleGradeChange(currentQuestion.id, tam, 1)}
                                            className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-green-50 hover:text-green-600 flex items-center justify-center text-sm font-bold transition-all"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {getTotalPares(currentQuestion.id) === 0 && (
                                  <p className="text-[11px] text-amber-500 text-center">
                                    Selecione ao menos 1 tamanho para confirmar
                                  </p>
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
    </div>
  );
};

export default SurveyResponseForm;