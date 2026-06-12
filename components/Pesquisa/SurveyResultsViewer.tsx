import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ensureSession } from '../../services/authService';
import { toast } from 'sonner';
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
  Loader2,
  Package,
  ShoppingBag,
  Check,
  X,
  ShoppingCart
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

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOrders, setGeneratedOrders] = useState<any[]>([]);

  const handleGenerateOrders = async () => {
    if (isGenerating) return;
    
    // Verificar se tem respostas
    if (responses.length === 0) {
      toast.error('Nenhuma resposta para gerar pedido');
      return;
    }
    
    setIsGenerating(true);
    try {
      await ensureSession();
      
      const { data, error } = await supabase.rpc('fn_generate_orders_from_survey', {
        p_survey_id: survey.id,
        p_user_id: currentUser.id,
        p_user_name: currentUser.name || 'Admin',
      });
      
      if (error) throw error;
      
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      
      if (data?.success) {
        setGeneratedOrders(data.orders || []);
        toast.success(
          `${data.orders_created} pedido${data.orders_created > 1 ? 's' : ''} criado${data.orders_created > 1 ? 's' : ''} como rascunho!`
        );
      }
    } catch (err: any) {
      toast.error('Erro ao gerar pedido: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

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

    if (question.question_type === 'product_item') {
      const product = (question.options && typeof question.options === 'object' && !Array.isArray(question.options))
        ? question.options as Record<string, any>
        : {};
      
      let simCount = 0;
      let naoCount = 0;
      const gradeAgregada: Record<string, number> = {};
      let totalPares = 0;
      const motivos: string[] = [];

      questionAnswers.forEach(v => {
        if (typeof v === 'object' && v !== null) {
          if (v.value === 'SIM') {
            simCount++;
            if (v.grade && typeof v.grade === 'object') {
              Object.entries(v.grade).forEach(([tam, qty]) => {
                gradeAgregada[tam] = (gradeAgregada[tam] || 0) + Number(qty);
              });
            }
            totalPares += v.total_pares || 0;
          } else {
            naoCount++;
            if (v.motivo) motivos.push(v.motivo);
          }
        } else if (v === 'SIM') {
          simCount++;
        } else if (v === 'NÃO') {
          naoCount++;
        }
      });

      const custardPares = product.preco_custo ? totalPares * Number(product.preco_custo) : 0;
      const vendaPares = product.preco_venda ? totalPares * Number(product.preco_venda) : 0;

      return {
        type: 'product_item',
        product,
        simCount,
        naoCount,
        gradeAgregada,
        totalPares,
        custoPares: custardPares,
        vendaPares,
        motivos,
        total: questionAnswers.length,
      };
    }

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
        if (typeof v === 'object') {
          if (q.question_type === 'product_item') {
            const grade = v.grade ? Object.entries(v.grade).map(([t, qty]) => `${t}:${qty}`).join(' ') : '';
            return [q.question_text, `${v.value} | ${v.total_pares || 0} pares | ${grade}`];
          }
          return [q.question_text, `${v.value}${v.motivo ? ' - ' + v.motivo : ''}`];
        }
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
          {(survey as any).order_status !== 'generated' ? (
            <button 
              onClick={handleGenerateOrders}
              disabled={isGenerating || responses.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-green-200 dark:shadow-none"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <ShoppingCart size={14} />
                  Gerar Pedido
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-black uppercase tracking-widest">
              <ShoppingCart size={14} />
              Pedido Gerado
            </div>
          )}
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

      {generatedOrders.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5 space-y-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-green-600">
            Pedidos gerados com sucesso
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {generatedOrders.map((order: any, i: number) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-green-100 dark:border-green-900">
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  PGD-{order.numero_pedido}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {order.lojas} loja{order.lojas > 1 ? 's' : ''} · {order.itens} ite{order.itens > 1 ? 'ns' : 'm'}
                </p>
                <p className="text-[10px] text-green-600 font-bold mt-1">
                  Status: Rascunho
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-green-600">
            Abra o módulo de Compras para completar os pedidos (prazos, faturamento).
          </p>
        </div>
      )}

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

                  {/* PRODUCT ITEM */}
                  {q.question_type === 'product_item' && (stats as any).type === 'product_item' && (() => {
                    const s = stats as any;
                    const product = s.product || {};
                    const pctSim = s.total > 0 ? Math.round((s.simCount / s.total) * 100) : 0;
                    
                    return (
                      <div className="space-y-4">
                        {/* Card do produto com foto */}
                        <div className="flex gap-4 items-start">
                          {product.image_url ? (
                            <img 
                              src={product.image_url} 
                              alt={product.descricao || 'Produto'}
                              className="w-24 h-24 object-contain bg-slate-50/50 rounded-xl border border-slate-100 dark:border-slate-800 flex-shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-center flex-shrink-0">
                              <Package size={24} className="text-slate-300" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-black text-slate-900 dark:text-white">{product.marca || '—'}</p>
                              {product.categoria && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                                  product.categoria === 'masculino' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' :
                                  product.categoria === 'feminino' ? 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400' :
                                  product.categoria === 'infantil' ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400' :
                                  'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400'
                                }`}>
                                  {product.categoria.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Ref: {product.referencia || '—'} · Cor: {[product.cor1 || product.cor, product.cor2, product.cor3].filter(Boolean).join(' / ') || '—'}
                            </p>
                            {product.descricao && (
                              <p className="text-xs text-slate-500 mt-1">{product.descricao}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {product.preco_custo && (
                                <span className="text-xs text-slate-400">
                                  Custo: <span className="font-bold">R$ {Number(product.preco_custo).toFixed(2).replace('.', ',')}</span>
                                </span>
                              )}
                              {product.preco_venda && (
                                <span className="text-xs text-green-600">
                                  Venda: <span className="font-bold">R$ {Number(product.preco_venda).toFixed(2).replace('.', ',')}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Barra de aprovação SIM/NÃO */}
                        <div className="bg-slate-50 dark:bg-slate-805/40 dark:bg-slate-800 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Aprovação</span>
                            <span className="text-xs font-bold text-slate-500">{s.total} resposta{s.total !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 bg-green-500 rounded-full" />
                              <span className="text-xs font-bold text-green-600">SIM {s.simCount}</span>
                            </div>
                            <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                              <div className="h-full bg-green-500 rounded-l-full transition-all" style={{ width: `${pctSim}%` }} />
                              <div className="h-full bg-red-400 rounded-r-full transition-all" style={{ width: `${100 - pctSim}%` }} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-red-500">NÃO {s.naoCount}</span>
                              <span className="w-3 h-3 bg-red-400 rounded-full" />
                            </div>
                          </div>
                        </div>

                        {/* Grade agregada */}
                        {Object.keys(s.gradeAgregada).length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Grade Solicitada</span>
                              <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-md">
                                {s.totalPares} {product.categoria === 'acessorio' ? 'unidades' : 'pares'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(s.gradeAgregada)
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([tam, qty]) => (
                                  <div key={tam} className="flex flex-col items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 min-w-[48px]">
                                    <span className="text-[10px] font-bold text-slate-400">{tam}</span>
                                    <span className="text-sm font-black text-slate-900 dark:text-white">{qty as number}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Totais financeiros */}
                        {(s.custoPares > 0 || s.vendaPares > 0) && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Custo</p>
                              <p className="text-lg font-black text-slate-600 dark:text-slate-300">
                                R$ {s.custoPares.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                              </p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                              <p className="text-[9px] font-black uppercase tracking-widest text-green-500 mb-1">Total Venda</p>
                              <p className="text-lg font-black text-green-600">
                                R$ {s.vendaPares.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Motivos do NÃO */}
                        {s.motivos.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
                              <MessageSquare size={11} /> {s.motivos.length} motivo(s) da recusa
                            </p>
                            {s.motivos.map((m: string, i: number) => (
                              <p key={i} className="text-xs text-slate-500 italic bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 mb-1">"{m}"</p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
                      let txt = '—';
                      if (v) {
                        if (typeof v === 'object' && v !== null) {
                          if (q.question_type === 'product_item') {
                            const pares = v.total_pares || 0;
                            txt = v.value === 'SIM' ? `✅ SIM (${pares}p)` : '❌ NÃO';
                          } else {
                            txt = v.value + (v.motivo ? ' — ' + v.motivo : '');
                          }
                        } else {
                          txt = String(v);
                        }
                      }
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
