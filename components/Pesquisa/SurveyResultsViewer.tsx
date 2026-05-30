import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ensureSession } from '../../services/authService';
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
} from '../../types';
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
  const [answers, setAnswers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'analise' | 'respondentes'>('analise');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchData();
  }, [survey.id, selectedStoreId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await ensureSession();
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
        const parsedAnswers: any[] = [];
        rData.forEach(r => {
          const respObj = r.responses || {};
          Object.entries(respObj).forEach(([qId, val]) => {
            parsedAnswers.push({
              response_id: r.id,
              question_id: qId,
              answer_text: val
            });
          });
        });
        setAnswers(parsedAnswers);
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
    const questionAnswers = responses
      .map(r => (r as any).responses?.[question.id])
      .filter(v => v !== undefined && v !== null);
    if (question.question_type === 'rating') {
      const vals = questionAnswers.map(v => Number(v)).filter(n => !isNaN(n));
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { avg: avg.toFixed(1), total: vals.length };
    }
    if (question.question_type === 'multiple_choice' || question.question_type === 'yes_no') {
      const counts: Record<string, number> = {};
      const motivos: string[] = [];
      questionAnswers.forEach(v => {
        if (typeof v === 'object' && v !== null) {
          if (v.motivo) motivos.push(v.motivo);
          const val = v.value || 'Sem Resposta';
          counts[val] = (counts[val] || 0) + 1;
        } else {
          const val = String(v) || 'Sem Resposta';
          counts[val] = (counts[val] || 0) + 1;
        }
      });
      return {
        stats: Object.entries(counts).map(([name, value]) => ({ name, value })),
        motivos
      };
    }
    return questionAnswers.map(v =>
      typeof v === 'object' ? (v.value + (v.motivo ? ' — ' + v.motivo : '')) : String(v)
    ).filter(Boolean);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const handleExport = () => {
    if (responses.length === 0) return;
    const rows = responses.map(r => ({
      Nome: (r as any).respondent_name || '',
      Email: (r as any).respondent_email || '',
      Telefone: (r as any).respondent_phone || '',
      Data: new Date((r as any).created_at).toLocaleString('pt-BR'),
      ...Object.fromEntries(questions.map(q => {
        const v = (r as any).responses?.[q.id];
        if (!v) return [q.question_text, ''];
        if (typeof v === 'object') return [q.question_text, `${v.value}${v.motivo ? ' - ' + v.motivo : ''}`];
        return [q.question_text, String(v)];
      }))
    }));
    const csv = [
      Object.keys(rows[0]).join(';'),
      ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultados-${survey.title}-${new Date().toLocaleDateString('pt-BR')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">{survey.title}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{responses.length} respostas recebidas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white outline-none">
            <option value="all">Todas as Lojas</option>
            {stores.map(s => <option key={s.id} value={s.id}>Loja {s.number} - {s.city}</option>)}
          </select>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* CARDS RESUMO */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Respostas', value: responses.length, hint: 'total recebidas' },
          { label: 'Última resposta', value: responses.length > 0 ? new Date((responses[0] as any).created_at).toLocaleDateString('pt-BR') : '—', hint: (responses[0] as any)?.respondent_name?.split(' ')[0] || '' },
          { label: 'Perguntas', value: questions.length, hint: 'no formulário' }
        ].map((c, i) => (
          <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{c.label}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{c.value}</p>
            <p className="text-[10px] text-slate-400 mt-1">{c.hint}</p>
          </div>
        ))}
      </div>

      {/* ABAS */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-0">
        {(['analise', 'respondentes'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {tab === 'analise' ? 'Análise' : 'Respondentes'}
          </button>
        ))}
      </div>

      {/* ABA ANÁLISE */}
      {activeTab === 'analise' && (
        isLoading ? (
          <div className="py-20 text-center"><Loader2 className="animate-spin text-blue-600 mx-auto" size={40} /></div>
        ) : responses.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
            <BarChart3 size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-black uppercase text-slate-400 tracking-widest">Nenhuma resposta ainda</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const stats = calculateStats(q);
              const COLORS = ['#378ADD', '#639922', '#BA7517', '#E24B4A', '#7F77DD', '#D4537E'];
              return (
                <div key={q.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="w-6 h-6 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0">{idx + 1}</span>
                    <p className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white leading-snug line-clamp-2">{q.question_text}</p>
                  </div>

                  {/* RATING */}
                  {q.question_type === 'rating' && (
                    <div className="flex items-center gap-4">
                      <p className="text-4xl font-black text-blue-600">{(stats as any).avg}</p>
                      <div>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(i => <Star key={i} size={14} fill={i <= Math.round(Number((stats as any).avg)) ? '#378ADD' : 'none'} className="text-blue-400" />)}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{(stats as any).total} avaliações</p>
                      </div>
                    </div>
                  )}

                  {/* MULTIPLE CHOICE / BOOLEAN — BARRAS HORIZONTAIS CSS */}
                  {(q.question_type === 'multiple_choice' || q.question_type === 'yes_no') && (
                    <div className="space-y-2">
                      {((stats as any).stats as {name: string, value: number}[]).map((item, i) => {
                        const pct = responses.length > 0 ? Math.round((item.value / responses.length) * 100) : 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500 w-36 truncate flex-shrink-0">{item.name}</span>
                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 w-12 text-right flex-shrink-0">{item.value} · {pct}%</span>
                          </div>
                        );
                      })}
                      {q.question_type === 'yes_no' && (stats as any).motivos?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1"><MessageSquare size={11} /> {(stats as any).motivos.length} motivo(s) do não</p>
                          {((stats as any).motivos as string[]).map((m, i) => (
                            <p key={i} className="text-xs text-slate-500 italic bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 mb-1">"{m}"</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TEXT */}
                  {q.question_type === 'short_text' && (
                    <div className="space-y-2">
                      {((stats as string[]).slice(0, 3)).map((text, i) => (
                        <p key={i} className="text-xs text-slate-500 italic bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">"{text}"</p>
                      ))}
                      {(stats as string[]).length > 3 && (
                        <p className="text-xs text-blue-600 font-bold">+ {(stats as string[]).length - 3} respostas</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ABA RESPONDENTES */}
      {activeTab === 'respondentes' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-slate-400 text-[9px] w-32">Nome</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-slate-400 text-[9px] w-28">Telefone</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-slate-400 text-[9px] w-20">Data</th>
                  {questions.map((q, i) => (
                    <th key={q.id} className="text-left p-3 font-black uppercase tracking-widest text-slate-400 text-[9px]">P{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {responses.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((r: any, i) => (
                  <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="p-3 font-bold text-slate-700 dark:text-slate-300 truncate">{r.respondent_name || '—'}</td>
                    <td className="p-3 text-slate-500 truncate">{r.respondent_phone || '—'}</td>
                    <td className="p-3 text-slate-400">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                    {questions.map(q => {
                      const v = r.responses?.[q.id];
                      const txt = !v ? '—' : typeof v === 'object' ? v.value : String(v);
                      return <td key={q.id} className="p-3 text-slate-500 truncate">{txt}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {Math.min((currentPage - 1) * PAGE_SIZE + 1, responses.length)}–{Math.min(currentPage * PAGE_SIZE, responses.length)} de {responses.length}
            </p>
            <div className="flex gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-slate-200 rounded-xl disabled:opacity-30 hover:bg-slate-50 transition-all">Anterior</button>
              <button disabled={currentPage * PAGE_SIZE >= responses.length} onClick={() => setCurrentPage(p => p + 1)}
                className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-slate-200 rounded-xl disabled:opacity-30 hover:bg-slate-50 transition-all">Próximo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyResultsViewer;
