// ============================================
// WEEKLY PARAMETERS MODAL - Dashboard PA
// Configuração de parâmetros de premiação por loja
// ============================================

import React, { useState, useEffect } from 'react';
import { X, Check, ChevronRight, Loader2, Settings, Trophy, Zap } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Store } from '../../types';

interface PAParametros {
  store_id: string;
  pa_inicial: number;
  incremento_pa: number;
  valor_base: number;
  incremento_valor: number;
  vendas_minimo: number | null;
  vendas_incremento: number | null;
  vendas_valor_base: number | null;
  vendas_inc_valor: number | null;
  ticket_minimo: number | null;
  ticket_incremento: number | null;
  ticket_valor_base: number | null;
  ticket_inc_valor: number | null;
}

interface WeeklyParametersModalProps {
  stores: Store[];
  onClose: () => void;
  onSaved: () => void;
}

function calcularPremioTotal(performance: { pa: number; vendas: number; ticket: number }, params: PAParametros): number {
  if (!params) return 0;
  
  let total = 0;
  
  // 1. Prêmio por P.A
  const paMeta = params.pa_inicial || 0;
  if (performance.pa >= paMeta) {
    const excedente = performance.pa - paMeta;
    const incrementos = Math.floor((excedente + 0.00001) / (params.incremento_pa || 1));
    total += params.valor_base + (incrementos * params.incremento_valor);
  }
  
  // 2. Prêmio por Vendas
  if (params.vendas_minimo !== null && performance.vendas >= params.vendas_minimo) {
    const base = params.vendas_valor_base || 0;
    const inc = params.vendas_incremento || 1;
    const valInc = params.vendas_inc_valor || 0;
    const excedente = performance.vendas - params.vendas_minimo;
    const incrementos = Math.floor((excedente + 0.00001) / inc);
    total += base + (incrementos * valInc);
  }
  
  // 3. Prêmio por Ticket
  if (params.ticket_minimo !== null && performance.ticket >= params.ticket_minimo) {
    const base = params.ticket_valor_base || 0;
    const inc = params.ticket_incremento || 1;
    const valInc = params.ticket_inc_valor || 0;
    const excedente = performance.ticket - params.ticket_minimo;
    const incrementos = Math.floor((excedente + 0.00001) / inc);
    total += base + (incrementos * valInc);
  }
  
  return total;
}

export const WeeklyParametersModal: React.FC<WeeklyParametersModalProps> = ({ stores, onClose, onSaved }) => {
  const [localStores, setLocalStores] = useState<Store[]>(stores || []);
  const [params, setParams] = useState<Record<string, PAParametros>>({});
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PAParametros | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stores && stores.length > 0) {
      setLocalStores(stores);
    }
  }, [stores]);

  useEffect(() => {
    const fetchParams = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Garantir que a lista de lojas esteja populada
        let activeStores = [...(stores || [])];
        if (activeStores.length === 0) {
          const { data: dbStores, error: dbError } = await supabase
            .from('stores')
            .select('*');
          
          if (!dbError && dbStores) {
            activeStores = dbStores.map((s: any) => ({
              id: s.id,
              number: String(s.number),
              name: s.name || '',
              city: s.city || '',
              managerName: s.manager_name || '',
              managerEmail: s.manager_email || '',
              managerPhone: s.manager_phone || '',
              status: s.status || 'active'
            }));
            setLocalStores(activeStores);
          }
        } else {
          setLocalStores(activeStores);
        }

        const { data, error: fetchError } = await supabase
          .from('Dashboard_PA_Parametros')
          .select(`*`);
        
        if (fetchError) {
          setError(`Erro ao carregar parâmetros: ${fetchError.message}`);
          setLoading(false);
          return;
        }
        
        if (data) {
          const map: Record<string, PAParametros> = {};
          data.forEach((p: any) => { 
            map[p.store_id] = {
              store_id: p.store_id,
              pa_inicial: p.pa_inicial !== null ? Number(p.pa_inicial) : 1.60,
              incremento_pa: p.incremento_pa !== null ? Number(p.incremento_pa) : 0.05,
              valor_base: p.valor_base !== null ? Number(p.valor_base) : 50,
              incremento_valor: p.incremento_valor !== null ? Number(p.incremento_valor) : 0.10,
              vendas_minimo: p.vendas_minimo !== null ? Number(p.vendas_minimo) : null,
              vendas_incremento: p.vendas_incremento !== null ? Number(p.vendas_incremento) : null,
              vendas_valor_base: p.vendas_valor_base !== null ? Number(p.vendas_valor_base) : null,
              vendas_inc_valor: p.vendas_inc_valor !== null ? Number(p.vendas_inc_valor) : null,
              ticket_minimo: p.ticket_minimo !== null ? Number(p.ticket_minimo) : null,
              ticket_incremento: p.ticket_incremento !== null ? Number(p.ticket_incremento) : null,
              ticket_valor_base: p.ticket_valor_base !== null ? Number(p.ticket_valor_base) : null,
              ticket_inc_valor: p.ticket_inc_valor !== null ? Number(p.ticket_inc_valor) : null,
            };
          });
          setParams(map);
        }
      } catch (err: any) {
        setError(`Erro inesperado: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchParams();
  }, [stores]);

  const handleSelectStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    setSaved(false);
    
    const existingParams = params[storeId];
    
    if (existingParams) {
      setDraft(existingParams);
    } else {
      setDraft({
        store_id: storeId,
        pa_inicial: 1.60,
        incremento_pa: 0.05,
        valor_base: 50,
        incremento_valor: 0.10,
        vendas_minimo: null,
        vendas_incremento: null,
        vendas_valor_base: null,
        vendas_inc_valor: null,
        ticket_minimo: null,
        ticket_incremento: null,
        ticket_valor_base: null,
        ticket_inc_valor: null,
      });
    }
  };

  const handleSave = async () => {
    if (!draft || !selectedStoreId) return;
    
    setSaving(true);
    
    try {
      // 1. Preparar o objeto com os 12 campos, garantindo conversão numérica
      // Se o campo for nulo ou vazio, enviamos null para o banco
      const payload = {
        store_id: selectedStoreId,
        // Seção P.A
        pa_inicial: draft.pa_inicial !== null ? Number(draft.pa_inicial) : 0,
        incremento_pa: draft.incremento_pa !== null ? Number(draft.incremento_pa) : 1,
        valor_base: draft.valor_base !== null ? Number(draft.valor_base) : 0,
        incremento_valor: draft.incremento_valor !== null ? Number(draft.incremento_valor) : 0,
        // Seção Vendas
        vendas_minimo: (draft.vendas_minimo !== null && draft.vendas_minimo !== undefined && String(draft.vendas_minimo) !== '') ? Number(draft.vendas_minimo) : null,
        vendas_incremento: (draft.vendas_incremento !== null && draft.vendas_incremento !== undefined && String(draft.vendas_incremento) !== '') ? Number(draft.vendas_incremento) : null,
        vendas_valor_base: (draft.vendas_valor_base !== null && draft.vendas_valor_base !== undefined && String(draft.vendas_valor_base) !== '') ? Number(draft.vendas_valor_base) : null,
        vendas_inc_valor: (draft.vendas_inc_valor !== null && draft.vendas_inc_valor !== undefined && String(draft.vendas_inc_valor) !== '') ? Number(draft.vendas_inc_valor) : null,
        // Seção Ticket
        ticket_minimo: (draft.ticket_minimo !== null && draft.ticket_minimo !== undefined && String(draft.ticket_minimo) !== '') ? Number(draft.ticket_minimo) : null,
        ticket_incremento: (draft.ticket_incremento !== null && draft.ticket_incremento !== undefined && String(draft.ticket_incremento) !== '') ? Number(draft.ticket_incremento) : null,
        ticket_valor_base: (draft.ticket_valor_base !== null && draft.ticket_valor_base !== undefined && String(draft.ticket_valor_base) !== '') ? Number(draft.ticket_valor_base) : null,
        ticket_inc_valor: (draft.ticket_inc_valor !== null && draft.ticket_inc_valor !== undefined && String(draft.ticket_inc_valor) !== '') ? Number(draft.ticket_inc_valor) : null,
        updated_at: new Date().toISOString()
      };

      console.log('💾 [SAVE] Enviando payload completo:', payload);

      // 2. Usar upsert para evitar deletar e inserir (mais seguro e atômico)
      const { error: saveError } = await supabase
        .from('Dashboard_PA_Parametros')
        .upsert(payload, { onConflict: 'store_id' });

      if (saveError) throw saveError;

      // 3. Atualizar estado local
      setParams(prev => ({ ...prev, [selectedStoreId]: draft }));
      setSaved(true);
      onSaved(); // Notifica o componente pai para atualizar listagens se necessário
      
      setTimeout(() => setSaved(false), 2000);
      console.log('✅ [SAVE] Sucesso ao salvar os 12 parâmetros!');
    } catch (err: any) {
      console.error('❌ [SAVE] Erro crítico:', err);
      alert('Erro ao salvar parâmetros: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedStore = localStores.find(s => s.id === selectedStoreId);
  
  const storesSorted = [...localStores].sort((a, b) => {
    const numA = parseInt(a.number || '0');
    const numB = parseInt(b.number || '0');
    return numA - numB;
  });

  const previewTotal = draft ? calcularPremioTotal({ 
    pa: draft.pa_inicial, 
    vendas: draft.vendas_minimo || 0, 
    ticket: draft.ticket_minimo || 0 
  }, draft) : 0;

  const previewMaisUm = draft ? calcularPremioTotal({ 
    pa: draft.pa_inicial + draft.incremento_pa, 
    vendas: (draft.vendas_minimo || 0) + (draft.vendas_incremento || 0), 
    ticket: (draft.ticket_minimo || 0) + (draft.ticket_incremento || 0) 
  }, draft) : 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden leading-tight">
        
        {/* Header Compacto */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <Settings size={18} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase italic tracking-tight">
                Configurar Metas
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                {loading ? 'Carregando...' : `${Object.keys(params).length} Lojas Ativas`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 text-center uppercase">
              ⚠️ {error}
            </p>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden flex-col sm:flex-row">
          {/* Lista de Lojas - Mais compacta */}
          <div className="w-full sm:w-48 md:w-56 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50/30 dark:bg-slate-900/30 max-h-[120px] sm:max-h-full">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-orange-500" />
              </div>
            ) : (
              <div className="flex sm:flex-col overflow-x-auto sm:overflow-x-visible">
                {storesSorted.map(store => {
                  const hasParams = !!params[store.id];
                  const isSelected = selectedStoreId === store.id;
                  return (
                    <button
                      key={store.id}
                      onClick={() => handleSelectStore(store.id)}
                      className={`flex-shrink-0 sm:flex-shrink sm:w-full text-left px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 transition-all border-r sm:border-r-0 sm:border-b border-slate-100 dark:border-slate-800/50 ${
                        isSelected
                          ? 'bg-orange-50 dark:bg-orange-900/20 border-b-2 sm:border-b-0 sm:border-l-4 border-orange-500'
                          : 'hover:bg-white dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-[10px] font-black uppercase truncate ${isSelected ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          L.{store.number}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 truncate uppercase">{store.city}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-1">
                        {hasParams && (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                        <ChevronRight size={12} className={isSelected ? 'text-orange-500' : 'text-slate-300'} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Painel de Edição - Conteúdo Ajustado */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-white dark:bg-slate-900">
            {!selectedStoreId ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <Settings size={40} className="text-slate-200 dark:text-slate-700" />
                </div>
                <p className="text-xs font-black text-slate-400 uppercase italic tracking-widest">
                  Selecione uma loja para editar
                </p>
              </div>
            ) : draft && (
              <div className="space-y-6 max-w-3xl mx-auto pb-4">
                {/* Cabeçalho da Loja */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase italic truncate">
                      Loja {selectedStore?.number} — {selectedStore?.city}
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">{selectedStore?.name}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase italic ${params[selectedStoreId] ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                    {params[selectedStoreId] ? 'Configurado' : 'Pendente'}
                  </div>
                </div>

                {/* 1. VENDAS */}
                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full">
                      1. Vendas (R$)
                    </span>
                    <div className="h-px bg-emerald-50 dark:bg-emerald-900/10 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-emerald-50/10 dark:bg-emerald-900/5 p-3 rounded-xl border border-emerald-50 dark:border-emerald-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Mínimo (Meta)</label>
                      <input
                        type="number" step="100" min="0"
                        value={draft.vendas_minimo ?? ''}
                        onChange={e => setDraft({ ...draft, vendas_minimo: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-emerald-400 transition-all"
                      />
                    </div>
                    <div className="bg-emerald-50/10 dark:bg-emerald-900/5 p-3 rounded-xl border border-emerald-50 dark:border-emerald-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Base (Prêmio)</label>
                      <input
                        type="number" step="5" min="0"
                        value={draft.vendas_valor_base ?? ''}
                        onChange={e => setDraft({ ...draft, vendas_valor_base: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-emerald-400 transition-all"
                      />
                    </div>
                    <div className="bg-emerald-50/10 dark:bg-emerald-900/5 p-3 rounded-xl border border-emerald-50 dark:border-emerald-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Incremento</label>
                      <input
                        type="number" step="100" min="0"
                        value={draft.vendas_incremento ?? ''}
                        onChange={e => setDraft({ ...draft, vendas_incremento: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-emerald-400 transition-all"
                      />
                    </div>
                    <div className="bg-emerald-50/10 dark:bg-emerald-900/5 p-3 rounded-xl border border-emerald-50 dark:border-emerald-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Valor Inc.</label>
                      <input
                        type="number" step="5" min="0"
                        value={draft.vendas_inc_valor ?? ''}
                        onChange={e => setDraft({ ...draft, vendas_inc_valor: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-emerald-400 transition-all"
                      />
                    </div>
                  </div>
                </section>

                {/* 2. TICKET */}
                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                      2. Ticket (R$)
                    </span>
                    <div className="h-px bg-blue-50 dark:bg-blue-900/10 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-blue-50/10 dark:bg-blue-900/5 p-3 rounded-xl border border-blue-50 dark:border-blue-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Mínimo (Meta)</label>
                      <input
                        type="number" step="1" min="0"
                        value={draft.ticket_minimo ?? ''}
                        onChange={e => setDraft({ ...draft, ticket_minimo: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-blue-400 transition-all"
                      />
                    </div>
                    <div className="bg-blue-50/10 dark:bg-blue-900/5 p-3 rounded-xl border border-blue-50 dark:border-blue-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Base (Prêmio)</label>
                      <input
                        type="number" step="5" min="0"
                        value={draft.ticket_valor_base ?? ''}
                        onChange={e => setDraft({ ...draft, ticket_valor_base: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-blue-400 transition-all"
                      />
                    </div>
                    <div className="bg-blue-50/10 dark:bg-blue-900/5 p-3 rounded-xl border border-blue-50 dark:border-blue-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Incremento</label>
                      <input
                        type="number" step="1" min="0"
                        value={draft.ticket_incremento ?? ''}
                        onChange={e => setDraft({ ...draft, ticket_incremento: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-black outline-none focus:border-blue-400 transition-all"
                      />
                    </div>
                    <div className="bg-blue-50/10 dark:bg-blue-900/5 p-3 rounded-xl border border-blue-50 dark:border-blue-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Valor Inc.</label>
                      <input
                        type="number" step="5" min="0"
                        value={draft.ticket_inc_valor ?? ''}
                        onChange={e => setDraft({ ...draft, ticket_inc_valor: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-blue-400 transition-all"
                      />
                    </div>
                  </div>
                </section>

                {/* 3. P.A */}
                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-[0.2em] bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full">
                      3. P.A
                    </span>
                    <div className="h-px bg-orange-50 dark:bg-orange-900/10 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-orange-50/10 dark:bg-orange-900/5 p-3 rounded-xl border border-orange-50 dark:border-orange-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">P.A Meta</label>
                      <input
                        type="number" step="0.05" min="0"
                        value={draft.pa_inicial}
                        onChange={e => setDraft({ ...draft, pa_inicial: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-orange-400 transition-all"
                      />
                    </div>
                    <div className="bg-orange-50/10 dark:bg-orange-900/5 p-3 rounded-xl border border-orange-50 dark:border-orange-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Base (Prêmio)</label>
                      <input
                        type="number" step="5" min="0"
                        value={draft.valor_base}
                        onChange={e => setDraft({ ...draft, valor_base: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-orange-400 transition-all"
                      />
                    </div>
                    <div className="bg-orange-50/10 dark:bg-orange-900/5 p-3 rounded-xl border border-orange-50 dark:border-orange-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Inc. Faixa</label>
                      <input
                        type="number" step="0.05" min="0"
                        value={draft.incremento_pa}
                        onChange={e => setDraft({ ...draft, incremento_pa: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-orange-400 transition-all"
                      />
                    </div>
                    <div className="bg-orange-50/10 dark:bg-orange-900/5 p-3 rounded-xl border border-orange-50 dark:border-orange-900/10">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Valor Inc.</label>
                      <input
                        type="number" step="1" min="0"
                        value={draft.incremento_valor}
                        onChange={e => setDraft({ ...draft, incremento_valor: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-orange-400 transition-all"
                      />
                    </div>
                  </div>
                </section>

                {/* Preview e Botão Compactados */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total Bases</p>
                      <p className="text-sm font-black text-emerald-600 tabular-nums">R$ {previewTotal.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Metas +1</p>
                      <p className="text-sm font-black text-blue-500 tabular-nums">R$ {previewMaisUm.toFixed(2)}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-[0.97] shadow-lg ${
                      saved
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-900 dark:bg-orange-600 hover:bg-black dark:hover:bg-orange-500 text-white disabled:opacity-50'
                    }`}
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : saved ? (
                      <><Check size={16} /> Gravado!</>
                    ) : (
                      <><Check size={16} /> Salvar Parâmetros</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
