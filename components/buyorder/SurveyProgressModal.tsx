import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../services/supabaseClient';
import { X, Check, Clock, User, Award, ListFilter, PlayCircle, Eye, ChevronDown, ChevronUp } from 'lucide-react';

interface SurveyProgressModalProps {
  orderId: string;
  numeroPedido: number;
  marca: string;
  user: any;
  onClose: () => void;
  onFinalized: () => void;
}

export default function SurveyProgressModal({
  orderId,
  numeroPedido,
  marca,
  user,
  onClose,
  onFinalized,
}: SurveyProgressModalProps) {
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [subOrders, setSubOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'progress' | 'results'>('progress');
  const [expandedStoreRef, setExpandedStoreRef] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!order) return;
    const prazoHoras = order.survey_params?.prazo_horas || 24;
    const deadline = new Date(order.created_at).getTime() + prazoHoras * 60 * 60 * 1000;
    function tick() {
      const remaining = deadline - Date.now();
      if (remaining <= 0) { setTimeLeft(0); setIsExpired(true); }
      else { setTimeLeft(remaining); setIsExpired(false); }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order]);

  function formatCountdown(ms: number): string {
    if (ms <= 0) return 'ENCERRADO';
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
    if (m > 0) return `${m}m ${String(s).padStart(2,'0')}s`;
    return `${s}s`;
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // 1. Fetch order
        const { data: orderData, error: oErr } = await supabase
          .from('buy_orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (oErr) throw oErr;
        setOrder(orderData);

        // 2. Fetch sub orders
        const { data: subOrdersData, error: subErr } = await supabase
          .from('buy_order_sub_orders')
          .select('*')
          .eq('order_id', orderId);

        if (subErr) throw subErr;
        setSubOrders(subOrdersData || []);

        // 3. Fetch items
        const { data: itemsData, error: itemsErr } = await supabase
          .from('buy_order_items')
          .select('*')
          .eq('order_id', orderId);

        if (itemsErr) throw itemsErr;
        setItems(itemsData || []);
      } catch (err: any) {
        console.error('Error loading survey progress:', err);
        toast.error('Erro ao carregar progresso da pesquisa');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [orderId]);

  // Decode grades helper
  function gradesArrayToObject(grades: any): Record<string, any> {
    if (!grades) return {};
    if (!Array.isArray(grades)) {
      const keys = Object.keys(grades);
      if (keys.length > 0 && keys.every(k => /^[A-H]$/.test(k))) {
        return grades;
      }
      return {};
    }
    const result: Record<string, any> = {};
    for (const g of grades) {
      if (g && g.letra) {
        result[g.letra] = g.tamanhos || {};
      }
    }
    return result;
  }

  // Get votes list from order survey_params
  const votesList = useMemo(() => {
    if (!order || !order.survey_params) return [];
    return order.survey_params.votos || [];
  }, [order]);

  // Map suborder voting progress
  const progressMetrics = useMemo(() => {
    let totalStores = 0;
    let totalVoted = 0;

    const subOrderProgress = subOrders.map((sub: any) => {
      const storeNums = sub.lojas_numeros || [];
      totalStores += storeNums.length;

      const storesStatus = storeNums.map((storeNum: number) => {
        const matchingVote = votesList.find((v: any) => String(v.store_number) === String(storeNum));
        if (matchingVote) {
          totalVoted += 1;
        }
        return {
          storeNum,
          voted: !!matchingVote,
          voteData: matchingVote || null,
        };
      });

      return {
        ...sub,
        storesStatus,
        votedCount: storesStatus.filter(s => s.voted).length,
        totalCount: storeNums.length,
      };
    });

    return {
      subOrderProgress,
      totalStores,
      totalVoted,
      percentage: totalStores > 0 ? Math.round((totalVoted / totalStores) * 100) : 0,
    };
  }, [subOrders, votesList]);

  // Calculate vote tally per item
  const itemVoteTally = useMemo(() => {
    return items.map((item: any) => {
      let yesVotes = 0;
      const gradeBreakdown: Record<string, number> = {};

      votesList.forEach((vote: any) => {
        const itemVote = vote.itens?.find((vi: any) => vi.ref === item.referencia);
        if (itemVote && itemVote.voto) {
          yesVotes += 1;
          const grade = itemVote.grade_letra;
          if (grade) {
            gradeBreakdown[grade] = (gradeBreakdown[grade] || 0) + 1;
          }
        }
      });

      return {
        ...item,
        yesVotes,
        gradeBreakdown,
      };
    });
  }, [items, votesList]);

  // Handle final consolidation and closure of survey
  const handleFinalize = async () => {
    if (votesList.length === 0) {
      const confirmNoVotes = window.confirm('Nenhuma loja votou ainda. Deseja realmente finalizar a pesquisa sem votos?');
      if (!confirmNoVotes) return;
    } else {
      const confirmClose = window.confirm('Deseja realmente encerrar a pesquisa? O pedido voltará ao status de rascunho com os votos consolidados.');
      if (!confirmClose) return;
    }

    setFinalizing(true);
    try {
      // 1. Delete existing sub-order grades to prevent duplication
      const itemIds = items.map(i => i.id);
      if (itemIds.length > 0) {
        const { error: delErr } = await supabase
          .from('buy_order_item_suborder_grades')
          .delete()
          .in('item_id', itemIds);
        if (delErr) throw delErr;
      }

      // 2. Compute majority grade for each suborder and item
      const gradesToInsert: any[] = [];
      
      subOrders.forEach((sub: any) => {
        const storeNumsInSub = (sub.lojas_numeros || []).map(String);

        items.forEach((item: any) => {
          // Track votes for grade choices from stores belonging to this sub-order
          const gradeCounts: Record<string, number> = {};
          
          votesList.forEach((vote: any) => {
            if (storeNumsInSub.includes(String(vote.store_number))) {
              const itemVote = vote.itens?.find((vi: any) => vi.ref === item.referencia);
              if (itemVote && itemVote.voto && itemVote.grade_letra) {
                gradeCounts[itemVote.grade_letra] = (gradeCounts[itemVote.grade_letra] || 0) + 1;
              }
            }
          });

          // Find grade letter with majority votes
          let chosenGrade = '';
          let maxVotes = 0;
          Object.entries(gradeCounts).forEach(([grade, count]) => {
            if (count > maxVotes) {
              maxVotes = count;
              chosenGrade = grade;
            }
          });

          // Fallback: If no vote, take first grade from item.grades if available
          if (!chosenGrade && item.grades) {
            const gradesObj = gradesArrayToObject(item.grades);
            const letters = Object.keys(gradesObj);
            if (letters.length > 0) {
              chosenGrade = letters[0];
            }
          }

          if (chosenGrade) {
            gradesToInsert.push({
              item_id: item.id,
              sub_order_num: sub.sub_order_num,
              grade_letra: chosenGrade,
            });
          }
        });
      });

      // 3. Save consolidated grades to DB
      if (gradesToInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('buy_order_item_suborder_grades')
          .insert(gradesToInsert);
        if (insErr) throw insErr;
      }

      // 4. Update the order status to "rascunho"
      const { error: updErr } = await supabase
        .from('buy_orders')
        .update({ status: 'rascunho' })
        .eq('id', orderId);

      if (updErr) throw updErr;

      toast.success('Pesquisa encerrada e consolidada com sucesso!');
      onFinalized();
    } catch (err: any) {
      console.error('Error closing survey:', err);
      toast.error(err?.message || 'Erro ao encerrar a pesquisa');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
        <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-4 shadow-2xl">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-black text-slate-700">Carregando painel de progresso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] px-4 py-6 md:p-10">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-full flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="bg-purple-950 text-white px-6 py-4 flex justify-between items-center shrink-0 border-b border-purple-900">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <span className="text-[10px] bg-purple-900/80 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Painel do Comprador / Admin
              </span>
              <h3 className="font-black text-base md:text-lg tracking-tight mt-0.5">
                Progresso da Pesquisa: {marca} - Pedido #{numeroPedido}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-purple-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Global Stats bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-5 shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Adesão Total</p>
            <h4 className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
              {progressMetrics.totalVoted} <span className="text-sm text-slate-400 font-semibold">de {progressMetrics.totalStores} lojas</span>
            </h4>
          </div>

          <div className="flex flex-col">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
              <span>PROGRESSO DA PESQUISA</span>
              <span>{progressMetrics.percentage}%</span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                style={{ width: `${progressMetrics.percentage}%` }}
              ></div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {timeLeft !== null && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase ${
                isExpired
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : timeLeft < 3600000
                    ? 'bg-amber-50 border-amber-300 text-amber-700 animate-pulse'
                    : 'bg-purple-50 border-purple-200 text-purple-700'
              }`}>
                <Clock size={12} />
                <span>{isExpired ? '⏰ Prazo encerrado' : `Encerra em ${formatCountdown(timeLeft)}`}</span>
              </div>
            )}
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow flex items-center gap-2 transition-all ${
                finalizing 
                  ? 'bg-purple-400 cursor-wait' 
                  : 'bg-purple-600 hover:bg-purple-700 hover:shadow-md'
              }`}
            >
              {finalizing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Consolidando...
                </>
              ) : (
                '🏁 Encerrar e Consolidar'
              )}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100 shrink-0">
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'progress'
                ? 'bg-white border-purple-600 text-purple-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
            }`}
          >
            📋 Lojas & Status de Votos
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'results'
                ? 'bg-white border-purple-600 text-purple-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
            }`}
          >
            ⭐ Consolidação dos Modelos ({items.length} itens)
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar text-left">
          {activeTab === 'progress' ? (
            <div className="space-y-6">
              {progressMetrics.subOrderProgress.map((sub: any) => (
                <div key={sub.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {/* Suborder title */}
                  <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                        Sub-Pedido #{sub.sub_order_num}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                        Faturamento: {sub.pedido_numero || 'Pendente'}
                      </p>
                    </div>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-black px-2.5 py-1 rounded-full">
                      🗳️ Votaram: {sub.votedCount} de {sub.totalCount}
                    </span>
                  </div>

                  {/* Stores list */}
                  <div className="divide-y divide-slate-100">
                    {sub.storesStatus.map((store: any) => {
                      const expandedKey = `${sub.sub_order_num}_${store.storeNum}`;
                      const isExpanded = expandedStoreRef === expandedKey;

                      return (
                        <div key={store.storeNum} className="p-4 flex flex-col">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="text-sm">🏪</span>
                              <div>
                                <h5 className="text-xs font-black text-slate-700 uppercase">
                                  Loja {store.storeNum}
                                </h5>
                                {store.voted && store.voteData && (
                                  <p className="text-[9px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                                    <User size={10} /> {store.voteData.user_name} •{' '}
                                    <Clock size={10} /> {new Date(store.voteData.voted_at).toLocaleString('pt-BR')}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {store.voted ? (
                                <>
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase">
                                    <Check size={10} className="stroke-[3]" /> Votou
                                  </span>
                                  <button
                                    onClick={() => setExpandedStoreRef(isExpanded ? null : expandedKey)}
                                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                                  >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                </>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase">
                                  Pendente
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Expanded Vote Details for this store */}
                          {isExpanded && store.voteData && (
                            <div className="mt-3 p-3 bg-purple-50/50 border border-purple-100/50 rounded-lg animate-in slide-in-from-top duration-150">
                              <h6 className="text-[10px] font-black text-purple-900 uppercase tracking-widest mb-2">
                                Detalhes das Escolhas da Loja
                              </h6>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {store.voteData.itens?.filter((vi: any) => vi.voto).map((vi: any) => (
                                  <div key={vi.ref} className="bg-white border border-purple-200/50 p-2 rounded-lg text-left shadow-xs">
                                    <p className="text-[10px] font-black text-slate-800">REF {vi.ref}</p>
                                    <div className="flex justify-between items-center mt-1">
                                      <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">
                                        Grade {vi.grade_letra}
                                      </span>
                                      <span className="text-[9px] text-slate-400 font-bold">
                                        {vi.total_pares} pares
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Item Tally Breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm p-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <ListFilter size={16} className="text-purple-600" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Frequência de Escolhas por Item
                  </h4>
                </div>

                <div className="space-y-4">
                  {itemVoteTally.map((item: any) => {
                    const progressPercent = progressMetrics.totalVoted > 0 
                      ? Math.round((item.yesVotes / progressMetrics.totalVoted) * 100) 
                      : 0;

                    // Find most voted grade
                    let mostVotedGrade = '-';
                    let maxVotes = 0;
                    Object.entries(item.gradeBreakdown || {}).forEach(([grade, count]) => {
                      const countNum = Number(count);
                      if (countNum > maxVotes) {
                        maxVotes = countNum;
                        mostVotedGrade = grade;
                      }
                    });

                    return (
                      <div key={item.referencia} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 last:border-b-0 gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-base">👠</span>
                          <div>
                            <h5 className="text-xs font-black text-slate-700 uppercase">
                              REF {item.referencia}
                            </h5>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                              {item.tipo || 'Modelo'} / {item.modelo || 'FEM'}
                            </p>
                          </div>
                        </div>

                        {/* Votes slider progress */}
                        <div className="flex-1 w-full max-w-xs flex flex-col">
                          <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                            <span>Votos Sim: {item.yesVotes} de {progressMetrics.totalVoted}</span>
                            <span>{progressPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 rounded-full" 
                              style={{ width: `${progressPercent}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Grade breakdowns */}
                        <div className="flex gap-2">
                          <div className="px-2 py-1 bg-purple-50 text-purple-800 border border-purple-100 rounded text-[9px] font-black uppercase text-center">
                            MAIORIA: GRADE {mostVotedGrade}
                          </div>
                          <div className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[9px] font-bold flex gap-1.5">
                            {Object.entries(item.gradeBreakdown || {}).map(([grade, count]) => (
                              <span key={grade}>
                                {grade}:{String(count)}
                              </span>
                            ))}
                            {Object.keys(item.gradeBreakdown || {}).length === 0 && (
                              <span className="italic text-slate-400">Nenhum voto</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
          >
            Fechar Janela
          </button>
        </div>

      </div>
    </div>
  );
}
