import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ClipboardList, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Survey, User } from '../types';
import SurveyResponseForm from './SurveyResponseForm';

interface MySurveysComponentProps {
  user: User;
}

const MySurveysComponent: React.FC<MySurveysComponentProps> = ({ user }) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [respondedIds, setRespondedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    setIsLoading(true);
    try {
      // 1. Buscar pesquisas visíveis para este usuário via RPC/Policy
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // 2. Buscar IDs das pesquisas que o usuário já respondeu
      const { data: responses, error: rError } = await supabase
        .from('survey_responses')
        .select('survey_id')
        .eq('user_id', user.id);
      
      if (rError) throw rError;

      setSurveys(data || []);
      setRespondedIds(responses?.map(r => r.survey_id) || []);
    } catch (err) {
      console.error('Erro ao buscar minhas pesquisas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResponseComplete = () => {
    setSelectedSurvey(null);
    fetchSurveys();
  };

  if (selectedSurvey) {
    return (
      <SurveyResponseForm 
        survey={selectedSurvey} 
        user={user} 
        onClose={() => setSelectedSurvey(null)} 
        onComplete={handleResponseComplete}
      />
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
            Minhas Pesquisas
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">
            Sua opinião é fundamental para melhorarmos nossos processos
          </p>
        </div>
      </div>

      {/* Surveys List */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 h-32 rounded-[32px] animate-pulse border border-slate-100 dark:border-slate-800" />
            ))
          ) : surveys.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardList size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white tracking-widest">Nenhuma pesquisa disponível</h3>
              <p className="text-slate-500 text-xs font-bold uppercase mt-2">Você não tem pesquisas pendentes no momento</p>
            </div>
          ) : surveys.map(survey => {
            const hasResponded = respondedIds.includes(survey.id);
            return (
              <motion.div
                key={survey.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all group overflow-hidden flex items-center p-6 md:p-8 gap-6 ${hasResponded ? 'opacity-70' : ''}`}
              >
                <div className={`p-4 rounded-2xl ${hasResponded ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 shadow-lg shadow-blue-100 dark:shadow-none'}`}>
                  {hasResponded ? <CheckCircle2 size={24} /> : <ClipboardList size={24} />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase italic tracking-tighter leading-tight group-hover:text-blue-600 transition-colors">
                      {survey.title}
                    </h3>
                    {hasResponded && (
                      <span className="bg-green-100 text-green-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Respondida</span>
                    )}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase line-clamp-1">
                    {survey.description || 'Sem descrição'}
                  </p>
                </div>

                <div className="hidden md:flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock size={12} />
                    <span className="text-[8px] font-black uppercase tracking-widest">
                      {new Date(survey.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {!hasResponded && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <AlertCircle size={12} />
                      <span className="text-[8px] font-black uppercase tracking-widest">Pendente</span>
                    </div>
                  )}
                </div>

                <button 
                  disabled={hasResponded}
                  onClick={() => setSelectedSurvey(survey)}
                  className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 ${
                    hasResponded 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white shadow-lg'
                  }`}
                >
                  {hasResponded ? 'Visualizar' : 'Responder'} <ArrowRight size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MySurveysComponent;
