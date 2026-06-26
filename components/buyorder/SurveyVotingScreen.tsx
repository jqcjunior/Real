import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../services/supabaseClient';
import { X, Check, AlertCircle, Info, HelpCircle } from 'lucide-react';

const GRADE_LETTERS = ['A','B','C','D','E','F','G','H'];

const CATS: Record<string, { sizes: string[] }> = {
  MASC: { sizes: [37,38,39,40,41,42,43,44,45,46,47,48].map(String) },
  FEM:  { sizes: [33,34,35,36,37,38,39,40,41,42].map(String) },
  INF:  { sizes: [16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36].map(String) },
  ACES: { sizes: ['UN','P','M','G','GG'] },
};

const CATS_INFO: Record<string, { label: string; color: string; bg: string; border: string }> = {
  MASC: { label: 'ADULTO MASCULINO', color: 'text-blue-800',   bg: 'bg-blue-50',   border: 'border-blue-300' },
  FEM:  { label: 'ADULTO FEMININO',  color: 'text-pink-800',   bg: 'bg-pink-50',   border: 'border-pink-300' },
  INF:  { label: 'INFANTIL',         color: 'text-orange-800', bg: 'bg-orange-50', border: 'border-orange-400' },
  ACES: { label: 'ACESSÓRIO',        color: 'text-slate-700',  bg: 'bg-slate-100', border: 'border-slate-300' },
};

function getItemTipo(item: any): string {
  // item.modelo = 'MASC' | 'FEM' | 'INF' | 'ACES'
  // item.tipo   = descrição completa ex: 'CHINELO MASCULINO'
  const t = (item.modelo || item.tipo || '').toUpperCase();
  if (t === 'FEM'  || t.includes('FEMININO'))  return 'FEM';
  if (t === 'INF'  || t.includes('INFANTIL'))  return 'INF';
  if (t === 'ACES' || t.includes('ACESS'))     return 'ACES';
  return 'MASC';
}

function totParesQtds(qtds: Record<string, number>): number {
  return Object.values(qtds || {}).reduce((s, v) => s + (v || 0), 0);
}

interface SurveyVotingScreenProps {
  user: any;
  orderId: string;
  subOrderNum: number;
  storeId: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function SurveyVotingScreen({
  user,
  orderId,
  subOrderNum: passedSubOrderNum,
  storeId,
  onClose,
  onComplete,
}: SurveyVotingScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [subOrders, setSubOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [storeNumber, setStoreNumber] = useState<number | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [resolvedSubOrderNum, setResolvedSubOrderNum] = useState<number>(passedSubOrderNum);

  // Voting state: ref → { voted, grades: { A: {38:2,...}, B:{...} }, expandedGrade }
  const [votes, setVotes] = useState<Record<string, {
    voted: boolean;
    grades: Record<string, Record<string, number>>;
    expandedGrade: string | null;
  }>>({});

  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Countdown baseado em order.created_at + survey_params.prazo_horas
  useEffect(() => {
    if (!order) return;
    const prazoHoras = order.survey_params?.prazo_horas || 24;
    const deadline = new Date(order.created_at).getTime() + prazoHoras * 60 * 60 * 1000;

    function tick() {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        setTimeLeft(0);
        setIsExpired(true);
      } else {
        setTimeLeft(remaining);
        setIsExpired(false);
      }
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

  function addGrade(ref: string, tipo: string) {
    setVotes(prev => {
      const cur = prev[ref];
      if (!cur) return prev;
      const used = Object.keys(cur.grades);
      if (used.length >= 8) return prev;
      const next = GRADE_LETTERS.find(l => !used.includes(l))!;
      return { ...prev, [ref]: { ...cur, grades: { ...cur.grades, [next]: {} }, expandedGrade: next } };
    });
  }

  function deleteGrade(ref: string, letter: string) {
    setVotes(prev => {
      const cur = prev[ref];
      if (!cur) return prev;
      const newGrades = { ...cur.grades };
      delete newGrades[letter];
      const letters = Object.keys(newGrades);
      const newExpanded = cur.expandedGrade === letter ? (letters[0] ?? null) : cur.expandedGrade;
      return { ...prev, [ref]: { ...cur, grades: newGrades, expandedGrade: newExpanded } };
    });
  }

  function clearGrade(ref: string, letter: string) {
    setVotes(prev => ({
      ...prev,
      [ref]: { ...prev[ref], grades: { ...prev[ref].grades, [letter]: {} } },
    }));
  }

  function setGradeQtd(ref: string, letter: string, size: string, qtd: number) {
    setVotes(prev => ({
      ...prev,
      [ref]: {
        ...prev[ref],
        grades: {
          ...prev[ref].grades,
          [letter]: { ...prev[ref].grades[letter], [size]: Math.max(0, qtd) },
        },
      },
    }));
  }

  function toggleExpandGrade(ref: string, letter: string) {
    setVotes(prev => ({
      ...prev,
      [ref]: { ...prev[ref], expandedGrade: prev[ref].expandedGrade === letter ? null : letter },
    }));
  }

  function toggleItemVoteSurvey(ref: string, tipo: string, isMandatory: boolean) {
    setVotes(prev => {
      const cur = prev[ref];
      if (!cur) return prev;
      if (cur.voted && isMandatory) return prev;
      if (cur.voted) {
        return { ...prev, [ref]: { voted: false, grades: {}, expandedGrade: null } };
      } else {
        return { ...prev, [ref]: { voted: true, grades: { A: {} }, expandedGrade: 'A' } };
      }
    });
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // 1. Fetch store info
        let storeNum: number | null = null;
        let sName = '';
        if (storeId) {
          const { data: storeData, error: sErr } = await supabase
            .from('stores')
            .select('number, city')
            .eq('id', storeId)
            .maybeSingle();

          if (!sErr && storeData) {
            storeNum = parseInt(storeData.number);
            sName = `Loja ${storeData.number} - ${storeData.city}`;
            setStoreNumber(storeNum);
            setStoreName(sName);
          }
        }

        // 2. Fetch the buy order
        const { data: orderData, error: oErr } = await supabase
          .from('buy_orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (oErr) throw oErr;
        setOrder(orderData);

        // 3. Fetch sub orders
        const { data: subOrdersData, error: subErr } = await supabase
          .from('buy_order_sub_orders')
          .select('*')
          .eq('order_id', orderId);

        if (subErr) throw subErr;
        setSubOrders(subOrdersData || []);

        // Resolve correct sub order num based on manager's store
        let finalSubOrderNum = passedSubOrderNum;
        if (storeNum !== null && subOrdersData) {
          const matchedSub = subOrdersData.find((so: any) => 
            Array.isArray(so.lojas_numeros) && so.lojas_numeros.includes(storeNum)
          );
          if (matchedSub) {
            finalSubOrderNum = matchedSub.sub_order_num;
          }
        }
        setResolvedSubOrderNum(finalSubOrderNum);

        // 4. Fetch order items
        const { data: itemsData, error: itemsErr } = await supabase
          .from('buy_order_items')
          .select('*')
          .eq('order_id', orderId);

        if (itemsErr) throw itemsErr;

        // Load catalog images if available
        const itemsWithImages = await Promise.all(
          (itemsData || []).map(async (item: any) => {
            if (!item.referencia) return { ...item, _imageUrl: null };
            const { data: catalog } = await supabase
              .from('product_catalog')
              .select('image_url')
              .eq('marca', orderData.marca)
              .eq('referencia', item.referencia)
              .eq('cor1', item.cor1 || '')
              .maybeSingle();
            return { ...item, _imageUrl: catalog?.image_url || null };
          })
        );
        setItems(itemsWithImages);

        // Initialize votes from existing survey_params
        const surveyParams = orderData.survey_params || {};
        const existingVotes = surveyParams.votos || [];
        const myVote = existingVotes.find((v: any) => 
          String(v.store_id) === String(storeId) || (storeNum !== null && parseInt(v.store_number) === storeNum)
        );

        const initialVotes: Record<string, { voted: boolean; grades: Record<string, Record<string, number>>; expandedGrade: string | null }> = {};
        
        for (const item of itemsWithImages) {
          initialVotes[item.referencia] = { voted: false, grades: {}, expandedGrade: null };
        }

        // Overlay existing vote data if available (novo formato)
        if (myVote && Array.isArray(myVote.itens)) {
          for (const vItem of myVote.itens) {
            if (initialVotes[vItem.ref] !== undefined && vItem.voto && vItem.grades && typeof vItem.grades === 'object') {
              const letters = Object.keys(vItem.grades);
              initialVotes[vItem.ref] = {
                voted: true,
                grades: vItem.grades,
                expandedGrade: letters[0] ?? null,
              };
            }
          }
        }

        setVotes(initialVotes);
      } catch (err: any) {
        console.error('Error loading survey voting data:', err);
        toast.error('Erro ao carregar dados da votação');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [orderId, storeId, passedSubOrderNum]);

  // Helper function to decode grades column
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

  // Calculate pairs in a grade
  const getGradePairsCount = (gradeTamanhos: any): number => {
    if (!gradeTamanhos) return 0;
    return Object.values(gradeTamanhos).reduce((sum: number, q: any) => sum + (parseInt(q) || 0), 0) as number;
  };

  // Get current sub-order survey parameters
  const currentSubOrderParams = useMemo(() => {
    if (!order || !order.survey_params) return null;
    const subOrdersParams = order.survey_params.sub_orders || [];
    return subOrdersParams.find((so: any) => so.num === resolvedSubOrderNum) || null;
  }, [order, resolvedSubOrderNum]);

  // Calculations for current selection
  const selectionMetrics = useMemo(() => {
    let totalItems = 0, totalPairs = 0, totalCost = 0;
    const selectedRefs: string[] = [];
    for (const item of items) {
      const vote = votes[item.referencia];
      if (!vote?.voted) continue;
      totalItems++;
      selectedRefs.push(item.referencia);
      for (const qtds of Object.values(vote.grades || {})) {
        const pairs = totParesQtds(qtds);
        totalPairs += pairs;
        totalCost += pairs * (Number(item.custo) || 0);
      }
    }
    return { totalItems, totalPairs, totalCost, selectedRefs };
  }, [items, votes]);

  // Validation logic
  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!currentSubOrderParams) return { isValid: true, errors, warnings };

    const { tipo_limite, limite, itens_minimos, itens_obrigatorios = [] } = currentSubOrderParams;

    // 1. Check item minimums
    if (itens_minimos > 0 && selectionMetrics.totalItems < itens_minimos) {
      errors.push(`Mínimo de itens não atingido: Selecione pelo menos ${itens_minimos} itens (selecionados: ${selectionMetrics.totalItems}).`);
    }

    // 2. Check mandatory items
    const missingMandatory = itens_obrigatorios.filter((ref: string) => !selectionMetrics.selectedRefs.includes(ref));
    if (missingMandatory.length > 0) {
      errors.push(`Itens obrigatórios ausentes: Você deve votar SIM nos itens: ${missingMandatory.join(', ')}.`);
    }

    // 3. Check limit
    if (tipo_limite !== 'nenhum' && limite > 0) {
      if (tipo_limite === 'valor' && selectionMetrics.totalCost > limite) {
        errors.push(`Limite de valor excedido: O valor máximo permitido é R$ ${limite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, seu pedido está em R$ ${selectionMetrics.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
      } else if (tipo_limite === 'pares' && selectionMetrics.totalPairs > limite) {
        errors.push(`Limite de pares excedido: O máximo permitido é de ${limite} pares, sua seleção atual possui ${selectionMetrics.totalPairs} pares.`);
      } else if (tipo_limite === 'itens' && selectionMetrics.totalItems > limite) {
        errors.push(`Limite de itens excedido: O máximo permitido é de ${limite} itens, sua seleção atual possui ${selectionMetrics.totalItems} itens.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [currentSubOrderParams, selectionMetrics]);

  const handleSave = async () => {
    if (!validation.isValid) {
      toast.error('Corrija as pendências antes de salvar.');
      return;
    }

    setSaving(true);
    try {
      // Fetch latest order data to prevent race conditions on votes JSON
      const { data: latestOrder, error: fetchErr } = await supabase
        .from('buy_orders')
        .select('survey_params')
        .eq('id', orderId)
        .single();

      if (fetchErr) throw fetchErr;

      const currentParams = latestOrder.survey_params || {};
      const votesList = currentParams.votos || [];

      // Create new vote entry
      const myItemsVote = items
        .map((item: any) => {
          const vote = votes[item.referencia];
          if (!vote) return null;
          let totalPares = 0;
          if (vote.voted) {
            for (const qtds of Object.values(vote.grades || {})) {
              totalPares += totParesQtds(qtds);
            }
          }
          return {
            ref: item.referencia,
            voto: vote.voted,
            grades: vote.voted ? vote.grades : {},
            total_pares: totalPares,
            valor: totalPares * (Number(item.custo) || 0),
          };
        })
        .filter(Boolean);

      const storeNumberStr = storeNumber !== null ? String(storeNumber) : '0';

      const myNewVote = {
        store_id: storeId,
        store_number: storeNumberStr,
        store_name: storeName,
        user_id: user?.id,
        user_name: user?.name || user?.email,
        voted_at: new Date().toISOString(),
        itens: myItemsVote,
      };

      // Replace or insert
      const filteredVotes = votesList.filter((v: any) => 
        String(v.store_id) !== String(storeId) && (storeNumber === null || parseInt(v.store_number) !== storeNumber)
      );
      
      const updatedVotes = [...filteredVotes, myNewVote];
      const updatedParams = {
        ...currentParams,
        votos: updatedVotes,
      };

      // Save to Supabase
      const { error: updateErr } = await supabase
        .from('buy_orders')
        .update({ survey_params: updatedParams })
        .eq('id', orderId);

      if (updateErr) throw updateErr;

      toast.success('Seus votos foram salvos com sucesso!');
      onComplete();
    } catch (err: any) {
      console.error('Error saving survey votes:', err);
      toast.error(err?.message || 'Erro ao salvar os votos.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
        <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-4 shadow-2xl">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-black text-slate-700">Carregando votação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] px-4 py-6 md:p-10">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="bg-purple-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗳️</span>
            <div>
              <span className="text-[10px] bg-purple-700/60 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Pesquisa de Compras
              </span>
              <h3 className="font-black text-base md:text-lg tracking-tight mt-0.5">
                {order?.marca} - Pedido #{order?.numero_pedido}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Countdown */}
            {timeLeft !== null && (
              <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl border text-center ${
                isExpired
                  ? 'bg-red-600 border-red-500 text-white'
                  : timeLeft < 3600000
                    ? 'bg-amber-500 border-amber-400 text-white animate-pulse'
                    : 'bg-purple-700/60 border-purple-600 text-purple-100'
              }`}>
                <span className="text-[8px] font-black uppercase tracking-widest opacity-80">
                  {isExpired ? 'Prazo' : 'Restante'}
                </span>
                <span className="text-[11px] font-black leading-none mt-0.5">
                  {isExpired ? 'ENCERRADO' : formatCountdown(timeLeft)}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-purple-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Banner de prazo encerrado */}
        {isExpired && (
          <div className="bg-red-600 text-white px-6 py-3 flex items-center gap-3 shrink-0">
            <span className="text-lg">⏰</span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">Prazo de votação encerrado</p>
              <p className="text-[10px] opacity-80">O período para envio dos votos foi encerrado. Você não pode mais confirmar sua votação.</p>
            </div>
          </div>
        )}

        {/* Info & Limits Alert Banner */}
        <div className="bg-purple-50 border-b border-purple-100 p-4 shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <p className="text-xs font-black text-purple-900 uppercase tracking-wider">{storeName || 'Sua Loja'}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Vote nos modelos que você quer receber na sua loja e escolha a grade ideal de tamanhos.
            </p>
          </div>
          
          {/* Active Limits UI */}
          {currentSubOrderParams && (
            <div className="flex flex-wrap gap-2 md:justify-end">
              {currentSubOrderParams.itens_minimos > 0 && (
                <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
                  selectionMetrics.totalItems >= currentSubOrderParams.itens_minimos
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  📋 Mínimo: {selectionMetrics.totalItems} / {currentSubOrderParams.itens_minimos} itens
                </div>
              )}
              
              {currentSubOrderParams.itens_obrigatorios?.length > 0 && (
                <div className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-[10px] font-bold">
                  ⭐️ {currentSubOrderParams.itens_obrigatorios.length} Obrigatórios
                </div>
              )}

              {currentSubOrderParams.tipo_limite !== 'nenhum' && currentSubOrderParams.limite > 0 && (
                <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
                  validation.errors.some(e => e.includes('excedido'))
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                }`}>
                  ⏱️ Limite {currentSubOrderParams.tipo_limite.toUpperCase()}:{' '}
                  {currentSubOrderParams.tipo_limite === 'valor' ? (
                    <>R$ {selectionMetrics.totalCost.toLocaleString('pt-BR')} / {currentSubOrderParams.limite.toLocaleString('pt-BR')}</>
                  ) : currentSubOrderParams.tipo_limite === 'pares' ? (
                    <>{selectionMetrics.totalPairs} / {currentSubOrderParams.limite} pares</>
                  ) : (
                    <>{selectionMetrics.totalItems} / {currentSubOrderParams.limite} itens</>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Validation Errors Panel */}
        {validation.errors.length > 0 && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 text-rose-800 text-[11px] font-bold flex items-start gap-2 shrink-0">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {validation.errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4 custom-scrollbar">
          {items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <HelpCircle size={40} className="mx-auto text-slate-300 mb-2 animate-bounce" />
              <p className="text-sm font-bold text-slate-600">Este pedido não contém itens para votação.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item: any) => {
                const tipo = getItemTipo(item);
                const catInfo = CATS_INFO[tipo];
                const sizes = CATS[tipo]?.sizes || [];
                const isMandatory = currentSubOrderParams?.itens_obrigatorios?.includes(item.referencia);
                const vote = votes[item.referencia] || { voted: false, grades: {}, expandedGrade: null };
                const gradeLetters = Object.keys(vote.grades || {});

                // Totais do item
                let itemTotalPares = 0;
                for (const qtds of Object.values(vote.grades || {})) {
                  itemTotalPares += totParesQtds(qtds);
                }
                const itemTotalValor = itemTotalPares * (Number(item.custo) || 0);

                return (
                  <div
                    key={item.referencia}
                    className={`border rounded-xl transition-all bg-white shadow-sm flex flex-col ${
                      vote.voted ? 'border-purple-400 ring-1 ring-purple-100' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Topo do Card */}
                    <div className="p-4 flex gap-3">
                      {/* Foto clicável */}
                      <div
                        className={`w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 transition-all ${item._imageUrl ? 'cursor-zoom-in hover:border-purple-300 hover:shadow-md' : ''}`}
                        onClick={() => item._imageUrl && setZoomedPhoto(item._imageUrl)}
                      >
                        {item._imageUrl ? (
                          <img src={item._imageUrl} alt={item.referencia} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-[9px] text-slate-400 font-bold uppercase text-center leading-tight px-1">Sem foto</span>
                        )}
                      </div>

                      {/* Informações */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 mb-1">
                          {/* Badge de Categoria */}
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${catInfo.bg} ${catInfo.color} ${catInfo.border}`}>
                            {catInfo.label}
                          </span>
                          {isMandatory && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              ⭐ Obrigatório
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                          REF {item.referencia}
                        </h4>
                        <p className="text-[9px] text-slate-400 uppercase font-semibold mt-0.5 truncate">
                          {item.modelo || item.tipo}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md">
                            C R$ {Number(item.custo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-md">
                            V R$ {Number(item.preco_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Editor de Grades (visível quando votado SIM) */}
                    {vote.voted && (
                      <div className="px-4 pb-3 border-t border-slate-100 pt-3">
                        {/* Abas de Grades */}
                        <div className="flex flex-wrap items-center gap-1 mb-2">
                          {gradeLetters.map(letter => {
                            const pares = totParesQtds(vote.grades[letter] || {});
                            const isExp = vote.expandedGrade === letter;
                            return (
                              <div key={letter} className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandGrade(item.referencia, letter)}
                                  className={`px-2 py-1 rounded-l-lg text-[10px] font-black border-y border-l transition-all ${
                                    isExp
                                      ? 'bg-purple-600 text-white border-purple-600'
                                      : pares > 0
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  {letter} · {pares}p
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteGrade(item.referencia, letter)}
                                  className={`px-1.5 py-1 rounded-r-lg text-[10px] font-black border transition-all ${
                                    isExp ? 'bg-purple-700 text-purple-200 border-purple-600 hover:bg-red-600 hover:border-red-600 hover:text-white' : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                                  }`}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                          {gradeLetters.length < 8 && (
                            <button
                              type="button"
                              onClick={() => addGrade(item.referencia, tipo)}
                              className="px-2 py-1 rounded-lg text-[10px] font-black border border-dashed border-slate-300 text-slate-400 hover:border-purple-400 hover:text-purple-600 transition-all"
                            >
                              + GRADE
                            </button>
                          )}
                        </div>

                        {/* Grid de tamanhos da grade expandida */}
                        {vote.expandedGrade && vote.grades[vote.expandedGrade] !== undefined && (() => {
                          const letter = vote.expandedGrade;
                          const qtds = vote.grades[letter] || {};
                          return (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                  Grade {letter}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => clearGrade(item.referencia, letter)}
                                  className="text-[9px] font-black text-amber-600 hover:text-amber-800 transition-colors"
                                >
                                  🔄 Limpar
                                </button>
                              </div>
                              <div className="grid grid-cols-6 gap-1">
                                {sizes.map(sz => {
                                  const qtd = qtds[sz] || 0;
                                  return (
                                    <div key={sz} className="flex flex-col items-center">
                                      <span className="text-[8px] font-black text-slate-500 mb-0.5">{sz}</span>
                                      <input
                                        type="number"
                                        min={0}
                                        inputMode="numeric"
                                        value={qtd > 0 ? qtd : ''}
                                        onChange={e => setGradeQtd(item.referencia, letter, sz, parseInt(e.target.value) || 0)}
                                        className={`w-full h-8 text-center text-[11px] font-black border rounded-lg outline-none transition-all ${
                                          qtd > 0
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-white border-slate-200 focus:border-purple-400 focus:bg-purple-50'
                                        }`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="text-[9px] text-slate-400 text-right mt-1.5 font-bold">
                                {totParesQtds(qtds)} pares · R$ {(totParesQtds(qtds) * (Number(item.custo) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Rodapé do Card */}
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex justify-between items-center">
                      <div>
                        {vote.voted ? (
                          <div>
                            <p className="text-[9px] font-black text-purple-600 uppercase">Selecionado</p>
                            <p className="text-[11px] font-black text-slate-700">
                              {itemTotalPares} pares · R$ {itemTotalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Não selecionado</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleItemVoteSurvey(item.referencia, tipo, !!isMandatory)}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                          vote.voted
                            ? isMandatory
                              ? 'bg-amber-100 text-amber-800 border border-amber-200 cursor-not-allowed opacity-80'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20'
                        }`}
                      >
                        {vote.voted ? (
                          <><Check size={13} className="stroke-[3]" /> Selecionado</>
                        ) : (
                          '🗳️ Quero Receber'
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Metrics & Actions */}
        <div className="bg-white border-t border-slate-200 p-6 shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4 items-center shadow-lg">
          {/* Summary */}
          <div className="flex items-center gap-6 text-left">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Itens Votados</p>
              <h4 className="text-lg font-black text-slate-800 leading-tight">
                {selectionMetrics.totalItems} <span className="text-xs text-slate-500 font-semibold">de {items.length}</span>
              </h4>
            </div>
            <div className="border-l border-slate-200 pl-6">
              <p className="text-[10px] font-black text-slate-400 uppercase">Total de Pares</p>
              <h4 className="text-lg font-black text-slate-800 leading-tight">
                {selectionMetrics.totalPairs} <span className="text-xs text-slate-400">pares</span>
              </h4>
            </div>
            <div className="border-l border-slate-200 pl-6">
              <p className="text-[10px] font-black text-slate-400 uppercase">Valor do Pedido (Custo)</p>
              <h4 className="text-lg font-black text-purple-700 leading-tight">
                R$ {selectionMetrics.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h4>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !validation.isValid || isExpired}
              className={`px-6 py-3 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-2 ${
                isExpired
                  ? 'bg-red-400 cursor-not-allowed text-white opacity-60'
                  : !validation.isValid
                    ? 'bg-slate-300 cursor-not-allowed text-slate-400'
                    : saving
                      ? 'bg-purple-400 cursor-wait'
                      : 'bg-purple-600 hover:bg-purple-700 hover:shadow-lg'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                '🗳️ Confirmar Votos'
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Modal de zoom de foto */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoomedPhoto(null)}
        >
          <img
            src={zoomedPhoto}
            alt="Foto ampliada"
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}
