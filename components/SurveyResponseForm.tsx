import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Star, 
  CheckCircle2,
  Loader2,
  MessageSquare,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Survey, SurveyQuestion, User } from '../types';

interface SurveyResponseFormProps {
  survey: Survey;
  user?: User; // Se for interno
  invitationToken?: string; // Se for externo
  onClose: () => void;
  onComplete: () => void;
}

const SurveyResponseForm: React.FC<SurveyResponseFormProps> = ({ survey, user, invitationToken, onClose, onComplete }) => {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);
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
      setQuestions(data || []);
    } catch (err) {
      console.error('Erro ao buscar perguntas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  const handleSubmit = async () => {
    // Validar obrigatórias
    const missingRequired = questions.filter(q => q.is_required && !answers[q.id]);
    if (missingRequired.length > 0) {
      alert(`Por favor, responda todas as perguntas obrigatórias.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Criar cabeçalho da resposta
      const { data: response, error: rError } = await supabase
        .from('survey_responses')
        .insert([{
          survey_id: survey.id,
          user_id: user?.id || null,
          invitation_id: invitationToken ? null : null, // Aqui precisaria buscar o ID do convite pelo token se for externo
          store_id: user?.storeId || null
        }])
        .select()
        .single();
      
      if (rError) throw rError;

      // 2. Criar detalhes das respostas
      const details = Object.entries(answers).map(([qId, val]) => ({
        response_id: response.id,
        question_id: qId,
        answer_text: String(val)
      }));

      const { error: dError } = await supabase.from('survey_answer_details').insert(details);
      if (dError) throw dError;

      // 3. Se for externo, marcar convite como respondido (lógica futura)

      setIsCompleted(true);
      setTimeout(() => {
        onComplete();
      }, 3000);
    } catch (err: any) {
      console.error('Erro ao enviar resposta:', err);
      alert('Erro ao enviar resposta: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[1100] bg-white dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="fixed inset-0 z-[1100] bg-white dark:bg-slate-950 flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="w-24 h-24 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-green-100 dark:shadow-none">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Obrigado!</h2>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest">Sua resposta foi enviada com sucesso e será analisada pela nossa equipe.</p>
          <div className="pt-8">
            <Loader2 className="animate-spin text-blue-600 mx-auto" size={24} />
            <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest">Redirecionando...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
          >
            <X size={24} />
          </button>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">{survey.title}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pergunta {currentStep + 1} de {questions.length}</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <div className="w-48 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-blue-600"
            />
          </div>
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{Math.round(progress)}%</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-12 flex items-center justify-center no-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-2xl space-y-12"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black italic text-lg shadow-lg shadow-blue-200 dark:shadow-none">
                  {currentStep + 1}
                </span>
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-tight">
                  {currentQuestion.question_text}
                  {currentQuestion.is_required && <span className="text-red-500 ml-2">*</span>}
                </h2>
              </div>
            </div>

            <div className="space-y-6">
              {currentQuestion.question_type === 'text' && (
                <textarea 
                  autoFocus
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="DIGITE SUA RESPOSTA AQUI..."
                  rows={4}
                  className="w-full px-8 py-6 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-blue-600 rounded-[32px] text-lg font-bold text-slate-900 dark:text-white outline-none shadow-xl shadow-slate-200/50 dark:shadow-none transition-all resize-none"
                />
              )}

              {currentQuestion.question_type === 'rating' && (
                <div className="flex justify-between gap-2 md:gap-4">
                  {[1, 2, 3, 4, 5].map(val => (
                    <button
                      key={val}
                      onClick={() => handleAnswerChange(currentQuestion.id, val)}
                      className={`flex-1 aspect-square md:aspect-auto md:py-8 rounded-[32px] flex flex-col items-center justify-center gap-2 transition-all border-2 ${
                        answers[currentQuestion.id] === val
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200 dark:shadow-none scale-105'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-blue-200'
                      }`}
                    >
                      <Star size={32} fill={answers[currentQuestion.id] === val ? 'currentColor' : 'none'} />
                      <span className="text-xl font-black italic">{val}</span>
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.question_type === 'multiple_choice' && (
                <div className="grid grid-cols-1 gap-4">
                  {currentQuestion.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswerChange(currentQuestion.id, opt)}
                      className={`w-full px-8 py-6 rounded-[32px] text-left font-black uppercase tracking-widest text-sm transition-all border-2 flex items-center justify-between ${
                        answers[currentQuestion.id] === opt
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200 dark:shadow-none'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-blue-200'
                      }`}
                    >
                      {opt}
                      {answers[currentQuestion.id] === opt && <Check size={24} />}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.question_type === 'boolean' && (
                <div className="grid grid-cols-2 gap-6">
                  {['SIM', 'NÃO'].map(val => (
                    <button
                      key={val}
                      onClick={() => handleAnswerChange(currentQuestion.id, val)}
                      className={`w-full py-12 rounded-[32px] font-black uppercase tracking-widest text-xl transition-all border-2 ${
                        answers[currentQuestion.id] === val
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200 dark:shadow-none scale-105'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-blue-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-6 md:p-8 flex items-center justify-between shrink-0">
        <button 
          disabled={currentStep === 0}
          onClick={() => setCurrentStep(currentStep - 1)}
          className={`px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${
            currentStep === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ChevronLeft size={20} /> Anterior
        </button>

        {currentStep === questions.length - 1 ? (
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || (currentQuestion.is_required && !answers[currentQuestion.id])}
            className={`bg-green-600 hover:bg-green-700 text-white px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-green-200 dark:shadow-none transition-all active:scale-95 flex items-center gap-2 ${
              (isSubmitting || (currentQuestion.is_required && !answers[currentQuestion.id])) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />} Finalizar Resposta
          </button>
        ) : (
          <button 
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={currentQuestion.is_required && !answers[currentQuestion.id]}
            className={`bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-200 dark:shadow-none transition-all active:scale-95 flex items-center gap-2 ${
              (currentQuestion.is_required && !answers[currentQuestion.id]) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Próxima <ChevronRight size={20} />
          </button>
        )}
      </footer>
    </div>
  );
};

export default SurveyResponseForm;
