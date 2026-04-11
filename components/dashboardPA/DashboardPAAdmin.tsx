import React, { useState, useEffect } from 'react';
import { Store, User } from '../../types';
import { 
  BarChart3, Trophy, Calendar, Filter, Eye,
  Medal, Gem, Zap, Settings, X, Check, ChevronRight, Loader2,
  RotateCcw, Lock, Unlock, AlertCircle, TrendingUp
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { autoGenerateWeeksIfNeeded } from './WeeklyPASystem';
 
interface DashboardPAAdminProps {
  user: User;
  stores: Store[];
  onRefresh?: () => Promise<void>;
}
 
interface WeekData {
  id: string;
  data_inicio: string;
  data_fim: string;
  store_id: string;
  status: string;
}
 
interface PAParametros {
  store_id: string;
  pa_inicial: number;
  incremento_pa: number;
  valor_base: number;
  incremento_valor: number;
}
 
interface StoreWeekPerformance {
  storeId: string;
  storeNumber: string;
  storeName: string;
  city: string;
  totalVendas: number;
  paAtingido: number;
  paMeta: number;
  qtdeVendedores: number;
  qtdePremiados: number;
  totalPremios: number;
  valorPremioCalc: number;
  score: number;
  params: PAParametros | null;
}
 
type ViewMode = 'semana' | 'mes';
 
function calcularPremio(pa: number, params: PAParametros): number {
  if (!params || pa < params.pa_inicial) return 0;
  const excedente = pa - params.pa_inicial;
  const incrementos = excedente / params.incremento_pa;
  return params.valor_base + incrementos * params.incremento_valor * 100;
}
 
// ─── Modal de Parâmetros ───────────────────────────────────────────────────────
interface ParametrosModalProps {
  stores: Store[];
  onClose: () => void;
  onSaved: () => void;
}
 
const ParametrosModal: React.FC<ParametrosModalProps> = ({ stores, onClose, onSaved }) => {
  const [params, setParams] = useState<Record<string, PAParametros>>({});
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PAParametros | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
 
  useEffect(() => {
    const fetchParams = async () => {
      // 🔧 CORREÇÃO 1: Removendo duplicatas com SELECT DISTINCT
      const { data } = await supabase
        .from('Dashboard_PA_Parametros')
        .select('store_id, pa_inicial, incremento_pa, valor_base, incremento_valor');
      
      if (data) {
        const map: Record<string, PAParametros> = {};
        // Remove duplicatas mantendo apenas o último registro de cada loja
        data.forEach((p: any) => { 
          map[p.store_id] = p; 
        });
        setParams(map);
      }
      setLoading(false);
    };
    fetchParams();
  }, []);
 
  const handleSelectStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    setSaved(false);
    setDraft(params[storeId] || {
      store_id: storeId,
      pa_inicial: 1.60,
      incremento_pa: 4,
      valor_base: 50,
      incremento_valor: 0.10,
    });
  };
 
  const handleSave = async () => {
    if (!draft || !selectedStoreId) return;
    setSaving(true);
    try {
      // Primeiro, remove possíveis duplicatas existentes
      await supabase
        .from('Dashboard_PA_Parametros')
        .delete()
        .eq('store_id', selectedStoreId);
 
      // Depois insere o novo registro
      await supabase
        .from('Dashboard_PA_Parametros')
        .insert({
          store_id: selectedStoreId,
          pa_inicial: draft.pa_inicial,
          incremento_pa: draft.incremento_pa,
          valor_base: draft.valor_base,
          incremento_valor: draft.incremento_valor,
        });
 
      setParams(prev => ({ ...prev, [selectedStoreId]: draft }));
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };
 
  const selectedStore = stores.find(s => s.id === selectedStoreId);
  const storesSorted = [...stores].sort((a, b) => Number(a.number) - Number(b.number));
 
  // Preview do prêmio com os valores do draft
  const previewPremio = draft ? calcularPremio(draft.pa_inicial, draft) : 0;
  const previewPremioPlus = draft ? calcularPremio(draft.pa_inicial + draft.incremento_pa, draft) : 0;
 
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
              <Settings size={20} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic">
                Parâmetros de Premiação
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Clique em uma loja para editar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X size={20} />
          </button>
        </div>
 
        <div className="flex flex-1 overflow-hidden">
          {/* Lista de Lojas */}
          <div className="w-48 sm:w-56 border-r border-slate-200 dark:border-slate-800 overflow-y-auto flex-shrink-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-orange-500" />
              </div>
            ) : (
              storesSorted.map(store => {
                const hasParams = !!params[store.id];
                const isSelected = selectedStoreId === store.id;
                return (
                  <button
                    key={store.id}
                    onClick={() => handleSelectStore(store.id)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-all border-b border-slate-100 dark:border-slate-800 ${
                      isSelected
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-l-orange-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-xs font-black uppercase truncate ${isSelected ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        Loja {store.number}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 truncate">{store.city}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {hasParams && (
                        <div className="w-2 h-2 rounded-full bg-emerald-400" title="Configurado" />
                      )}
                      <ChevronRight size={14} className={isSelected ? 'text-orange-500' : 'text-slate-300'} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
 
          {/* Painel de Edição */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedStoreId ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-3xl">
                  <Settings size={40} className="text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-black text-slate-400 uppercase italic">
                  Selecione uma loja ao lado
                </p>
                <p className="text-xs font-bold text-slate-300 dark:text-slate-600">
                  🟢 = já configurada
                </p>
              </div>
            ) : draft && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase italic">
                    Loja {selectedStore?.number} — {selectedStore?.city}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">{selectedStore?.name}</p>
                </div>
 
                {/* Campos */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                        P.A Mínimo (Meta)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="1"
                        max="5"
                        value={draft.pa_inicial}
                        onChange={e => setDraft({ ...draft, pa_inicial: Number(e.target.value) })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-orange-400 dark:focus:border-orange-500 rounded-xl px-4 py-3 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">P.A mínimo para ganhar o prêmio base</p>
                    </div>
 
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                        Valor Base (R$)
                      </label>
                      <input
                        type="number"
                        step="5"
                        min="0"
                        value={draft.valor_base}
                        onChange={e => setDraft({ ...draft, valor_base: Number(e.target.value) })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-orange-400 dark:focus:border-orange-500 rounded-xl px-4 py-3 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Prêmio ao atingir o P.A mínimo</p>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                        Incremento de P.A
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={draft.incremento_pa}
                        onChange={e => setDraft({ ...draft, incremento_pa: Number(e.target.value) })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-orange-400 dark:focus:border-orange-500 rounded-xl px-4 py-3 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">A cada X de P.A acima do mínimo</p>
                    </div>
 
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                        Incremento de Valor (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft.incremento_valor * 100}
                        onChange={e => setDraft({ ...draft, incremento_valor: Number(e.target.value) / 100 })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-orange-400 dark:focus:border-orange-500 rounded-xl px-4 py-3 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Valor em R$ adicionado por incremento</p>
                    </div>
                  </div>
                </div>
 
                {/* Preview da Fórmula */}
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10 rounded-2xl p-4 border-2 border-orange-200 dark:border-orange-800 space-y-3">
                  <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">
                    Preview da Fórmula
                  </p>
                  <div className="font-mono text-xs font-black text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 rounded-xl p-3 border border-orange-200 dark:border-orange-800">
                    Prêmio = R$ {draft.valor_base.toFixed(2)} + ((P.A - {draft.pa_inicial.toFixed(2)}) / {draft.incremento_pa}) × R$ {(draft.incremento_valor * 100).toFixed(2)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-orange-200 dark:border-orange-800 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                        P.A = {draft.pa_inicial.toFixed(2)} (meta)
                      </p>
                      <p className="text-lg font-black text-emerald-600">
                        R$ {draft.valor_base.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-orange-200 dark:border-orange-800 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                        P.A = {(draft.pa_inicial + draft.incremento_pa).toFixed(2)} (+{draft.incremento_pa})
                      </p>
                      <p className="text-lg font-black text-emerald-600">
                        R$ {previewPremioPlus.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
 
                {/* Botão Salvar */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase text-sm transition-all active:scale-95 shadow-lg ${
                    saved
                      ? 'bg-emerald-500 text-white border-b-4 border-emerald-700'
                      : 'bg-orange-600 hover:bg-orange-700 text-white border-b-4 border-orange-800 disabled:opacity-50'
                  }`}
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : saved ? (
                    <><Check size={18} /> Salvo!</>
                  ) : (
                    <><Check size={18} /> Salvar Parâmetros</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
 
// ─── Dashboard Principal ───────────────────────────────────────────────────────
const DashboardPAAdmin: React.FC<DashboardPAAdminProps> = ({ user, stores, onRefresh }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('semana');
  const [activeTab, setActiveTab] = useState<'ranking' | 'semanas' | 'grafico'>('ranking');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [allWeeks, setAllWeeks] = useState<WeekData[]>([]);
  const [performance, setPerformance] = useState<StoreWeekPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [showParamsModal, setShowParamsModal] = useState(false);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
 
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
 
  useEffect(() => {
    const checkWeeks = async () => {
      if (stores.length > 0) {
        const storeIds = stores.map(s => s.id);
        const result = await autoGenerateWeeksIfNeeded(storeIds);
        if (result.totalCreated > 0) {
          showToast(`${result.totalCreated} semanas criadas automaticamente!`, 'success');
          loadWeeks();
        }
      }
    };
    checkWeeks();
  }, [stores]);

  useEffect(() => { loadWeeks(); }, [selectedMonth, selectedYear]);
 
  useEffect(() => {
    if (viewMode === 'semana' && selectedWeek) loadWeekPerformance();
    else if (viewMode === 'mes') loadMonthPerformance();
  }, [viewMode, selectedWeek, selectedMonth, selectedYear, selectedStoreId]);
 
  const loadWeeks = async () => {
    const { data, error } = await supabase
      .from('Dashboard_PA_Semanas')
      .select('id, data_inicio, data_fim, store_id, status')
      .gte('data_inicio', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
      .lt('data_inicio', `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`)
      .order('data_inicio', { ascending: true });
 
    if (data && !error) {
      setAllWeeks(data);
      const weeksMap = new Map<string, WeekData>();
      data.forEach(w => { if (!weeksMap.has(w.data_inicio)) weeksMap.set(w.data_inicio, w); });
      const uniqueWeeks = Array.from(weeksMap.values());
      setWeeks(uniqueWeeks);
      if (uniqueWeeks.length > 0 && !selectedWeek) setSelectedWeek(uniqueWeeks[0].id);
    }
  };
 
  const handleReabrirSemana = async (weekId: string) => {
    setReopeningId(weekId);
    try {
      const { data, error } = await supabase.rpc('fn_admin_reabrir_semana', { 
        p_semana_id: weekId,
        p_admin_id: user.id
      });
      
      if (error) {
        console.error('Erro Supabase:', error);
        throw error;
      }
      
      if (data?.success) {
        showToast('Semana reaberta com sucesso!', 'success');
        await loadWeeks();
        if (onRefresh) await onRefresh();
      } else {
        throw new Error(data?.error || 'Erro ao reabrir semana');
      }
    } catch (err: any) {
      console.error('Erro ao reabrir semana:', err);
      showToast('Erro ao reabrir semana: ' + (err.message || ''), 'error');
    } finally {
      setReopeningId(null);
    }
  };
 
  const loadWeekPerformance = async () => {
    if (!selectedWeek) return;
    setLoading(true);
    try {
      const weekInfo = weeks.find(w => w.id === selectedWeek);
      if (!weekInfo) return;
 
      const { data: allWeeksData } = await supabase
        .from('Dashboard_PA_Semanas').select('id, store_id').eq('data_inicio', weekInfo.data_inicio);
      if (!allWeeksData) return;
 
      const weekIds = allWeeksData.map(w => w.id);
 
      const { data: salesData } = await supabase
        .from('Dashboard_PA_Vendas')
        .select('id, semana_id, store_id, nome_vendedor, pa, total_vendas, qtde_vendas, qtde_itens')
        .in('semana_id', weekIds);
 
      const { data: premiosData } = await supabase
        .from('Dashboard_PA_Premiacoes')
        .select('semana_id, store_id, valor_premio, atingiu_meta')
        .in('semana_id', weekIds);
 
      const { data: paramsData } = await supabase
        .from('Dashboard_PA_Parametros')
        .select('store_id, pa_inicial, incremento_pa, valor_base, incremento_valor');
 
      const storesPerformance: StoreWeekPerformance[] = stores
        .filter(store => selectedStoreId === 'all' || store.id === selectedStoreId)
        .map(store => {
          const storeWeek = allWeeksData.find(w => w.store_id === store.id);
          if (!storeWeek) return null;
          const storeSales = salesData?.filter(s => s.store_id === store.id) || [];
          const storePremios = premiosData?.filter(p => p.store_id === store.id) || [];
          const storeParams = paramsData?.find(p => p.store_id === store.id) || null;
          
          const totalVendas = storeSales.reduce((acc, s) => acc + (s.total_vendas || 0), 0);
          
          // 🔧 CORREÇÃO 2: Cálculo correto do PA médio (média aritmética simples dos vendedores)
          const avgPA = storeSales.length > 0 
            ? storeSales.reduce((acc, s) => acc + (s.pa || 0), 0) / storeSales.length 
            : 0;
          
          const paMeta = storeParams?.pa_inicial || 1.6;
          const qtdePremiados = storePremios.filter(p => p.atingiu_meta).length;
          const totalPremios = storePremios.reduce((acc, p) => acc + (p.valor_premio || 0), 0);
          const valorPremioCalc = storeParams ? calcularPremio(avgPA, storeParams as PAParametros) : 0;
          const scoreVendas = totalVendas > 0 ? Math.min((totalVendas / 50000) * 100, 100) : 0;
          const scorePA = paMeta > 0 ? Math.min((avgPA / paMeta) * 100, 100) : 0;
          const score = (scoreVendas * 0.3) + (scorePA * 0.7);
          
          return { 
            storeId: store.id, 
            storeNumber: store.number, 
            storeName: store.name, 
            city: store.city, 
            totalVendas, 
            paAtingido: avgPA, 
            paMeta, 
            qtdeVendedores: storeSales.length, 
            qtdePremiados, 
            totalPremios, 
            valorPremioCalc, 
            score, 
            params: storeParams as PAParametros | null 
          };
        })
        .filter(Boolean) as StoreWeekPerformance[];
 
      storesPerformance.sort((a, b) => b.score - a.score);
      setPerformance(storesPerformance);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };
 
  const loadMonthPerformance = async () => {
    setLoading(true);
    try {
      const { data: monthWeeks } = await supabase
        .from('Dashboard_PA_Semanas').select('id, store_id')
        .gte('data_inicio', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
        .lt('data_inicio', `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`);
 
      if (!monthWeeks || monthWeeks.length === 0) { setPerformance([]); return; }
      const weekIds = monthWeeks.map(w => w.id);
 
      const { data: salesData } = await supabase.from('Dashboard_PA_Vendas').select('store_id, pa, total_vendas').in('semana_id', weekIds);
      const { data: premiosData } = await supabase.from('Dashboard_PA_Premiacoes').select('store_id, valor_premio, atingiu_meta').in('semana_id', weekIds);
      const { data: paramsData } = await supabase.from('Dashboard_PA_Parametros').select('store_id, pa_inicial, incremento_pa, valor_base, incremento_valor');
 
      const storesPerformance: StoreWeekPerformance[] = stores
        .filter(store => selectedStoreId === 'all' || store.id === selectedStoreId)
        .map(store => {
          const storeSales = salesData?.filter(s => s.store_id === store.id) || [];
          const storePremios = premiosData?.filter(p => p.store_id === store.id) || [];
          const storeParams = paramsData?.find(p => p.store_id === store.id) || null;
          
          const totalVendas = storeSales.reduce((acc, s) => acc + (s.total_vendas || 0), 0);
          
          // 🔧 CORREÇÃO 2: Cálculo correto do PA médio (média aritmética simples)
          const avgPA = storeSales.length > 0 
            ? storeSales.reduce((acc, s) => acc + (s.pa || 0), 0) / storeSales.length 
            : 0;
          
          const paMeta = storeParams?.pa_inicial || 1.6;
          const qtdePremiados = storePremios.filter(p => p.atingiu_meta).length;
          const totalPremios = storePremios.reduce((acc, p) => acc + (p.valor_premio || 0), 0);
          const valorPremioCalc = storeParams ? calcularPremio(avgPA, storeParams as PAParametros) : 0;
          const scoreVendas = totalVendas > 0 ? Math.min((totalVendas / 200000) * 100, 100) : 0;
          const scorePA = paMeta > 0 ? Math.min((avgPA / paMeta) * 100, 100) : 0;
          const score = (scoreVendas * 0.3) + (scorePA * 0.7);
          
          return { 
            storeId: store.id, 
            storeNumber: store.number, 
            storeName: store.name, 
            city: store.city, 
            totalVendas, 
            paAtingido: avgPA, 
            paMeta, 
            qtdeVendedores: storeSales.length, 
            qtdePremiados, 
            totalPremios, 
            valorPremioCalc, 
            score, 
            params: storeParams as PAParametros | null 
          };
        });
 
      storesPerformance.sort((a, b) => b.score - a.score);
      setPerformance(storesPerformance);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };
 
  const getTier = (index: number) => {
    if (index === 0) return { label: 'Campeão', icon: <Gem className="text-cyan-400" size={20} />, color: 'bg-gradient-to-r from-cyan-500 to-blue-500', textColor: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-900/20' };
    if (index === 1) return { label: 'Vice', icon: <Trophy className="text-emerald-400" size={20} />, color: 'bg-gradient-to-r from-emerald-500 to-green-500', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' };
    if (index === 2) return { label: 'Terceiro', icon: <Medal className="text-amber-400" size={20} />, color: 'bg-gradient-to-r from-amber-500 to-orange-500', textColor: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20' };
    return { label: 'Competidor', icon: <Zap className="text-slate-400" size={18} />, color: 'bg-slate-200', textColor: 'text-slate-600', bgColor: 'bg-slate-50 dark:bg-slate-800' };
  };
 
  const currentWeek = weeks.find(w => w.id === selectedWeek);
  const weekLabel = currentWeek
    ? `${format(new Date(currentWeek.data_inicio + 'T00:00:00'), 'dd/MM')} a ${format(new Date(currentWeek.data_fim + 'T00:00:00'), 'dd/MM')}`
    : 'Selecione uma semana';
  const monthLabel = format(new Date(selectedYear, selectedMonth - 1), 'MMMM', { locale: ptBR });
 
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 md:p-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[300] px-8 py-4 rounded-[24px] font-black italic uppercase tracking-tighter text-sm shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}
 
      {/* Modal de Parâmetros */}
      {showParamsModal && (
        <ParametrosModal
          stores={stores}
          onClose={() => setShowParamsModal(false)}
          onSaved={() => {
            if (viewMode === 'semana' && selectedWeek) loadWeekPerformance();
            else loadMonthPerformance();
          }}
        />
      )}
 
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl">
            <BarChart3 className="text-white" size={32} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase italic">
              Dashboard P.A <span className="text-orange-600">Admin</span>
            </h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Visão Consolidada da Rede
            </p>
          </div>
          {/* Botão de Parâmetros */}
          <button
            onClick={() => setShowParamsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase text-xs shadow-lg border-b-4 border-orange-800 transition-all active:scale-95"
          >
            <Settings size={16} />
            <span className="hidden sm:inline">Parâmetros</span>
          </button>
        </div>
 
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
              <Eye className="inline mr-1" size={12} /> Visualização
            </label>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
              <option value="semana">📅 Por Semana</option>
              <option value="mes">📆 Por Mês</option>
            </select>
          </div>
 
          <div>
            <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
              <Calendar className="inline mr-1" size={12} /> Mês / Ano
            </label>
            <div className="flex gap-2">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{format(new Date(2024, i), 'MMM', { locale: ptBR })}</option>
                ))}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-slate-900 dark:text-white">
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
 
          {viewMode === 'semana' && (
            <div>
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
                <Calendar className="inline mr-1" size={12} /> Semana
              </label>
              <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
                {weeks.map(w => (
                  <option key={w.id} value={w.id}>
                    {format(new Date(w.data_inicio + 'T00:00:00'), 'dd/MM')} a {format(new Date(w.data_fim + 'T00:00:00'), 'dd/MM')}
                  </option>
                ))}
              </select>
            </div>
          )}
 
          <div>
            <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
              <Filter className="inline mr-1" size={12} /> Loja
            </label>
            <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
              <option value="all">🏪 Todas as Lojas</option>
              {stores.map(s => <option key={s.id} value={s.id}>Loja {s.number} - {s.name}</option>)}
            </select>
          </div>
        </div>
 
        {/* Título da Visualização */}
        <div className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-2xl border-2 border-orange-200 dark:border-orange-800">
          <Trophy className="text-orange-600" size={20} />
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase italic">
            {activeTab === 'ranking' ? 'Ranking de Performance' : activeTab === 'grafico' ? 'Gráfico de Ranking' : 'Gerenciamento de Semanas'}
          </h2>
        </div>
      </div>
 
      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ranking')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase text-xs transition-all whitespace-nowrap ${
              activeTab === 'ranking'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Trophy size={16} />
            Ranking de Lojas
          </button>
 
          <button
            onClick={() => setActiveTab('grafico')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase text-xs transition-all whitespace-nowrap ${
              activeTab === 'grafico'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <TrendingUp size={16} />
            Gráfico Ranking
          </button>
 
          <button
            onClick={() => setActiveTab('semanas')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase text-xs transition-all whitespace-nowrap ${
              activeTab === 'semanas'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Calendar size={16} />
            Gerenciar Semanas
          </button>
        </div>
      </div>
 
      {activeTab === 'ranking' ? (
        <>
          {/* Ranking */}
          <div className="space-y-4">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full" />
              </div>
            )}
 
            {!loading && performance.length === 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-20 text-center border border-slate-200 dark:border-slate-800">
                <Trophy className="mx-auto mb-4 text-slate-300" size={64} />
                <p className="text-lg font-black text-slate-400 uppercase italic">Nenhum dado encontrado</p>
                <p className="text-sm text-slate-400 mt-2">Selecione outro período ou loja</p>
              </div>
            )}
 
            {!loading && performance.map((store, index) => {
              const tier = getTier(index);
              return (
                <div key={store.storeId} className={`${tier.bgColor} rounded-3xl p-6 border-2 ${index < 3 ? 'border-slate-200 dark:border-slate-700 shadow-xl' : 'border-slate-100 dark:border-slate-800'} transition-all hover:shadow-2xl`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className={`${tier.color} w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg flex-shrink-0`}>
                      {index + 1}º
                    </div>
 
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic">
                          Loja {store.storeNumber}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${tier.textColor} bg-white dark:bg-slate-800 border-2 border-current`}>
                          {tier.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">
                        {store.storeName} • {store.city}
                      </p>
                      {store.params && (
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">
                          Meta P.A: {store.params.pa_inicial.toFixed(2)} • Base: R$ {store.params.valor_base.toFixed(2)} • +R$ {(store.params.incremento_valor * 100).toFixed(2)} a cada +{store.params.incremento_pa} P.A
                        </p>
                      )}
                    </div>
 
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full sm:w-auto">
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-black text-slate-400 uppercase mb-1">Score</p>
                        <p className={`text-lg font-black ${tier.textColor}`}>{store.score.toFixed(1)}%</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-black text-slate-400 uppercase mb-1">P.A</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{store.paAtingido.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400">Meta: {store.paMeta.toFixed(2)}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-black text-slate-400 uppercase mb-1">Vendas</p>
                        <p className="text-lg font-black text-blue-600">R$ {(store.totalVendas / 1000).toFixed(0)}k</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-black text-slate-400 uppercase mb-1">Premiados</p>
                        <p className="text-lg font-black text-emerald-600">{store.qtdePremiados}/{store.qtdeVendedores}</p>
                        <p className="text-[10px] text-slate-400">R$ {store.totalPremios.toFixed(0)}</p>
                      </div>
                      <div className={`rounded-xl p-3 border-2 ${store.valorPremioCalc > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                        <p className="text-xs font-black text-slate-400 uppercase mb-1">Prêmio</p>
                        <p className={`text-lg font-black ${store.valorPremioCalc > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {store.valorPremioCalc > 0 ? `R$ ${store.valorPremioCalc.toFixed(2)}` : '—'}
                        </p>
                        <p className="text-[10px] text-slate-400">{store.valorPremioCalc > 0 ? 'pelo P.A médio' : 'abaixo da meta'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
 
          {!loading && performance.length > 0 && (
            <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center uppercase tracking-widest">
                📊 Exibindo {performance.length} {performance.length === 1 ? 'loja' : 'lojas'} •
                Score = 30% Vendas + 70% P.A •
                Prêmio = Valor Base + Incremento por P.A •
                Atualizado em tempo real
              </p>
            </div>
          )}
        </>
      ) : activeTab === 'grafico' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full" />
            </div>
          ) : performance.length === 0 ? (
            <div className="text-center py-20">
              <TrendingUp className="mx-auto mb-4 text-slate-300" size={64} />
              <p className="text-lg font-black text-slate-400 uppercase italic">Nenhum dado para exibir</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic">
                  Ranking por P.A Médio
                </h3>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                  <TrendingUp size={16} />
                  <span>{viewMode === 'semana' ? weekLabel : monthLabel}</span>
                </div>
              </div>
 
              {performance.map((store, index) => {
                const maxPA = Math.max(...performance.map(s => s.paAtingido));
                const percentage = maxPA > 0 ? (store.paAtingido / maxPA) * 100 : 0;
                const tier = getTier(index);
 
                return (
                  <div key={store.storeId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg ${tier.color} text-white font-black text-sm flex items-center justify-center`}>
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-white">
                            Loja {store.storeNumber}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{store.city}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900 dark:text-white">
                          {store.paAtingido.toFixed(2)}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">P.A médio</p>
                      </div>
                    </div>
 
                    <div className="relative h-8 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden">
                      <div
                        className={`h-full ${tier.color} transition-all duration-500 flex items-center justify-end pr-3`}
                        style={{ width: `${percentage}%` }}
                      >
                        <span className="text-white font-black text-xs">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Vendas</p>
                        <p className="text-sm font-black text-blue-600">R$ {(store.totalVendas / 1000).toFixed(0)}k</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Meta</p>
                        <p className="text-sm font-black text-amber-600">{store.paMeta.toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Prêmio</p>
                        <p className="text-sm font-black text-emerald-600">
                          {store.valorPremioCalc > 0 ? `R$ ${store.valorPremioCalc.toFixed(0)}` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Loja</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Período</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {allWeeks
                    .filter(w => selectedStoreId === 'all' || w.store_id === selectedStoreId)
                    .map((w) => {
                      const store = stores.find(s => s.id === w.store_id);
                      const isFinalized = w.status === 'recibos_impressos' || w.status === 'bloqueada';
                      const isReopening = reopeningId === w.id;
 
                      return (
                        <tr key={w.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                                {store?.number || '??'}
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-900 dark:text-white uppercase italic">{store?.name || 'Loja Desconhecida'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{store?.city}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                              <Calendar size={14} />
                              <span className="text-xs font-bold uppercase tracking-tighter">
                                {format(new Date(w.data_inicio + 'T00:00:00'), 'dd/MM')} a {format(new Date(w.data_fim + 'T00:00:00'), 'dd/MM')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {w.status === 'aberta' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                              {w.status === 'importada' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                              {w.status === 'bloqueada' && <Lock size={14} className="text-amber-500" />}
                              {w.status === 'recibos_impressos' && <Check size={14} className="text-emerald-500" />}
                              <span className={`text-[10px] font-black uppercase italic ${
                                w.status === 'aberta' ? 'text-emerald-600' :
                                w.status === 'importada' ? 'text-blue-600' :
                                w.status === 'bloqueada' ? 'text-amber-600' :
                                'text-slate-600'
                              }`}>
                                {w.status.replace('_', ' ')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isFinalized && (
                              <button
                                onClick={() => handleReabrirSemana(w.id)}
                                disabled={isReopening}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl font-black uppercase text-[10px] hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all disabled:opacity-50"
                              >
                                {isReopening ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={12} />
                                )}
                                Reabrir Semana
                              </button>
                            )}
                            {!isFinalized && (
                              <span className="text-[10px] font-bold text-slate-300 uppercase italic">Em andamento</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
 
          {allWeeks.filter(w => selectedStoreId === 'all' || w.store_id === selectedStoreId).length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
              <AlertCircle className="mx-auto mb-4 text-slate-300" size={48} />
              <p className="text-sm font-black text-slate-400 uppercase italic">Nenhuma semana encontrada para este período</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
 
export default DashboardPAAdmin;