import React, { useState, useEffect } from 'react';
import { Store, User } from '../../types';
import { 
  BarChart3, Trophy, Calendar, Filter, Eye,
  Medal, Gem, Zap, Settings, X, Check, ChevronRight, Loader2,
  RotateCcw, Lock, Unlock, AlertCircle, TrendingUp, FileText
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { autoGenerateWeeksIfNeeded } from './WeeklyPASystem';
import { MonthlyPrizesReport } from './MonthlyPrizesReport';
import { WeeklyParametersModal } from './WeeklyParametersModal';
import { MonthlyWeeklyBreakdown } from './MonthlyWeeklyBreakdown';
 
interface DashboardPAAdminProps {
  user: User;
  stores: Store[];
  onRefresh?: () => Promise<void>;
}
 
interface WeekData {
  id: string;
  data_inicio: string;
  data_fim: string;
  data_pagamento?: string;
  store_id: string;
  status: string;
  mes_ref?: number;
  ano_ref?: number;
}

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};
 
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
  weeklyBreakdown?: {
    semanaId: string;
    dataInicio: string;
    dataFim: string;
    pa: number;
    vendas: number;
    ticket: number;
    premioCalc: number;
    paMeta: number;
  }[];
}
 
type ViewMode = 'semana' | 'mes';
 
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
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [expandedStores, setExpandedStores] = useState<Record<string, boolean>>({});

  const toggleStoreExpanded = (storeId: string) => {
    setExpandedStores(prev => ({
      ...prev,
      [storeId]: !prev[storeId]
    }));
  };
 
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
      .select('*')
      .eq('mes_ref', selectedMonth)
      .eq('ano_ref', selectedYear)
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
        .select('*');
 
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

          const avgTicket = storeSales.length > 0
            ? storeSales.reduce((acc, s) => acc + (s.total_vendas || 0), 0) / storeSales.reduce((acc, s) => acc + (s.qtde_vendas || 0), 1)
            : 0;
          
          const paMeta = storeParams?.pa_inicial || 1.6;
          const qtdePremiados = storePremios.filter(p => p.atingiu_meta).length;
          const totalPremios = storePremios.reduce((acc, p) => acc + (p.valor_premio || 0), 0);
          const valorPremioCalc = storeParams ? calcularPremioTotal({ pa: avgPA, vendas: totalVendas, ticket: avgTicket }, storeParams as PAParametros) : 0;
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
        .from('Dashboard_PA_Semanas').select('*')
        .gte('data_inicio', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
        .lt('data_inicio', `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`);
 
      if (!monthWeeks || monthWeeks.length === 0) { setPerformance([]); return; }
      const weekIds = monthWeeks.map(w => w.id);
 
      const { data: salesData } = await supabase.from('Dashboard_PA_Vendas').select('*').in('semana_id', weekIds);
      const { data: premiosData } = await supabase.from('Dashboard_PA_Premiacoes').select('*').in('semana_id', weekIds);
      const { data: paramsData } = await supabase.from('Dashboard_PA_Parametros').select('*').in('semana_id', weekIds);
 
      const storesPerformance: StoreWeekPerformance[] = stores
        .filter(store => selectedStoreId === 'all' || store.id === selectedStoreId)
        .map(store => {
          const storeWeeks = monthWeeks.filter(w => w.store_id === store.id);
          const storePremios = premiosData?.filter(p => p.store_id === store.id) || [];
          
          let totalVendas = 0;
          let totalPremioCalc = 0;
          let sumPAs = 0;
          let sumPAMetas = 0;
          let weeksWithSalesCount = 0;
          const weeklyBreakdown: any[] = [];

          storeWeeks.forEach(w => {
            const storeSalesForWeek = salesData?.filter(s => s.semana_id === w.id && s.store_id === store.id) || [];
            const storeParamsForWeek = paramsData?.find(p => p.semana_id === w.id && p.store_id === store.id) || null;
            const paMeta = storeParamsForWeek?.pa_inicial || 1.6;

            if (storeSalesForWeek.length > 0) {
              const totalVendasSemanal = storeSalesForWeek.reduce((acc, s) => acc + (s.total_vendas || 0), 0);
              const avgPA = storeSalesForWeek.reduce((acc, s) => acc + (s.pa || 0), 0) / storeSalesForWeek.length;
              const avgTicket = storeSalesForWeek.reduce((acc, s) => acc + (s.total_vendas || 0), 0) / 
                storeSalesForWeek.reduce((acc, s) => acc + (s.qtde_vendas || 0), 1);

              const premioCalcSemanal = storeParamsForWeek 
                ? calcularPremioTotal({ pa: avgPA, vendas: totalVendasSemanal, ticket: avgTicket }, storeParamsForWeek as PAParametros) 
                : 0;

              totalVendas += totalVendasSemanal;
              totalPremioCalc += premioCalcSemanal;
              sumPAs += avgPA;
              sumPAMetas += paMeta;
              weeksWithSalesCount++;

              weeklyBreakdown.push({
                semanaId: w.id,
                dataInicio: w.data_inicio,
                dataFim: w.data_fim,
                pa: avgPA,
                vendas: totalVendasSemanal,
                ticket: avgTicket,
                premioCalc: premioCalcSemanal,
                paMeta
              });
            } else {
              weeklyBreakdown.push({
                semanaId: w.id,
                dataInicio: w.data_inicio,
                dataFim: w.data_fim,
                pa: 0,
                vendas: 0,
                ticket: 0,
                premioCalc: 0,
                paMeta
              });
            }
          });

          const finalPAAtingido = weeksWithSalesCount > 0 ? (sumPAs / weeksWithSalesCount) : 0;
          const finalPAMeta = weeksWithSalesCount > 0 ? (sumPAMetas / weeksWithSalesCount) : 1.6;

          const scoreVendas = totalVendas > 0 ? Math.min((totalVendas / 200000) * 100, 100) : 0;
          const scorePA = finalPAMeta > 0 ? Math.min((finalPAAtingido / finalPAMeta) * 100, 100) : 0;
          const score = (scoreVendas * 0.3) + (scorePA * 0.7);

          const totalVendedores = salesData?.filter(s => s.store_id === store.id).length || 0;
          const qtdePremiados = storePremios.filter(p => p.atingiu_meta).length;
          const totalPremios = storePremios.reduce((acc, p) => acc + (p.valor_premio || 0), 0);
          
          return { 
            storeId: store.id, 
            storeNumber: store.number, 
            storeName: store.name, 
            city: store.city, 
            totalVendas, 
            paAtingido: finalPAAtingido, 
            paMeta: finalPAMeta, 
            qtdeVendedores: totalVendedores, 
            qtdePremiados, 
            totalPremios, 
            valorPremioCalc: totalPremioCalc, 
            score, 
            params: (paramsData?.find(p => p.store_id === store.id) || null) as PAParametros | null,
            weeklyBreakdown
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
    ? `${format(parseLocalDate(currentWeek.data_inicio), 'dd/MM')} a ${format(parseLocalDate(currentWeek.data_fim), 'dd/MM')}`
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
        <WeeklyParametersModal
          stores={stores}
          selectedWeek={weeks.find(w => w.id === selectedWeek) || weeks[0]}
          allWeeks={weeks}
          onClose={() => setShowParamsModal(false)}
          onSaved={() => {
            if (viewMode === 'semana' && selectedWeek) loadWeekPerformance();
            else loadMonthPerformance();
          }}
        />
      )}

      <MonthlyPrizesReport 
        isOpen={showMonthlyReport}
        onClose={() => setShowMonthlyReport(false)}
      />
 
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl">
            <BarChart3 className="text-white" size={32} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase italic">
              Dashboard Semanal <span className="text-orange-600">Admin</span>
            </h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Premiação por PA · Vendas · Ticket
            </p>
          </div>
          {/* Botões de Ação - VERSÃO MELHORADA */}
          <div className="flex items-center gap-2">
            {/* Botão Parâmetros */}
            <button
              onClick={() => setShowParamsModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl font-black uppercase text-xs shadow-lg border-b-4 border-orange-800 transition-all active:scale-95"
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Parâmetros</span>
            </button>

            {/* Botão Relatório Mensal */}
            <button
              onClick={() => setShowMonthlyReport(true)}
              className="relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black uppercase text-xs shadow-lg border-b-4 border-indigo-800 transition-all active:scale-95 overflow-hidden group"
            >
              {/* Efeito de brilho ao passar o mouse */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
              
              <FileText size={16} className="relative z-10" />
              <span className="hidden sm:inline relative z-10">Relatório Mensal</span>
              
              {/* Badge "Novo" (opcional) */}
              <span className="absolute -top-1 -right-1 px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-full shadow-lg">
                Novo
              </span>
            </button>
          </div>
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
                    {format(parseLocalDate(w.data_inicio), 'dd/MM')} a {format(parseLocalDate(w.data_fim), 'dd/MM')}
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
                          Meta P.A: {store.params.pa_inicial.toFixed(2)} • Base: R$ {store.params.valor_base.toFixed(2)} • +R$ {store.params.incremento_valor.toFixed(2)} a cada +{store.params.incremento_pa} P.A
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

                  {viewMode === 'mes' && store.weeklyBreakdown && (
                    <div className="mt-4 border-t border-dashed border-slate-200 dark:border-slate-800 pt-3">
                      <button
                        onClick={() => toggleStoreExpanded(store.storeId)}
                        className="flex items-center gap-1 text-[11px] font-black uppercase text-slate-500 hover:text-orange-600 transition-colors bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/20 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                      >
                        {expandedStores[store.storeId] ? 'Ocultar Detalhes Semanais' : 'Ver Detalhes Semanais'}
                        <ChevronRight size={14} className={`transform transition-transform ${expandedStores[store.storeId] ? 'rotate-90' : ''}`} />
                      </button>
                      
                      {expandedStores[store.storeId] && (
                        <MonthlyWeeklyBreakdown weeklyBreakdown={store.weeklyBreakdown} />
                      )}
                    </div>
                  )}
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
                  {(() => {
                    const filteredWeeks = allWeeks
                      .filter(w => selectedStoreId === 'all' || w.store_id === selectedStoreId)
                      .filter(week => {
                        const now = new Date();
                        const currentMonth = now.getMonth() + 1; // 1-12
                        const currentYear = now.getFullYear();
                        const ano_ref = week.ano_ref ?? parseLocalDate(week.data_inicio).getFullYear();
                        const mes_ref = week.mes_ref ?? (parseLocalDate(week.data_inicio).getMonth() + 1);
                        
                        const isCurrentOrFutureMonth = 
                          ano_ref > currentYear || 
                          (ano_ref === currentYear && mes_ref >= currentMonth);
                        
                        if (isCurrentOrFutureMonth) {
                          // Mês atual ou futuro: mostra tudo
                          return true;
                        } else {
                          // Mês passado: mostra apenas semanas abertas (pendentes)
                          return week.status === 'aberta';
                        }
                      });

                    return filteredWeeks.map((w) => {
                      const store = stores.find(s => s.id === w.store_id);
                      const isFinalized = w.status === 'recibos_impressos' || w.status === 'bloqueada';
                      const isReopening = reopeningId === w.id;

                      const now = new Date();
                      const currentMonth = now.getMonth() + 1; // 1-12
                      const currentYear = now.getFullYear();
                      const ano_ref = w.ano_ref ?? parseLocalDate(w.data_inicio).getFullYear();
                      const mes_ref = w.mes_ref ?? (parseLocalDate(w.data_inicio).getMonth() + 1);
                      const isPastMonth = ano_ref < currentYear || (ano_ref === currentYear && mes_ref < currentMonth);
                      const isPendingPastWeek = isPastMonth && w.status === 'aberta';

                      return (
                        <tr 
                          key={w.id} 
                          className={`border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all ${
                            isPendingPastWeek ? 'bg-red-50/30 dark:bg-red-950/10' : ''
                          }`}
                        >
                          <td className={`px-6 py-4 ${isPendingPastWeek ? 'border-l-4 border-l-red-500' : ''}`}>
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
                                {format(parseLocalDate(w.data_inicio), 'dd/MM')} a {format(parseLocalDate(w.data_fim), 'dd/MM')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {isPendingPastWeek ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  PENDENTE
                                </span>
                              ) : (
                                <>
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
                                </>
                              )}
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
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {(() => {
            const filteredWeeksCount = allWeeks
              .filter(w => selectedStoreId === 'all' || w.store_id === selectedStoreId)
              .filter(week => {
                const now = new Date();
                const currentMonth = now.getMonth() + 1; // 1-12
                const currentYear = now.getFullYear();
                const ano_ref = week.ano_ref ?? parseLocalDate(week.data_inicio).getFullYear();
                const mes_ref = week.mes_ref ?? (parseLocalDate(week.data_inicio).getMonth() + 1);
                
                const isCurrentOrFutureMonth = 
                  ano_ref > currentYear || 
                  (ano_ref === currentYear && mes_ref >= currentMonth);
                
                if (isCurrentOrFutureMonth) {
                  return true;
                } else {
                  return week.status === 'aberta';
                }
              }).length;

            return filteredWeeksCount === 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
                <AlertCircle className="mx-auto mb-4 text-slate-300" size={48} />
                <p className="text-sm font-black text-slate-400 uppercase italic">Nenhuma semana encontrada para este período</p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
 
export default DashboardPAAdmin;