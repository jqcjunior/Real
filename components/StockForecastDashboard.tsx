import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Calendar, TrendingUp, TrendingDown, Clock, Activity, AlertCircle } from 'lucide-react';

export default function StockForecastDashboard({ user, stores }: { user: any; stores: any[] }) {
  const [selectedStore, setSelectedStore] = useState('');
  const [forecastMonths, setForecastMonths] = useState(3);
  const [forecastData, setForecastData] = useState<any>(null);
  const [categoryForecasts, setCategoryForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Inicializar loja padrão
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStore) {
      if (user?.role === 'MANAGER' && user?.storeId) {
        setSelectedStore(user.storeId.toString());
      } else {
        setSelectedStore(stores[0].number || stores[0].id.toString());
      }
    }
  }, [stores, user]);

  useEffect(() => {
    if (selectedStore) {
      loadForecast();
    }
  }, [selectedStore, forecastMonths]);

  const loadForecast = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.rpc('generate_forecast_report', {
        p_store_number: selectedStore,
        p_months_ahead: forecastMonths
      });

      if (error) throw error;
      setForecastData(data);

      // Carregar previsões detalhadas para capa categoria apresentada nas tendências
      const detailedForecasts = [];
      if (data && data.tendencias && Array.isArray(data.tendencias)) {
        for (const t of data.tendencias) {
          const { data: cData, error: cError } = await supabase.rpc('calculate_stock_forecast', {
            p_store_number: selectedStore,
            p_categoria: t.categoria,
            p_meses: forecastMonths
          });
          if (!cError && cData) {
            detailedForecasts.push({
              categoria: t.categoria,
              detalhes: cData
            });
          }
        }
      }
      setCategoryForecasts(detailedForecasts);

    } catch (err: any) {
      console.error('Error loading forecast:', err);
      setError(err.message || 'Erro ao carregar previsão de estoque');
    } finally {
      setLoading(false);
    }
  };

  const getTrendColor = (trend: string) => {
    if (trend.includes('Forte')) return 'text-green-600 bg-green-50';
    if (trend.includes('Crescimento')) return 'text-yellow-600 bg-yellow-50';
    if (trend.includes('Queda')) return 'text-red-600 bg-red-50';
    return 'text-orange-600 bg-orange-50';
  };

  const getConfidenceIcon = (conf: string) => {
    if (conf === 'Alta') return <span className="text-green-500 font-bold">✓</span>;
    if (conf === 'Média') return <span className="text-yellow-500 font-bold">~</span>;
    return <span className="text-red-500 font-bold">⚠</span>;
  };

  return (
    <div className="stock-forecast-dashboard p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="text-blue-600" />
            Previsão de Estoque
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Análise de tendências, sazonalidade e comportamento de demanda.
          </p>
        </div>

        <div className="flex gap-4 items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1 font-medium">Loja</label>
            <select
              title="Loja"
              className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              disabled={user?.role === 'MANAGER'}
            >
              <option value="" disabled>Selecione uma loja</option>
              {stores?.map(s => (
                <option key={s.id} value={s.number}>{s.number} - {s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1 font-medium">Período Previsto</label>
            <select
              title="Período Previsto"
              className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={forecastMonths}
              onChange={(e) => setForecastMonths(Number(e.target.value))}
            >
              <option value={3}>3 Meses</option>
              <option value={6}>6 Meses</option>
              <option value={12}>12 Meses</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center gap-3">
          <AlertCircle className="text-red-500" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : forecastData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* RESUMO GERAL */}
          <div className="col-span-1 lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                <Calendar />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Período</p>
                <p className="text-lg font-bold text-gray-800">Próximos {forecastMonths} meses</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                <Activity />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Categorias Analisadas</p>
                <p className="text-lg font-bold text-gray-800">{forecastData.resumo_geral.categorias_analisadas || 0}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full text-green-600">
                <TrendingUp />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Pares Históricos</p>
                <p className="text-lg font-bold text-gray-800">{forecastData.resumo_geral.total_historico_pares?.toLocaleString('pt-BR') || 0}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                <Clock />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Média Mensal</p>
                <p className="text-lg font-bold text-gray-800">{forecastData.resumo_geral.media_mensal_pares?.toLocaleString('pt-BR') || 0} pares</p>
              </div>
            </div>
          </div>

          {/* TENDÊNCIAS POR CATEGORIA */}
          <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-500" />
              Tendências por Categoria
            </h2>
            
            <div className="space-y-6">
              {forecastData.tendencias && forecastData.tendencias.length > 0 ? (
                forecastData.tendencias.map((t: any, idx: number) => {
                  const details = categoryForecasts.find(cf => cf.categoria === t.categoria)?.detalhes || [];
                  const conf = details.length > 0 ? details[0].confianca : 'Média';
                  
                  return (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-gray-800">{t.categoria}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTrendColor(t.tendencia)}`}>
                          {t.tendencia} ({t.crescimento_medio_pct > 0 ? '+' : ''}{t.crescimento_medio_pct}%)
                        </span>
                      </div>
                      
                      {details.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {details.map((d: any, dIdx: number) => (
                            <div key={dIdx} className="bg-white p-2 rounded border border-gray-200 text-center shadow-sm">
                              <p className="text-xs text-gray-500 font-medium">{String(d.mes).padStart(2, '0')}/{d.ano}</p>
                              <p className="text-sm font-bold text-gray-800 mt-1">{d.previsao_pares} pares</p>
                            </div>
                          ))}
                          <div className="bg-white flex flex-col items-center justify-center p-2 rounded border border-gray-200 shadow-sm text-center">
                            <p className="text-xs text-gray-500 font-medium">Confiança</p>
                            <div className="text-sm mt-1">{getConfidenceIcon(conf)} {conf}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-8 text-gray-500">
                  Nenhuma tendência calculada para esta loja nos últimos meses. Realize compras para gerar histórico.
                </div>
              )}
            </div>
          </div>

          {/* PRÓXIMOS VENCIMENTOS */}
          <div className="col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
              <Calendar size={20} className="text-orange-500" />
              Próximos Vencimentos
            </h2>
            
            <div className="space-y-4">
              {forecastData.proximos_vencimentos && forecastData.proximos_vencimentos.length > 0 ? (
                forecastData.proximos_vencimentos.map((v: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-colors">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {new Date(v.vencimento_data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Em {v.dias_ate_vencer} dias</p>
                    </div>
                    <div className="font-bold text-red-600 text-sm">
                      R$ {v.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg">
                  Nenhum vencimento agendado para o período futuro.
                </div>
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-100">
               <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm flex gap-3 items-start">
                 <AlertCircle size={18} className="shrink-0 mt-0.5" />
                 <p>Utilize esta aba para planejar se a sua cota mensal será suficiente para cobrir os boletos agendados para os próximos meses.</p>
               </div>
            </div>
          </div>

        </div>
      ) : null}

    </div>
  );
}
