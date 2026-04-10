import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  BarChart3, 
  Users, 
  Store as StoreIcon, 
  Calendar, 
  ChevronRight, 
  Download,
  Filter,
  PieChart as PieChartIcon,
  MessageSquare,
  Star,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Survey, 
  SurveyQuestion, 
  SurveyResponse, 
  SurveyAnswerDetail,
  Store,
  AdminUser,
  User
} from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface SurveyResultsViewerProps {
  survey: Survey;
  currentUser: User;
  stores: Store[];
  onBack: () => void;
}

const SurveyResultsViewer: React.FC<SurveyResultsViewerProps> = ({ survey, currentUser, stores, onBack }) => {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [answers, setAnswers] = useState<SurveyAnswerDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, [survey.id, selectedStoreId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Buscar perguntas
      const { data: qData, error: qError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', survey.id)
        .order('sort_order', { ascending: true });
      if (qError) throw qError;
      setQuestions(qData || []);

      // 2. Buscar respostas (filtradas por loja se necessário)
      let query = supabase
        .from('survey_responses')
        .select('*')
        .eq('survey_id', survey.id);
      
      if (selectedStoreId !== 'all') {
        query = query.eq('store_id', selectedStoreId);
      }

      const { data: rData, error: rError } = await query;
      if (rError) throw rError;
      setResponses(rData || []);

      // 3. Buscar detalhes das respostas
      if (rData && rData.length > 0) {
        const responseIds = rData.map(r => r.id);
        const { data: aData, error: aError } = await supabase
          .from('survey_answer_details')
          .select('*')
          .in('response_id', responseIds);
        if (aError) throw aError;
        setAnswers(aData || []);
      } else {
        setAnswers([]);
      }
    } catch (err) {
      console.error('Erro ao buscar resultados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (question: SurveyQuestion) => {
    const questionAnswers = answers.filter(a => a.question_id === question.id);
    
    if (question.question_type === 'rating') {
      const vals = questionAnswers.map(a => Number(a.answer_text)).filter(n => !isNaN(n));
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { avg: avg.toFixed(1), total: vals.length };
    }

    if (question.question_type === 'multiple_choice' || question.question_type === 'boolean') {
      const counts: Record<string, number> = {};
      questionAnswers.forEach(a => {
        const val = a.answer_text || 'Sem Resposta';
        counts[val] = (counts[val] || 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }

    return questionAnswers.map(a => a.answer_text).filter(Boolean);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-2xl border border-slate-100 dark:border-slate-800 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
              Resultados: {survey.title}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">
              {responses.length} Respostas Recebidas
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="pl-12 pr-8 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
            >
              <option value="all">Todas as Lojas</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>Loja {s.number} - {s.city}</option>
              ))}
            </select>
          </div>
          <button className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 transition-all shadow-lg">
            <Download size={20} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center">
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={48} />
        </div>
      ) : responses.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <BarChart3 size={48} className="text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white tracking-widest">Nenhum dado disponível</h3>
          <p className="text-slate-500 text-xs font-bold uppercase mt-2">Aguarde as primeiras respostas para visualizar os resultados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {questions.map((q, idx) => {
            const stats = calculateStats(q);
            return (
              <motion.div 
                key={q.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-8">
                  <span className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center font-black italic text-lg">
                    {idx + 1}
                  </span>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">
                    {q.question_text}
                  </h3>
                </div>

                {q.question_type === 'rating' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    <div className="text-center p-8 bg-blue-50 dark:bg-blue-900/20 rounded-[32px]">
                      <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-2">Média Geral</p>
                      <h4 className="text-6xl font-black text-blue-600 italic tracking-tighter">{(stats as any).avg}</h4>
                      <div className="flex justify-center gap-1 mt-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={20} fill={i < Math.round(Number((stats as any).avg)) ? '#3b82f6' : 'none'} className="text-blue-600" />
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={questions.map((_, i) => ({ name: i + 1, value: Math.random() * 5 }))}> {/* Mock distribution */}
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {(q.question_type === 'multiple_choice' || q.question_type === 'boolean') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats as any[]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {(stats as any[]).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-4">
                      {(stats as any[]).map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-black text-slate-900 dark:text-white">{item.value}</span>
                            <span className="text-[10px] font-bold text-slate-400">{Math.round((item.value / responses.length) * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {q.question_type === 'text' && (
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-4 no-scrollbar">
                    {(stats as string[]).map((text, i) => (
                      <div key={i} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[24px] border border-slate-100 dark:border-slate-800 flex gap-4">
                        <div className="p-2 bg-white dark:bg-slate-700 rounded-xl h-fit text-slate-400">
                          <MessageSquare size={16} />
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 italic leading-relaxed">
                          "{text}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SurveyResultsViewer;
