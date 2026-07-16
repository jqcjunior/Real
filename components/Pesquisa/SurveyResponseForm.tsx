import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { getDeviceId } from '../../services/deviceId';
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
import { Survey, SurveyQuestion, SurveySection, User as UserType } from '../../types';

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
  const [sections, setSections] = useState<SurveySection[]>([]);
  const [gradeTemplates, setGradeTemplates] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, any>>({});
  const [respondentInfo, setRespondentInfo] = useState({ name: '', email: '', phone: '' });
  const [respondentRole, setRespondentRole] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sectionComments, setSectionComments] = useState<Record<string, string>>({});

  // Refs e novos estados para melhorias de UX
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sectionTransition, setSectionTransition] = useState<{ name: string; count: number; description?: string | null; image_url?: string | null } | null>(null);
  const [validationError, setValidationError] = useState('');

  // Sistema de steps:
  // -3 = landing (logo + título + descrição)
  // -2 = dados do participante (nome, cargo, tel, email)
  // 0+ = virtualSteps[currentStep] → pergunta ou comentário de seção

  const collectData = (survey as any).collect_respondent_data !== false;
  const isInternal = survey.target_type === 'internal';
  const showAnonymousOption = !!(survey as any).allow_anonymous;

  const startStep = -3;
  const [currentStep, setCurrentStep] = useState(startStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, [survey.id]);

  // Limpar erro de validação ao mudar de step
  useEffect(() => {
    setValidationError('');
  }, [currentStep]);

  // Limpar timer ao desmontar
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  // Restaurar respostas do localStorage
  useEffect(() => {
    const key = `survey_draft_${survey.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.motivos) setMotivos(parsed.motivos);
      } catch {}
    }
  }, [survey.id]);

  // Salvar automaticamente a cada mudança
  useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    const key = `survey_draft_${survey.id}`;
    localStorage.setItem(key, JSON.stringify({ answers, motivos }));
  }, [answers, motivos, survey.id]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      // Buscar perguntas
      const { data, error } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', survey.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const activeQuestions = (data || []).filter((q: any) => q.is_active !== false);
      setQuestions(activeQuestions);

      // Buscar seções
      const { data: secData, error: secError } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', survey.id)
        .order('sort_order', { ascending: true });
      if (secError) throw secError;
      setSections(secData || []);

      const { data: tplData } = await supabase
        .from('survey_grade_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (tplData) setGradeTemplates(tplData);
    } catch (err) {
      console.error('Erro ao buscar perguntas/seções:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Constrói array virtual de steps intercalando perguntas e comentários de seção
  const buildVirtualSteps = (qs: SurveyQuestion[], secs: any[]) => {
    type VStep =
      | { type: 'question'; index: number }
      | { type: 'section_page'; section: string; indexes: number[] }
      | { type: 'section_comment'; section: string };

    const steps: VStep[] = [];
    const processed = new Set<number>();

    qs.forEach((q, idx) => {
      if (processed.has(idx)) return;

      const sec = q.section_id || (q as any).section || null;
      if (!sec) {
        steps.push({ type: 'question', index: idx });
        return;
      }

      const secMeta = secs.find(s => s.id === sec || s.name === sec);
      const secName = secMeta ? secMeta.name : sec;
      const mode = secMeta?.display_mode ?? 'one_by_one';

      if (mode === 'all_at_once') {
        // Agrupar todas as perguntas desta seção num único step
        const indexes = qs
          .map((qq, i) => {
            const qqSec = qq.section_id || (qq as any).section || null;
            return qqSec === sec ? i : -1;
          })
          .filter(i => i >= 0);
        indexes.forEach(i => processed.add(i));
        steps.push({ type: 'section_page', section: secName, indexes });
        // Comentário ao final da seção
        steps.push({ type: 'section_comment', section: secName });
      } else {
        steps.push({ type: 'question', index: idx });
        // Verificar se é a última pergunta da seção (one_by_one)
        const nextQ = qs[idx + 1];
        const nextSec = nextQ ? (nextQ.section_id || (nextQ as any).section || null) : null;
        if (nextSec !== sec) {
          steps.push({ type: 'section_comment', section: secName });
        }
      }
    });

    return steps;
  };

  const virtualSteps = buildVirtualSteps(questions, sections);
  const currentVirtual = currentStep >= 0 ? virtualSteps[currentStep] : null;

  // currentQuestion só existe para steps do tipo 'question'
  const currentQuestion = currentVirtual?.type === 'question'
    ? questions[currentVirtual.index]
    : null;

  // Para section_page: array de perguntas da página
  const currentPageQuestions = currentVirtual?.type === 'section_page'
    ? (currentVirtual as any).indexes.map((i: number) => questions[i])
    : [];

  const getSectionMeta = (sectionIdentifier: string) => {
    return sections.find(s => s.id === sectionIdentifier || s.name === sectionIdentifier);
  };

  const isLastVirtualStep = currentStep === virtualSteps.length - 1;

  const totalQuestions = questions.length;
  const answeredQuestions =
    currentVirtual?.type === 'question' ? (currentVirtual.index + 1) :
    currentVirtual?.type === 'section_page' ? ((currentVirtual as any).indexes.slice(-1)[0] + 1) :
    totalQuestions;

  const progress = currentStep >= 0
    ? (answeredQuestions / totalQuestions) * 100
    : 0;

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setValidationError('');

    // Limpar motivos
    if (value === 'SIM' || (typeof value === 'number' && value > 3)) {
      setMotivos(prev => {
        const n = { ...prev };
        delete n[questionId];
        return n;
      });
    }

    // Auto-avanço para tipos de seleção imediata (não dispara na última pergunta do virtualSteps ou em section_page)
    const q = questions.find(q => q.id === questionId);
    const autoAdvanceTypes = ['yes_no', 'multiple_choice', 'emoji_scale'];
    if (q && autoAdvanceTypes.includes(q.question_type) && !isLastVirtualStep && currentVirtual?.type !== 'section_page') {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => {
        setCurrentStep(prev => {
          const next = prev + 1;
          if (next < virtualSteps.length) return next;
          return prev;
        });
      }, 350);
    }
  };

  const getTimeEstimate = () => {
    if (!questions.length) return null;
    const seconds = questions.reduce((acc, q) => {
      if (q.question_type === 'short_text') return acc + 30;
      if (q.question_type === 'product_item') return acc + 20;
      if (q.question_type === 'multiple_choice') return acc + 15;
      return acc + 10; // rating, yes_no, emoji_scale
    }, 0);
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return `${questions.length} pergunta${questions.length > 1 ? 's' : ''} · ~${minutes} min`;
  };

  const handleNext = () => {
    if (currentStep === -2 && canAdvanceFromParticipantInfo()) {
      const firstVirtual = virtualSteps[0];
      if (firstVirtual) {
        const firstSecRaw = firstVirtual.type === 'question'
          ? (questions[firstVirtual.index].section_id || (questions[firstVirtual.index] as any).section)
          : (firstVirtual.type === 'section_page' ? firstVirtual.section : null);
        if (firstSecRaw) {
          const secMeta = sections.find(s => s.id === firstSecRaw || s.name === firstSecRaw);
          const secName = secMeta ? secMeta.name : firstSecRaw;
          const count = questions.filter(q => {
            const qSec = q.section_id || (q as any).section || null;
            return qSec === firstSecRaw || (secMeta && qSec === secMeta.name);
          }).length;
          setSectionTransition({ 
            name: secName, 
            count,
            description: secMeta?.description,
            image_url: secMeta?.image_url 
          });
          return;
        }
      }
      setCurrentStep(0);
      return;
    }
    if (currentStep >= 0) {
      if (currentVirtual?.type === 'section_page') {
        const missing = currentPageQuestions.filter(
          q => q?.is_required && !answers[q.id]
        );
        if (missing.length > 0) {
          setValidationError('Responda todas as perguntas obrigatórias antes de continuar.');
          return;
        }
      }

      const nextIdx = currentStep + 1;
      if (nextIdx < virtualSteps.length) {
        const nextVirtual = virtualSteps[nextIdx];

        const currentSecRaw = currentVirtual?.type === 'question'
          ? (questions[currentVirtual.index].section_id || (questions[currentVirtual.index] as any).section || null)
          : (currentVirtual?.type === 'section_page' ? currentVirtual.section : null);
        const currentSecMeta = sections.find(s => s.id === currentSecRaw || s.name === currentSecRaw);
        const currentSecId = currentSecMeta ? currentSecMeta.id : currentSecRaw;

        const nextSecRaw = nextVirtual?.type === 'question'
          ? (questions[nextVirtual.index].section_id || (questions[nextVirtual.index] as any).section || null)
          : (nextVirtual?.type === 'section_page' ? nextVirtual.section : null);
        const nextSecMeta = sections.find(s => s.id === nextSecRaw || s.name === nextSecRaw);
        const nextSecId = nextSecMeta ? nextSecMeta.id : nextSecRaw;

        // Detectar mudança de seção
        if (nextSecId && nextSecId !== currentSecId) {
          const count = questions.filter(q => {
            const qSec = q.section_id || (q as any).section || null;
            return qSec === nextSecId || (nextSecMeta && qSec === nextSecMeta.name);
          }).length;
          const secName = nextSecMeta ? nextSecMeta.name : nextSecRaw;
          setSectionTransition({ 
            name: secName, 
            count,
            description: nextSecMeta?.description,
            image_url: nextSecMeta?.image_url
          });
          return;
        }
      }
      setCurrentStep(nextIdx);
    }
  };

  const canAdvanceFromParticipantInfo = () => {
    return true; // todos os campos são opcionais
  };

  const handleSubmit = async () => {
    const missingRequired = questions.filter(q => q.is_required && !answers[q.id]);
    if (missingRequired.length > 0) {
      const firstMissingVirtualIdx = virtualSteps.findIndex(vs => {
        if (vs.type === 'question') {
          return questions[vs.index].id === missingRequired[0].id;
        } else if (vs.type === 'section_page') {
          return vs.indexes.some(idx => questions[idx].id === missingRequired[0].id);
        }
        return false;
      });
      if (firstMissingVirtualIdx >= 0) setCurrentStep(firstMissingVirtualIdx);
      setValidationError('Esta pergunta é obrigatória.');
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

      // Incluir comentários de seção nas respostas
      Object.entries(sectionComments).forEach(([section, comment]) => {
        if (comment.trim()) {
          finalResponses[`__comment_${section}`] = comment.trim();
        }
      });

      const { error: rError } = await supabase
        .from('survey_responses')
        .insert([{
          survey_id: survey.id,
          user_id: user?.id || null,
          store_id: user?.storeId || null,
          device_id: getDeviceId(),
          responses: finalResponses,
          respondent_name: isAnonymous ? null : (respondentInfo.name || null),
          respondent_email: isAnonymous ? null : (respondentInfo.email || null),
          respondent_phone: isAnonymous ? null : (respondentInfo.phone || null),
          respondent_role: isAnonymous ? null : (respondentRole || null),
        }]);

      if (rError) throw rError;

      setIsCompleted(true);
      localStorage.removeItem(`survey_draft_${survey.id}`);
      setTimeout(() => { onComplete(); }, 3000);
    } catch (err: any) {
      console.error('Erro ao enviar resposta:', err);
      const isDuplicate = err?.message?.includes('DEVICE_ALREADY_RESPONDED') || err?.code === 'DEVICE_ALREADY_RESPONDED';
      if (isDuplicate) {
        alert('Parece que você já respondeu esta pesquisa neste aparelho.');
        localStorage.removeItem(`survey_draft_${survey.id}`);
        onComplete();
      } else {
        alert('Erro ao enviar resposta: ' + (err.message || 'Erro desconhecido'));
      }
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
          <h2 className="text-2xl font-bold text-slate-900">
            {respondentInfo.name
              ? `Obrigado, ${respondentInfo.name.split(' ')[0]}! 🎉`
              : 'Obrigado por participar! 🎉'}
          </h2>
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

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-50 flex flex-col overflow-hidden">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {currentStep >= -2 && (
            <button
              onClick={
                currentStep === -2
                  ? () => setCurrentStep(-3)
                  : () => setCurrentStep(prev => {
                      if (prev === 0) return collectData ? -2 : -3;
                      return prev - 1;
                    })
              }
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all flex-shrink-0"
              aria-label="Voltar"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {currentStep === -3 && (
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all flex-shrink-0">
              <X size={20} />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 truncate leading-tight">{survey.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentStep === -3 ? 'Apresentação'
               : currentStep === -2 ? 'Seus dados'
               : currentVirtual?.type === 'section_comment' ? `Comentário · ${(currentVirtual as any).section}`
               : currentVirtual?.type === 'section_page' ? `${(currentVirtual as any).section}`
               : currentQuestion ? `Pergunta ${(currentVirtual as any).index + 1} de ${totalQuestions}`
               : ''}
            </p>
          </div>
        </div>
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
          {sectionTransition ? (
            <motion.div
              key="section-transition"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl flex flex-col items-center bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl"
            >
              {sectionTransition.image_url ? (
                <div className="w-full h-56 relative overflow-hidden">
                  <img
                    src={sectionTransition.image_url}
                    alt={sectionTransition.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-6">
                    <span className="px-3 py-1 bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-full">
                      Tópico {sections.findIndex(s => s.name === sectionTransition.name) + 1 !== 0 ? sections.findIndex(s => s.name === sectionTransition.name) + 1 : 1}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-28 bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-between px-6 relative overflow-hidden">
                  <div className="absolute -right-6 -bottom-6 text-9xl text-white/10 select-none font-bold">
                    🧩
                  </div>
                  <div>
                    <span className="px-3 py-1 bg-white/20 text-white font-bold text-[10px] uppercase tracking-wider rounded-full">
                      Próxima Seção
                    </span>
                  </div>
                </div>
              )}

              <div className="p-6 sm:p-8 text-center space-y-4 w-full">
                <h2 className="text-2xl font-black text-slate-900 leading-tight">
                  {sectionTransition.name}
                </h2>
                
                {sectionTransition.description && (
                  <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                    {sectionTransition.description}
                  </p>
                )}

                <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  {sectionTransition.count} {sectionTransition.count === 1 ? 'pergunta' : 'perguntas'} neste bloco
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => {
                      const nextIdx = currentStep + 1;
                      setSectionTransition(null);
                      setCurrentStep(nextIdx === 0 ? 0 : nextIdx);
                    }}
                    className="w-full sm:w-auto px-10 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition-all text-sm"
                  >
                    Iniciar Bloco →
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg"
            >

              {/* ── STEP -3: LANDING ── */}
              {currentStep === -3 && (
                <div className="flex flex-col items-center text-center space-y-6 py-4">
                  {/* Logo */}
                  {(survey as any).logo_url ? (
                    <img
                      src={(survey as any).logo_url}
                      alt="Logo"
                      className="w-32 h-32 sm:w-40 sm:h-40 object-contain rounded-2xl shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
                      <span className="text-white text-3xl font-black">R</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                      {survey.title}
                    </h1>
                    {survey.description && (
                      <p className="text-base text-slate-600 leading-relaxed whitespace-pre-line">
                        {survey.description}
                      </p>
                    )}
                    {(survey as any).welcome_message && (
                      <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line mt-2">
                        {(survey as any).welcome_message}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setCurrentStep(collectData ? -2 : 0)}
                    className="w-full max-w-xs py-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-base font-bold rounded-2xl shadow-lg shadow-blue-200 transition-all"
                  >
                    Participar →
                  </button>
                  {getTimeEstimate() ? (
                    <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                      <span>⏱</span> {getTimeEstimate()}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">Leva apenas alguns minutos</p>
                  )}
                </div>
              )}

            {/* ── STEP -2: DADOS DO PARTICIPANTE ── */}
            {currentStep === -2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {isInternal ? 'Seus dados' : 'Identificação'}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {isInternal
                      ? 'Preencha para que possamos identificar sua resposta.'
                      : 'Opcional — você pode responder de forma anônima.'}
                  </p>
                </div>

                {/* Botão anônimo — só para clientes com allow_anonymous */}
                {showAnonymousOption && (
                  <>
                    <button
                      onClick={() => {
                        setIsAnonymous(true);
                        setRespondentInfo({ name: '', email: '', phone: '' });
                        setRespondentRole('');
                        setCurrentStep(0);
                      }}
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
                      {isAnonymous && <Check size={18} className="text-blue-600 ml-auto flex-shrink-0" />}
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400">ou</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  </>
                )}

                {/* Formulário de dados */}
                <div
                  className={`space-y-3 transition-opacity ${isAnonymous ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
                  onClick={() => isAnonymous && setIsAnonymous(false)}
                >
                  {/* Cargo — só para funcionários (internal) */}
                  {isInternal && (
                    <select
                      value={respondentRole}
                      onChange={e => { setIsAnonymous(false); setRespondentRole(e.target.value); }}
                      className={`w-full px-4 py-3.5 bg-white border-2 rounded-2xl text-sm outline-none transition-all ${
                        respondentRole ? 'border-blue-500 text-slate-900' : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      <option value="">Cargo (opcional)</option>
                      <option value="Caixa">Caixa</option>
                      <option value="Cobrança">Cobrança</option>
                      <option value="Estoquista">Estoquista</option>
                      <option value="Gerente">Gerente</option>
                      <option value="Indenização">Indenização</option>
                      <option value="Limpeza">Limpeza</option>
                      <option value="Vendedor">Vendedor</option>
                    </select>
                  )}

                  {/* Nome */}
                  <input
                    type="text"
                    placeholder="Nome completo (opcional)"
                    value={respondentInfo.name}
                    onChange={e => { setIsAnonymous(false); setRespondentInfo({ ...respondentInfo, name: e.target.value }); }}
                    className="w-full px-4 py-3.5 bg-white border-2 border-slate-200 focus:border-blue-500 rounded-2xl text-sm text-slate-900 outline-none transition-all"
                  />

                  {/* Telefone */}
                  <input
                    type="tel"
                    placeholder="Telefone (opcional)"
                    value={respondentInfo.phone}
                    onChange={e => { setIsAnonymous(false); setRespondentInfo({ ...respondentInfo, phone: e.target.value }); }}
                    className="w-full px-4 py-3.5 bg-white border-2 border-slate-200 focus:border-blue-500 rounded-2xl text-sm text-slate-900 outline-none transition-all"
                  />

                  {/* Email */}
                  <input
                    type="email"
                    placeholder="E-mail (opcional)"
                    value={respondentInfo.email}
                    onChange={e => { setIsAnonymous(false); setRespondentInfo({ ...respondentInfo, email: e.target.value }); }}
                    className="w-full px-4 py-3.5 bg-white border-2 border-slate-200 focus:border-blue-500 rounded-2xl text-sm text-slate-900 outline-none transition-all"
                  />


                </div>
              </div>
            )}

            {/* ── STEPS 0+: PERGUNTAS E COMENTÁRIOS DE SEÇÃO ── */}
            {currentStep >= 0 && currentVirtual && (
              <>
                {/* PERGUNTA */}
                {currentVirtual.type === 'question' && currentQuestion && (
                  <div className={`space-y-8 rounded-3xl transition-all ${
                    validationError && currentQuestion?.is_required && !answers[currentQuestion.id]
                      ? 'ring-2 ring-red-200 ring-offset-4'
                      : ''
                  }`}>
                    {/* Cabeçalho de seção — só quando muda */}
                    {(currentQuestion as any).section && (
                      (currentVirtual.index === 0 ||
                      (questions[(currentVirtual.index) - 1] as any)?.section !== (currentQuestion as any).section)
                    ) && (
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-blue-100" />
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-500 px-2">
                          {(currentQuestion as any).section}
                        </span>
                        <div className="h-px flex-1 bg-blue-100" />
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5 shadow-md shadow-blue-200">
                        {currentVirtual.index + 1}
                      </span>
                      <h2 className="text-lg sm:text-2xl font-bold text-slate-900 leading-snug">
                        {currentQuestion.question_text}
                        {currentQuestion.is_required && <span className="text-red-500 ml-1">*</span>}
                      </h2>
                    </div>

                    <div className="space-y-4">

                  {/* TEXTO */}
                  {currentQuestion.question_type === 'short_text' && (
                    <div className="relative">
                      <textarea
                        autoFocus
                        value={answers[currentQuestion.id] || ''}
                        onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
                        placeholder="Digite sua resposta aqui..."
                        rows={4}
                        maxLength={500}
                        className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-white border-2 border-transparent focus:border-blue-600 rounded-2xl text-sm sm:text-base text-slate-900 outline-none shadow-md shadow-slate-100 transition-all resize-none"
                      />
                      <span className="absolute bottom-3 right-4 text-[11px] text-slate-300 font-mono">
                        {(answers[currentQuestion.id] || '').length}/500
                      </span>
                    </div>
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

                      <div className="flex justify-between px-1">
                        {['Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'].map((label, i) => (
                          <span
                            key={i}
                            className={`text-[10px] sm:text-xs text-center flex-1 transition-colors ${
                              answers[currentQuestion.id] === i + 1
                                ? 'text-blue-600 font-bold'
                                : 'text-slate-300'
                            }`}
                          >
                            {label}
                          </span>
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

                    {validationError && currentQuestion?.is_required && !answers[currentQuestion.id] && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-red-500 font-medium flex items-center gap-1.5 mt-2"
                      >
                        <span>⚠️</span> {validationError}
                      </motion.p>
                    )}
                  </div>
                )}

                {/* TODAS AS PERGUNTAS DO TÓPICO JUNTAS */}
                {currentVirtual.type === 'section_page' && (
                  <div className="space-y-6">

                    {/* Imagem do tópico — se existir */}
                    {(() => {
                      const meta = getSectionMeta((currentVirtual as any).section);
                      return meta?.image_url ? (
                        <div className="w-full h-44 rounded-2xl overflow-hidden -mx-0">
                          <img
                            src={meta.image_url}
                            alt={(currentVirtual as any).section}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : null;
                    })()}

                    {/* Cabeçalho da seção */}
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-blue-100" />
                      <span className="text-xs font-bold uppercase tracking-widest text-blue-500 px-2">
                        {(currentVirtual as any).section}
                      </span>
                      <div className="h-px flex-1 bg-blue-100" />
                    </div>

                    {/* Erro de validação */}
                    {validationError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-red-500 font-medium flex items-center gap-1.5 px-1"
                      >
                        <span>⚠️</span> {validationError}
                      </motion.p>
                    )}

                    {/* Perguntas da página */}
                    {currentPageQuestions.map((q, pIdx) => {
                      if (!q) return null;
                      const isAnswered = !!answers[q.id];
                      const isRequired = q.is_required;
                      const showError = validationError && isRequired && !isAnswered;

                      return (
                        <div
                          key={q.id}
                          className={`bg-white rounded-2xl border-2 p-5 space-y-4 transition-all ${
                            showError
                              ? 'border-red-200 ring-2 ring-red-100'
                              : isAnswered
                                ? 'border-blue-100'
                                : 'border-slate-100'
                          }`}
                        >
                          {/* Número + texto da pergunta */}
                          <div className="flex items-start gap-3">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 ${
                              isAnswered
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                              {pIdx + 1}
                            </span>
                            <h3 className="text-base font-semibold text-slate-900 leading-snug">
                              {q.question_text}
                              {q.is_required && <span className="text-red-400 ml-1 text-sm">*</span>}
                            </h3>
                          </div>

                          {/* Resposta — short_text */}
                          {q.question_type === 'short_text' && (
                            <div className="relative pl-10">
                              <textarea
                                value={answers[q.id] || ''}
                                onChange={e => handleAnswerChange(q.id, e.target.value)}
                                placeholder="Digite sua resposta..."
                                rows={3}
                                maxLength={500}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-400 rounded-xl text-sm text-slate-900 outline-none resize-none transition-all"
                              />
                              <span className="absolute bottom-3 right-3 text-[10px] text-slate-300 font-mono">
                                {(answers[q.id] || '').length}/500
                              </span>
                            </div>
                          )}

                          {/* Resposta — rating */}
                          {q.question_type === 'rating' && (
                            <div className="pl-10 space-y-2">
                              <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(val => (
                                  <button
                                    key={val}
                                    onClick={() => handleAnswerChange(q.id, val)}
                                    className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-1 border-2 transition-all text-sm font-bold ${
                                      answers[q.id] === val
                                        ? 'bg-blue-600 border-blue-600 text-white scale-105'
                                        : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'
                                    }`}
                                  >
                                    <Star size={16} fill={answers[q.id] === val ? 'currentColor' : 'none'} />
                                    {val}
                                  </button>
                                ))}
                              </div>
                              <div className="flex justify-between px-1">
                                {['Péssimo','Ruim','Regular','Bom','Excelente'].map((label, i) => (
                                  <span key={i} className={`text-[10px] flex-1 text-center transition-colors ${
                                    answers[q.id] === i + 1 ? 'text-blue-600 font-bold' : 'text-slate-300'
                                  }`}>{label}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Resposta — emoji_scale */}
                          {q.question_type === 'emoji_scale' && (
                            <div className="pl-10 flex gap-2">
                              {[
                                { emoji: '😢', label: 'Péssimo', value: 1 },
                                { emoji: '😕', label: 'Ruim',    value: 2 },
                                { emoji: '😐', label: 'Normal',  value: 3 },
                                { emoji: '😊', label: 'Bom',     value: 4 },
                                { emoji: '😄', label: 'Ótimo',   value: 5 },
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => handleAnswerChange(q.id, opt.value)}
                                  className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-1 border-2 transition-all ${
                                    answers[q.id] === opt.value
                                      ? 'bg-blue-50 border-blue-500 scale-105'
                                      : 'bg-white border-slate-100 hover:border-blue-200'
                                  }`}
                                >
                                  <span className="text-xl">{opt.emoji}</span>
                                  <span className={`text-[9px] font-semibold ${
                                    answers[q.id] === opt.value ? 'text-blue-600' : 'text-slate-300'
                                  }`}>{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Resposta — yes_no */}
                          {q.question_type === 'yes_no' && (
                            <div className="pl-10 grid grid-cols-2 gap-2">
                              {['SIM', 'NÃO'].map(val => (
                                <button
                                  key={val}
                                  onClick={() => handleAnswerChange(q.id, val)}
                                  className={`py-4 rounded-xl font-bold text-base border-2 transition-all ${
                                    answers[q.id] === val
                                      ? val === 'SIM'
                                        ? 'bg-green-600 border-green-600 text-white'
                                        : 'bg-red-500 border-red-500 text-white'
                                      : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                                  }`}
                                >
                                  {val === 'SIM' ? '✅ SIM' : '❌ NÃO'}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Resposta — multiple_choice */}
                          {q.question_type === 'multiple_choice' && (
                            <div className="pl-10 space-y-2">
                              {(Array.isArray(q.options) ? q.options : []).map((opt: string, oi: number) => (
                                <button
                                  key={oi}
                                  onClick={() => handleAnswerChange(q.id, opt)}
                                  className={`w-full px-4 py-3 rounded-xl text-left text-sm font-medium border-2 flex items-center justify-between transition-all ${
                                    answers[q.id] === opt
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200'
                                  }`}
                                >
                                  {opt}
                                  {answers[q.id] === opt && <Check size={16} />}
                                </button>
                              ))}
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}

                {/* COMENTÁRIO DE SEÇÃO */}
                {currentVirtual.type === 'section_comment' && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-px flex-1 bg-blue-100" />
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-500 px-2">
                          {currentVirtual.section}
                        </span>
                        <div className="h-px flex-1 bg-blue-100" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-900">
                        Comentário sobre {currentVirtual.section}
                      </h2>
                      <p className="text-sm text-slate-400 mt-1">
                        Deixe uma mensagem, sugestão ou observação sobre este bloco (opcional).
                      </p>
                    </div>
                    <textarea
                      value={sectionComments[currentVirtual.section] || ''}
                      onChange={e => setSectionComments(prev => ({
                        ...prev,
                        [currentVirtual.section]: e.target.value,
                      }))}
                      placeholder={`Escreva aqui sobre ${currentVirtual.section}...`}
                      rows={5}
                      className="w-full px-4 py-4 bg-white border-2 border-slate-200 focus:border-blue-500 rounded-2xl text-sm text-slate-900 outline-none transition-all resize-none shadow-sm"
                    />
                    <p className="text-xs text-slate-400 text-center">
                      Campo opcional — clique em {isLastVirtualStep ? '"Enviar"' : '"Próximo"'} para continuar
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── FOOTER ── */}
      {!sectionTransition && (
        <footer className="bg-white border-t border-slate-100 px-4 py-4 shrink-0">
          <div className="max-w-lg mx-auto">

            {/* Step -2: botão Continuar */}
            {currentStep === -2 && (
              <button
                onClick={handleNext}
                disabled={!canAdvanceFromParticipantInfo()}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 active:scale-95 text-white text-sm font-semibold rounded-2xl transition-all"
              >
                Continuar →
              </button>
            )}

            {/* Steps 0+: navegação */}
            {currentStep >= 0 && (
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(prev => {
                    if (prev === 0) return collectData ? -2 : -3;
                    return prev - 1;
                  })}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl border-2 border-slate-200 text-slate-500 hover:border-slate-300 transition-all flex-shrink-0"
                >
                  <ChevronLeft size={20} />
                </button>

                {isLastVirtualStep ? (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !!(currentQuestion?.is_required && !answers[currentQuestion.id])}
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 active:scale-95 text-white text-sm font-semibold rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {isSubmitting ? 'Enviando...' : 'Enviar respostas'}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={!!(currentQuestion?.is_required && !answers[currentQuestion.id])}
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 active:scale-95 text-white text-sm font-semibold rounded-2xl transition-all"
                  >
                    Próximo →
                  </button>
                )}
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};

export default SurveyResponseForm;