import React, { useState, useEffect } from 'react';
import { Store } from '../../types';
import { 
  BarChart3, 
  TrendingUp, 
  Trophy, 
  Calendar,
  Filter,
  Eye,
  ChevronDown,
  Medal,
  Gem,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
 
interface DashboardPAAdminProps {
  user: any;
  stores: Store[];
}
 
interface WeekData {
  id: string;
  data_inicio: string;
  data_fim: string;
  store_id: string;
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
  score: number;
}
 
type ViewMode = 'semana' | 'mes';
 
const DashboardPAAdmin: React.FC<DashboardPAAdminProps> = ({ user, stores }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('semana');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [performance, setPerformance] = useState<StoreWeekPerformance[]>([]);
  const [loading, setLoading] = useState(false);
 
  // Buscar semanas disponíveis
  useEffect(() => {
    loadWeeks();
  }, [selectedMonth, selectedYear]);
 
  // Buscar performance quando filtros mudarem
  useEffect(() => {
    if (viewMode === 'semana' && selectedWeek) {
      loadWeekPerformance();
    } else if (viewMode === 'mes') {
      loadMonthPerformance();
    }
  }, [viewMode, selectedWeek, selectedMonth, selectedYear, selectedStoreId]);
 
  const loadWeeks = async () => {
    const { data, error } = await supabase
      .from('Dashboard_PA_Semanas')
      .select('id, data_inicio, data_fim, store_id')
      .gte('data_inicio', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
      .lt('data_inicio', `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`)
      .order('data_inicio', { ascending: true });
 
    if (data && !error) {
      // Agrupar por semana (mesma data_inicio)
      const weeksMap = new Map<string, WeekData>();
      data.forEach(w => {
        const key = w.data_inicio;
        if (!weeksMap.has(key)) {
          weeksMap.set(key, w);
        }
      });
      
      const uniqueWeeks = Array.from(weeksMap.values());
      setWeeks(uniqueWeeks);
      
      if (uniqueWeeks.length > 0 && !selectedWeek) {
        setSelectedWeek(uniqueWeeks[0].id);
      }
    }
  };
 
  const loadWeekPerformance = async () => {
    if (!selectedWeek) return;
    
    setLoading(true);
    
    try {
      // Buscar todas as semanas com mesma data_inicio
      const weekInfo = weeks.find(w => w.id === selectedWeek);
      if (!weekInfo) return;
 
      const { data: allWeeksData } = await supabase
        .from('Dashboard_PA_Semanas')
        .select('id, store_id')
        .eq('data_inicio', weekInfo.data_inicio);
 
      if (!allWeeksData) return;
 
      const weekIds = allWeeksData.map(w => w.id);
 
      // Buscar vendas de todas as lojas nesta semana
      const { data: salesData } = await supabase
        .from('Dashboard_PA_Vendas')
        .select(`
          id,
          semana_id,
          store_id,
          nome_vendedor,
          pa,
          total_vendas,
          qtde_vendas,
          qtde_itens
        `)
        .in('semana_id', weekIds);
 
      // Buscar premiações
      const { data: premiosData } = await supabase
        .from('Dashboard_PA_Premiacoes')
        .select('semana_id, store_id, valor_premio, atingiu_meta')
        .in('semana_id', weekIds);
 
      // Buscar parâmetros
      const { data: paramsData } = await supabase
        .from('Dashboard_PA_Parametros')
        .select('store_id, pa_inicial');
 
      // Calcular performance por loja
      const storesPerformance: StoreWeekPerformance[] = stores
        .filter(store => selectedStoreId === 'all' || store.id === selectedStoreId)
        .map(store => {
          const storeWeek = allWeeksData.find(w => w.store_id === store.id);
          if (!storeWeek) return null;
 
          const storeSales = salesData?.filter(s => s.store_id === store.id) || [];
          const storePremios = premiosData?.filter(p => p.store_id === store.id) || [];
          const storeParams = paramsData?.find(p => p.store_id === store.id);
 
          const totalVendas = storeSales.reduce((acc, s) => acc + (s.total_vendas || 0), 0);
          const avgPA = storeSales.length > 0 
            ? storeSales.reduce((acc, s) => acc + (s.pa || 0), 0) / storeSales.length 
            : 0;
          const paMeta = storeParams?.pa_inicial || 1.6;
          const qtdePremiados = storePremios.filter(p => p.atingiu_meta).length;
          const totalPremios = storePremios.reduce((acc, p) => acc + (p.valor_premio || 0), 0);
 
          // Score: 50% vendas + 50% P.A
          const scoreVendas = totalVendas > 0 ? Math.min((totalVendas / 50000) * 100, 100) : 0;
          const scorePA = paMeta > 0 ? Math.min((avgPA / paMeta) * 100, 100) : 0;
          const score = (scoreVendas * 0.3) + (scorePA * 0.7); // 30% vendas, 70% P.A
 
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
            score
          };
        })
        .filter(Boolean) as StoreWeekPerformance[];
 
      // Ordenar por score
      storesPerformance.sort((a, b) => b.score - a.score);
      
      setPerformance(storesPerformance);
    } catch (error) {
      console.error('Erro ao carregar performance:', error);
    } finally {
      setLoading(false);
    }
  };
 
  const loadMonthPerformance = async () => {
    setLoading(true);
    
    try {
      // Buscar todas as semanas do mês
      const { data: monthWeeks } = await supabase
        .from('Dashboard_PA_Semanas')
        .select('id, store_id')
        .gte('data_inicio', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
        .lt('data_inicio', `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`);
 
      if (!monthWeeks || monthWeeks.length === 0) {
        setPerformance([]);
        return;
      }
 
      const weekIds = monthWeeks.map(w => w.id);
 
      // Buscar vendas do mês
      const { data: salesData } = await supabase
        .from('Dashboard_PA_Vendas')
        .select('store_id, pa, total_vendas')
        .in('semana_id', weekIds);
 
      // Buscar premiações do mês
      const { data: premiosData } = await supabase
        .from('Dashboard_PA_Premiacoes')
        .select('store_id, valor_premio, atingiu_meta')
        .in('semana_id', weekIds);
 
      // Buscar parâmetros
      const { data: paramsData } = await supabase
        .from('Dashboard_PA_Parametros')
        .select('store_id, pa_inicial');
 
      // Calcular performance mensal
      const storesPerformance: StoreWeekPerformance[] = stores
        .filter(store => selectedStoreId === 'all' || store.id === selectedStoreId)
        .map(store => {
          const storeSales = salesData?.filter(s => s.store_id === store.id) || [];
          const storePremios = premiosData?.filter(p => p.store_id === store.id) || [];
          const storeParams = paramsData?.find(p => p.store_id === store.id);
 
          const totalVendas = storeSales.reduce((acc, s) => acc + (s.total_vendas || 0), 0);
          const avgPA = storeSales.length > 0 
            ? storeSales.reduce((acc, s) => acc + (s.pa || 0), 0) / storeSales.length 
            : 0;
          const paMeta = storeParams?.pa_inicial || 1.6;
          const qtdePremiados = storePremios.filter(p => p.atingiu_meta).length;
          const totalPremios = storePremios.reduce((acc, p) => acc + (p.valor_premio || 0), 0);
 
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
            score
          };
        });
 
      storesPerformance.sort((a, b) => b.score - a.score);
      setPerformance(storesPerformance);
    } catch (error) {
      console.error('Erro ao carregar performance mensal:', error);
    } finally {
      setLoading(false);
    }
  };
 
  const getTier = (index: number) => {
    if (index === 0) return { 
      label: 'Campeão', 
      icon: <Gem className="text-cyan-400" size={20} />, 
      color: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      textColor: 'text-cyan-600',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20'
    };
    if (index === 1) return { 
      label: 'Vice', 
      icon: <Trophy className="text-emerald-400" size={20} />, 
      color: 'bg-gradient-to-r from-emerald-500 to-green-500',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
    };
    if (index === 2) return { 
      label: 'Terceiro', 
      icon: <Medal className="text-amber-400" size={20} />, 
      color: 'bg-gradient-to-r from-amber-500 to-orange-500',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20'
    };
    return { 
      label: 'Competidor', 
      icon: <Zap className="text-slate-400" size={18} />, 
      color: 'bg-slate-200',
      textColor: 'text-slate-600',
      bgColor: 'bg-slate-50 dark:bg-slate-800'
    };
  };
 
  const currentWeek = weeks.find(w => w.id === selectedWeek);
  const weekLabel = currentWeek 
    ? `${format(new Date(currentWeek.data_inicio + 'T00:00:00'), 'dd/MM')} a ${format(new Date(currentWeek.data_fim + 'T00:00:00'), 'dd/MM')}`
    : 'Selecione uma semana';
 
  const monthLabel = format(new Date(selectedYear, selectedMonth - 1), 'MMMM', { locale: ptBR });
 
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 md:p-8 space-y-6">
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
        </div>
 
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Modo de Visualização */}
          <div>
            <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
              <Eye className="inline mr-1" size={12} />
              Visualização
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
            >
              <option value="semana">📅 Por Semana</option>
              <option value="mes">📆 Por Mês</option>
            </select>
          </div>
 
          {/* Mês */}
          <div>
            <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
              <Calendar className="inline mr-1" size={12} />
              Mês / Ano
            </label>
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {format(new Date(2024, i), 'MMM', { locale: ptBR })}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-slate-900 dark:text-white"
              >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
 
          {/* Semana (só aparece se modo = semana) */}
          {viewMode === 'semana' && (
            <div>
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
                <Calendar className="inline mr-1" size={12} />
                Semana
              </label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
              >
                {weeks.map(w => (
                  <option key={w.id} value={w.id}>
                    {format(new Date(w.data_inicio + 'T00:00:00'), 'dd/MM')} a {format(new Date(w.data_fim + 'T00:00:00'), 'dd/MM')}
                  </option>
                ))}
              </select>
            </div>
          )}
 
          {/* Filtro de Loja */}
          <div>
            <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
              <Filter className="inline mr-1" size={12} />
              Loja
            </label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
            >
              <option value="all">🏪 Todas as Lojas</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>
                  Loja {s.number} - {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
 
        {/* Título da Visualização */}
        <div className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-2xl border-2 border-orange-200 dark:border-orange-800">
          <Trophy className="text-orange-600" size={20} />
          <p className="text-sm font-black text-orange-900 dark:text-orange-100 uppercase italic">
            {viewMode === 'semana' ? `Ranking - Semana ${weekLabel}` : `Ranking - ${monthLabel} ${selectedYear}`}
          </p>
        </div>
      </div>
 
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
            <p className="text-lg font-black text-slate-400 uppercase italic">
              Nenhum dado encontrado
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Selecione outro período ou loja
            </p>
          </div>
        )}
 
        {!loading && performance.map((store, index) => {
          const tier = getTier(index);
          
          return (
            <div
              key={store.storeId}
              className={`${tier.bgColor} rounded-3xl p-6 border-2 ${
                index < 3 ? 'border-slate-200 dark:border-slate-700 shadow-xl' : 'border-slate-100 dark:border-slate-800'
              } transition-all hover:shadow-2xl`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Posição */}
                <div className={`${tier.color} w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg flex-shrink-0`}>
                  {index + 1}º
                </div>
 
                {/* Info da Loja */}
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
                </div>
 
                {/* Métricas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full sm:w-auto">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Score</p>
                    <p className={`text-lg font-black ${tier.textColor}`}>
                      {store.score.toFixed(1)}%
                    </p>
                  </div>
 
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-black text-slate-400 uppercase mb-1">P.A</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                      {store.paAtingido.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-400">Meta: {store.paMeta.toFixed(2)}</p>
                  </div>
 
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Vendas</p>
                    <p className="text-lg font-black text-blue-600">
                      R$ {(store.totalVendas / 1000).toFixed(0)}k
                    </p>
                  </div>
 
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Premiados</p>
                    <p className="text-lg font-black text-emerald-600">
                      {store.qtdePremiados}/{store.qtdeVendedores}
                    </p>
                    <p className="text-[10px] text-slate-400">R$ {store.totalPremios.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
 
      {/* Footer Info */}
      {!loading && performance.length > 0 && (
        <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center uppercase tracking-widest">
            📊 Exibindo {performance.length} {performance.length === 1 ? 'loja' : 'lojas'} • 
            Score = 30% Vendas + 70% P.A • 
            Atualizado em tempo real
          </p>
        </div>
      )}
    </div>
  );
};
 
export default DashboardPAAdmin;