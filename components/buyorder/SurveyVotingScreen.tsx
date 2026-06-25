import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../services/supabaseClient';
import { X, Check, AlertCircle, Info, HelpCircle } from 'lucide-react';

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

  // Voting state: map of item reference -> { voted: boolean, gradeLetter: string }
  const [votes, setVotes] = useState<Record<string, { voted: boolean; gradeLetter: string }>>({});

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

        const initialVotes: Record<string, { voted: boolean; gradeLetter: string }> = {};
        
        // Setup initial default votes
        itemsWithImages.forEach((item: any) => {
          // Check if item has grades
          let defaultGrade = '';
          if (item.grades) {
            const gradesObj = gradesArrayToObject(item.grades);
            const letters = Object.keys(gradesObj);
            if (letters.length > 0) {
              defaultGrade = letters[0]; // Take the first available grade as default
            }
          }

          initialVotes[item.referencia] = {
            voted: false,
            gradeLetter: defaultGrade,
          };
        });

        // Overlay existing vote data if any
        if (myVote && Array.isArray(myVote.itens)) {
          myVote.itens.forEach((vItem: any) => {
            if (initialVotes[vItem.ref]) {
              initialVotes[vItem.ref] = {
                voted: !!vItem.voto,
                gradeLetter: vItem.grade_letra || initialVotes[vItem.ref].gradeLetter,
              };
            }
          });
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
    let totalItems = 0;
    let totalPairs = 0;
    let totalCost = 0;
    const selectedRefs: string[] = [];

    items.forEach((item: any) => {
      const vote = votes[item.referencia];
      if (vote && vote.voted) {
        totalItems += 1;
        selectedRefs.push(item.referencia);

        // Find grade details
        if (item.grades) {
          const gradesObj = gradesArrayToObject(item.grades);
          const gradeTamanhos = gradesObj[vote.gradeLetter];
          if (gradeTamanhos) {
            const pairs = getGradePairsCount(gradeTamanhos);
            totalPairs += pairs;
            totalCost += pairs * (Number(item.custo) || 0);
          }
        }
      }
    });

    return {
      totalItems,
      totalPairs,
      totalCost,
      selectedRefs,
    };
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

  const toggleItemVote = (ref: string) => {
    setVotes((prev) => {
      const current = prev[ref];
      return {
        ...prev,
        [ref]: {
          ...current,
          voted: !current.voted,
        },
      };
    });
  };

  const changeItemGrade = (ref: string, gradeLetter: string) => {
    setVotes((prev) => {
      const current = prev[ref];
      return {
        ...prev,
        [ref]: {
          ...current,
          gradeLetter,
        },
      };
    });
  };

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
          
          let pairs = 0;
          if (vote.voted && item.grades) {
            const gradesObj = gradesArrayToObject(item.grades);
            pairs = getGradePairsCount(gradesObj[vote.gradeLetter]);
          }

          return {
            ref: item.referencia,
            voto: vote.voted,
            grade_letra: vote.gradeLetter,
            total_pares: pairs,
            valor: pairs * (Number(item.custo) || 0),
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
          <button 
            onClick={onClose}
            className="text-purple-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

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
                const isMandatory = currentSubOrderParams?.itens_obrigatorios?.includes(item.referencia);
                const vote = votes[item.referencia] || { voted: false, gradeLetter: '' };
                const gradesObj = gradesArrayToObject(item.grades);
                const gradeLetters = Object.keys(gradesObj);

                // Calculate selected grade metrics
                const selectedGradeTamanhos = gradesObj[vote.gradeLetter];
                const selectedGradePairs = getGradePairsCount(selectedGradeTamanhos);
                const selectedGradeValue = selectedGradePairs * (Number(item.custo) || 0);

                return (
                  <div 
                    key={item.referencia} 
                    className={`border rounded-xl transition-all p-4 bg-white shadow-sm flex flex-col justify-between ${
                      vote.voted 
                        ? 'border-purple-500 ring-1 ring-purple-100' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Item Card Body */}
                    <div className="flex gap-4">
                      {/* Image Thumbnail */}
                      <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-100">
                        {item._imageUrl ? (
                          <img 
                            src={item._imageUrl} 
                            alt={item.referencia} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Sem foto</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-black text-slate-800 tracking-tight uppercase truncate">
                            REF {item.referencia}
                          </h4>
                          {isMandatory && (
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md">
                              ⭐️ Obrigatório
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 uppercase truncate font-semibold">
                          {item.tipo || 'Modelo'} / {item.modelo || 'FEM'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            Custo: R$ {Number(item.custo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Venda: R$ {Number(item.preco_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Voted Content (Grade Selector) */}
                    {vote.voted && gradeLetters.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase text-left tracking-wider">
                          Selecione a Grade de Tamanhos:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {gradeLetters.map((letter) => {
                            const sizeObj = gradesObj[letter] || {};
                            const pairs = getGradePairsCount(sizeObj);
                            const val = pairs * (Number(item.custo) || 0);

                            return (
                              <button
                                type="button"
                                key={letter}
                                onClick={() => changeItemGrade(item.referencia, letter)}
                                className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all flex flex-col items-center ${
                                  vote.gradeLetter === letter
                                    ? 'bg-purple-100 border-purple-400 text-purple-800 shadow-sm'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span className="text-xs font-black">Grade {letter}</span>
                                <span className="text-[8px] text-slate-400 font-semibold mt-0.5">
                                  {pairs} pares / R$ {val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer Controls of Item Card */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center shrink-0">
                      <div>
                        {vote.voted ? (
                          <div className="text-left">
                            <p className="text-[9px] font-bold text-purple-600 uppercase">Selecionado</p>
                            <p className="text-[11px] font-black text-slate-700">
                              {selectedGradePairs} pares • R$ {selectedGradeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Não selecionado</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleItemVote(item.referencia)}
                        disabled={isMandatory && vote.voted} // Prevent deselecting mandatory items once they are voted (or always disable deselect if mandatory)
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                          vote.voted
                            ? isMandatory 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200 cursor-not-allowed opacity-80'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow'
                        }`}
                      >
                        {vote.voted ? (
                          <>
                            <Check size={12} className="stroke-[3]" /> Selected
                          </>
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
              disabled={saving || !validation.isValid}
              className={`px-6 py-3 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-2 ${
                !validation.isValid
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
    </div>
  );
}
