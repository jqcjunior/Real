import React, { useState, useEffect } from 'react';
import { X, Calendar, TrendingUp, Users, Award, Download, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonthlyPrizesReportProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MonthlyStoreData {
  store_number: string;
  store_name: string;
  year_ref: number;
  month_ref: number;
  total_vendedores: number;
  total_semanas: number;
  vendedores_atingiram_pa: number;
  pa_medio: number;
  total_premio_mes: number;
  total_vendas_mes: number;
}

interface MonthlyVendedorData {
  nome_vendedor: string;
  store_number: string;
  store_name: string;
  pa_medio_mes: number;
  premio_total_mes: number;
  total_semanas_trabalhadas: number;
  semanas_atingiu_pa: number;
  ranking_premio_loja: number;
}

export const MonthlyPrizesReport: React.FC<MonthlyPrizesReportProps> = ({ isOpen, onClose }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'lojas' | 'vendedores' | 'executivo'>('lojas');
  const [storesData, setStoresData] = useState<MonthlyStoreData[]>([]);
  const [vendedoresData, setVendedoresData] = useState<MonthlyVendedorData[]>([]);
  const [executiveData, setExecutiveData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadStores();
      loadData();
    }
  }, [isOpen, selectedMonth, selectedYear, selectedStoreId]);

  const loadStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, number, name');
    
    if (data) {
      // Ordenar numericamente (05, 08, 09, 26... 109)
      const sortedStores = data.sort((a, b) => {
        const numA = parseInt(a.number);
        const numB = parseInt(b.number);
        return numA - numB;
      });
      setStores(sortedStores);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar dados por loja
      let storeQuery = supabase
        .from('vw_monthly_summary_by_store')
        .select('*')
        .eq('year_ref', selectedYear)
        .eq('month_ref', selectedMonth)
        .order('total_premio_mes', { ascending: false });

      if (selectedStoreId !== 'all') {
        storeQuery = storeQuery.eq('store_id', selectedStoreId);
      }

      const { data: storeData } = await storeQuery;
      if (storeData) setStoresData(storeData);

      // Carregar dados por vendedor
      let vendedorQuery = supabase
        .from('vw_monthly_summary_by_vendedor')
        .select('*')
        .eq('year_ref', selectedYear)
        .eq('month_ref', selectedMonth)
        .order('premio_total_mes', { ascending: false })
        .limit(50);

      if (selectedStoreId !== 'all') {
        vendedorQuery = vendedorQuery.eq('store_id', selectedStoreId);
      }

      const { data: vendedorData } = await vendedorQuery;
      if (vendedorData) setVendedoresData(vendedorData);

      // Carregar dashboard executivo
      const { data: execData } = await supabase
        .from('vw_monthly_executive_dashboard')
        .select('*')
        .eq('year_ref', selectedYear)
        .eq('month_ref', selectedMonth)
        .single();

      if (execData) setExecutiveData(execData);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (delta: number) => {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const monthName = format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy', { locale: ptBR });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
              <Award size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic">
                Relatório Mensal de Premiações
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Sistema de Rateio Proporcional
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

        {/* Filtros */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Navegação de Mês */}
            <div>
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
                <Calendar className="inline mr-1" size={12} /> Período
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeMonth(-1)}
                  className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  <ChevronLeft size={16} className="text-slate-600 dark:text-slate-400" />
                </button>
                <div className="flex-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase italic">
                    {monthName}
                  </p>
                </div>
                <button
                  onClick={() => changeMonth(1)}
                  className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  <ChevronRight size={16} className="text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {/* Filtro de Loja */}
            <div>
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
                <Building2 className="inline mr-1" size={12} /> Loja
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
              >
                <option value="all">🏪 Todas as Lojas</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>Loja {s.number} - {s.name}</option>
                ))}
              </select>
            </div>

            {/* Botão Exportar */}
            <div className="flex items-end">
              <button
                onClick={() => alert('Funcionalidade de exportação em desenvolvimento')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-xs shadow-lg border-b-4 border-emerald-800 transition-all active:scale-95"
              >
                <Download size={16} />
                Exportar PDF
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('lojas')}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-black uppercase text-xs transition-all whitespace-nowrap ${
                activeTab === 'lojas'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 border-t-4 border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Building2 size={16} />
              Por Loja
            </button>
            <button
              onClick={() => setActiveTab('vendedores')}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-black uppercase text-xs transition-all whitespace-nowrap ${
                activeTab === 'vendedores'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 border-t-4 border-emerald-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Users size={16} />
              Por Vendedor
            </button>
            <button
              onClick={() => setActiveTab('executivo')}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-black uppercase text-xs transition-all whitespace-nowrap ${
                activeTab === 'executivo'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 border-t-4 border-purple-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <TrendingUp size={16} />
              Dashboard Executivo
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Tab: Por Loja */}
              {activeTab === 'lojas' && (
                <div className="space-y-4">
                  {storesData.length === 0 ? (
                    <div className="text-center py-12">
                      <Building2 className="mx-auto mb-4 text-slate-300" size={48} />
                      <p className="text-sm font-black text-slate-400 uppercase italic">
                        Nenhum dado encontrado para este período
                      </p>
                    </div>
                  ) : (
                    storesData.map((store, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                                {store.store_number}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase italic">
                                {store.store_name}
                              </h3>
                              <p className="text-xs font-bold text-slate-400">
                                Loja {store.store_number}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-600">
                              R$ {store.total_premio_mes.toFixed(2)}
                            </p>
                            <p className="text-xs font-bold text-slate-400 uppercase">
                              Total Prêmios (Rateado)
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-black text-slate-400 uppercase mb-1">Vendedores</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white">
                              {store.total_vendedores}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-black text-slate-400 uppercase mb-1">P.A Médio</p>
                            <p className="text-lg font-black text-blue-600">
                              {store.pa_medio?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-black text-slate-400 uppercase mb-1">Metas Atingidas</p>
                            <p className="text-lg font-black text-amber-600">
                              {store.vendedores_atingiram_pa}/{store.total_vendedores}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-black text-slate-400 uppercase mb-1">Vendas</p>
                            <p className="text-lg font-black text-purple-600">
                              R$ {(store.total_vendas_mes / 1000).toFixed(0)}k
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab: Por Vendedor */}
              {activeTab === 'vendedores' && (
                <div className="space-y-3">
                  {vendedoresData.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="mx-auto mb-4 text-slate-300" size={48} />
                      <p className="text-sm font-black text-slate-400 uppercase italic">
                        Nenhum vendedor encontrado para este período
                      </p>
                    </div>
                  ) : (
                    vendedoresData.map((vendedor, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm ${
                            index === 0 ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' :
                            index === 1 ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white' :
                            index === 2 ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' :
                            'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                            #{index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white">
                              {vendedor.nome_vendedor}
                            </p>
                            <p className="text-xs font-bold text-slate-400">
                              Loja {vendedor.store_number} • {vendedor.store_name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs font-black text-slate-400 uppercase">P.A Médio</p>
                            <p className="text-base font-black text-blue-600">
                              {vendedor.pa_medio_mes?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-slate-400 uppercase">Metas</p>
                            <p className="text-base font-black text-amber-600">
                              {vendedor.semanas_atingiu_pa}/{vendedor.total_semanas_trabalhadas}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-slate-400 uppercase">Prêmio Total</p>
                            <p className="text-lg font-black text-emerald-600">
                              R$ {vendedor.premio_total_mes?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab: Dashboard Executivo */}
              {activeTab === 'executivo' && (
                <div className="space-y-6">
                  {!executiveData ? (
                    <div className="text-center py-12">
                      <TrendingUp className="mx-auto mb-4 text-slate-300" size={48} />
                      <p className="text-sm font-black text-slate-400 uppercase italic">
                        Nenhum dado executivo disponível
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* KPIs Principais */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-6 border-2 border-blue-200 dark:border-blue-800">
                          <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase mb-2">
                            Total Lojas
                          </p>
                          <p className="text-3xl font-black text-blue-700 dark:text-blue-300">
                            {executiveData.total_lojas}
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl p-6 border-2 border-purple-200 dark:border-purple-800">
                          <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase mb-2">
                            Vendedores Rede
                          </p>
                          <p className="text-3xl font-black text-purple-700 dark:text-purple-300">
                            {executiveData.total_vendedores_rede}
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-2xl p-6 border-2 border-amber-200 dark:border-amber-800">
                          <p className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase mb-2">
                            P.A Médio Rede
                          </p>
                          <p className="text-3xl font-black text-amber-700 dark:text-amber-300">
                            {executiveData.pa_medio_rede?.toFixed(2) || '0.00'}
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-2xl p-6 border-2 border-emerald-200 dark:border-emerald-800">
                          <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase mb-2">
                            Total Prêmios
                          </p>
                          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                            R$ {(executiveData.premio_total_rede / 1000).toFixed(1)}k
                          </p>
                        </div>
                      </div>

                      {/* Faturamento e Taxa de Sucesso */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-black text-slate-400 uppercase mb-3">
                            Faturamento Total da Rede
                          </p>
                          <p className="text-4xl font-black text-blue-600 mb-2">
                            R$ {(executiveData.faturamento_total_rede / 1000).toFixed(0)}k
                          </p>
                          <p className="text-sm font-bold text-slate-500">
                            Média por vendedor: R$ {executiveData.faturamento_por_vendedor?.toFixed(2) || '0.00'}
                          </p>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-black text-slate-400 uppercase mb-3">
                            Taxa de Sucesso P.A
                          </p>
                          <p className="text-4xl font-black text-emerald-600 mb-2">
                            {executiveData.taxa_sucesso_pa_rede?.toFixed(1) || '0.0'}%
                          </p>
                          <p className="text-sm font-bold text-slate-500">
                            {executiveData.total_atingiram_pa} vendedores atingiram a meta
                          </p>
                        </div>
                      </div>

                      {/* Destaques */}
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-2xl p-6 border-2 border-orange-200 dark:border-orange-800">
                        <p className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase mb-4">
                          🏆 Destaques do Mês
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-black text-slate-600 dark:text-slate-300 mb-1">
                              Melhor Loja em Premiação
                            </p>
                            <p className="text-lg font-black text-orange-600 dark:text-orange-400">
                              {executiveData.melhor_loja_premio || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-600 dark:text-slate-300 mb-1">
                              Melhor Loja em P.A
                            </p>
                            <p className="text-lg font-black text-orange-600 dark:text-orange-400">
                              {executiveData.melhor_loja_pa || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer com Legenda */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center">
            ℹ️ Valores rateados proporcionalmente para semanas que cruzam meses • 
            Vendedores recebem valores integrais no pagamento
          </p>
        </div>
      </div>
    </div>
  );
};