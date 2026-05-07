import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Target,
  Award,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Calendar,
  RefreshCw,
  Lightbulb,
  CheckCircle2,
  XCircle,
  DollarSign,
  Percent
} from 'lucide-react';
 
import { DREBenchmarkComponent } from './DREBenchmarkCorrigidoComponent';
import { DREInsightsPorLojaComponent } from './DREInsightsPorLojaComponent';

interface Anomalia {
  loja_id: number;
  mes_referencia: string;
  descricao: string;
  valor_real: number;
  valor_esperado: number;
  desvio_percentual: number;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
}
 
interface Insight {
  tipo: 'economia' | 'risco' | 'oportunidade' | 'tendencia';
  titulo: string;
  descricao: string;
  impacto: number;
  prioridade: 'baixa' | 'media' | 'alta';
}
 
interface Benchmark {
  conta: string;
  loja_melhor: number;
  valor_melhor: number;
  loja_pior: number;
  valor_pior: number;
  diferenca_percentual: number;
}
 
export const DREMaisComponent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'insights' | 'anomalias' | 'benchmark' | 'previsoes'>('insights');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [anomalias, setAnomalias] = useState<Anomalia[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
 
  useEffect(() => {
    loadData();
  }, []);
 
  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadInsights(),
      loadAnomalias(),
      loadBenchmarks()
    ]);
    setLoading(false);
  };
 
  const loadInsights = async () => {
    // Gerar insights baseados nos dados
    try {
      const { data } = await supabase
        .from('view_dre_resumo_mensal')
        .select('*')
        .order('mes_referencia', { ascending: false })
        .limit(6);
 
      if (!data || data.length === 0) {
        setInsights([]);
        return;
      }
 
      const generatedInsights: Insight[] = [];
 
      // INSIGHT 1: Margem negativa
      const margemNegativa = data.filter(d => Number(d.margem_liquida) < 0);
      if (margemNegativa.length > 0) {
        const totalPrejuizo = margemNegativa.reduce((sum, d) => sum + Math.abs(Number(d.margem_liquida)), 0);
        generatedInsights.push({
          tipo: 'risco',
          titulo: `${margemNegativa.length} meses com margem negativa`,
          descricao: `Prejuízo acumulado de R$ ${totalPrejuizo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Revisar despesas fixas e preços.`,
          impacto: totalPrejuizo,
          prioridade: 'alta'
        });
      }
 
      // INSIGHT 2: Tendência de crescimento
      if (data.length >= 3) {
        const ultimos3 = data.slice(0, 3);
        const receitaMedia = ultimos3.reduce((sum, d) => sum + Number(d.receita_total), 0) / 3;
        const primeirosValor = Number(ultimos3[2].receita_total);
        const crescimento = ((receitaMedia - primeirosValor) / primeirosValor) * 100;
 
        if (Math.abs(crescimento) > 5) {
          generatedInsights.push({
            tipo: crescimento > 0 ? 'oportunidade' : 'risco',
            titulo: `Receitas ${crescimento > 0 ? 'crescendo' : 'caindo'} ${Math.abs(crescimento).toFixed(1)}%`,
            descricao: `Tendência ${crescimento > 0 ? 'positiva' : 'negativa'} nos últimos 3 meses. ${crescimento > 0 ? 'Manter estratégia atual.' : 'Ação corretiva necessária.'}`,
            impacto: Math.abs(crescimento),
            prioridade: Math.abs(crescimento) > 15 ? 'alta' : 'media'
          });
        }
      }
 
      // INSIGHT 3: Despesas elevadas
      const despesaMedia = data.reduce((sum, d) => sum + Number(d.despesa_total), 0) / data.length;
      const receitaMedia = data.reduce((sum, d) => sum + Number(d.receita_total), 0) / data.length;
      const ratioDespesa = (despesaMedia / receitaMedia) * 100;
 
      if (ratioDespesa > 100) {
        generatedInsights.push({
          tipo: 'economia',
          titulo: `Despesas ${ratioDespesa.toFixed(0)}% das receitas`,
          descricao: `Despesas excedem receitas. Oportunidade de economia em custos variáveis.`,
          impacto: despesaMedia - receitaMedia,
          prioridade: 'alta'
        });
      }
 
      // INSIGHT 4: Mês com melhor desempenho
      const melhorMes = data.reduce((max, d) => 
        Number(d.margem_liquida) > Number(max.margem_liquida) ? d : max
      );
 
      if (Number(melhorMes.margem_liquida) > 0) {
        const mesFormatado = new Date(melhorMes.mes_referencia).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        generatedInsights.push({
          tipo: 'oportunidade',
          titulo: `Melhor desempenho: ${mesFormatado}`,
          descricao: `Margem de R$ ${Number(melhorMes.margem_liquida).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Analisar fatores de sucesso para replicar.`,
          impacto: Number(melhorMes.margem_liquida),
          prioridade: 'media'
        });
      }
 
      setInsights(generatedInsights);
 
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      setInsights([]);
    }
  };
 
  const loadAnomalias = async () => {
    // Detectar anomalias nos dados
    try {
      const { data } = await supabase
        .from('dre_data')
        .select('loja_id, mes_referencia, descricao, valor')
        .order('mes_referencia', { ascending: false })
        .limit(500);
 
      if (!data) {
        setAnomalias([]);
        return;
      }
 
      // Agrupar por conta
      const contasPorDescricao = data.reduce((acc, row) => {
        if (!acc[row.descricao]) acc[row.descricao] = [];
        acc[row.descricao].push(Number(row.valor));
        return acc;
      }, {} as Record<string, number[]>);
 
      const anomaliasDetectadas: Anomalia[] = [];
 
      // Detectar valores muito acima/abaixo da média
      Object.entries(contasPorDescricao).forEach(([descricao, valores]) => {
        if (valores.length < 3) return;
 
        const media = valores.reduce((sum, v) => sum + v, 0) / valores.length;
        const desvioPadrao = Math.sqrt(
          valores.reduce((sum, v) => sum + Math.pow(v - media, 2), 0) / valores.length
        );
 
        valores.forEach((valor, idx) => {
          const desvio = Math.abs(valor - media);
          const desvioPercentual = (desvio / (media || 1)) * 100;
 
          if (desvioPercentual > 200 && Math.abs(valor) > 1000) {
            let severidade: 'baixa' | 'media' | 'alta' | 'critica' = 'baixa';
            if (desvioPercentual > 500) severidade = 'critica';
            else if (desvioPercentual > 350) severidade = 'alta';
            else if (desvioPercentual > 250) severidade = 'media';
 
            anomaliasDetectadas.push({
              loja_id: data.find(d => d.descricao === descricao)?.loja_id || 0,
              mes_referencia: data.find(d => d.descricao === descricao)?.mes_referencia || '',
              descricao,
              valor_real: valor,
              valor_esperado: media,
              desvio_percentual: desvioPercentual,
              severidade
            });
          }
        });
      });
 
      setAnomalias(anomaliasDetectadas.slice(0, 10));
 
    } catch (error) {
      console.error('Erro ao detectar anomalias:', error);
      setAnomalias([]);
    }
  };
 
  const loadBenchmarks = async () => {
    // Comparar desempenho entre lojas
    try {
      const { data } = await supabase
        .from('dre_data')
        .select('loja_id, descricao, valor, mes_referencia')
        .gte('mes_referencia', new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0]);
 
      if (!data || data.length === 0) {
        setBenchmarks([]);
        return;
      }
 
      // Agrupar por conta e loja
      const groupedByAccount = data.reduce((acc, row) => {
        const key = row.descricao;
        if (!acc[key]) acc[key] = {};
        if (!acc[key][row.loja_id]) acc[key][row.loja_id] = [];
        acc[key][row.loja_id].push(Number(row.valor));
        return acc;
      }, {} as Record<string, Record<number, number[]>>);
 
      const benchmarksData: Benchmark[] = [];
 
      Object.entries(groupedByAccount).forEach(([conta, lojas]) => {
        const lojasComMedia = Object.entries(lojas).map(([lojaId, valores]) => ({
          loja: Number(lojaId),
          media: valores.reduce((sum, v) => sum + v, 0) / valores.length
        }));
 
        if (lojasComMedia.length > 1) {
          const sorted = lojasComMedia.sort((a, b) => b.media - a.media);
          const melhor = sorted[0];
          const pior = sorted[sorted.length - 1];
          const diferenca = ((melhor.media - pior.media) / (Math.abs(pior.media) || 1)) * 100;
 
          if (Math.abs(diferenca) > 20 && Math.abs(melhor.media) > 100) {
            benchmarksData.push({
              conta,
              loja_melhor: melhor.loja,
              valor_melhor: melhor.media,
              loja_pior: pior.loja,
              valor_pior: pior.media,
              diferenca_percentual: diferenca
            });
          }
        }
      });
 
      setBenchmarks(benchmarksData.slice(0, 8));
 
    } catch (error) {
      console.error('Erro ao carregar benchmarks:', error);
      setBenchmarks([]);
    }
  };
 
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };
 
  const getInsightIcon = (tipo: string) => {
    switch (tipo) {
      case 'economia': return <DollarSign className="w-5 h-5" />;
      case 'risco': return <AlertTriangle className="w-5 h-5" />;
      case 'oportunidade': return <Target className="w-5 h-5" />;
      case 'tendencia': return <TrendingUp className="w-5 h-5" />;
      default: return <Lightbulb className="w-5 h-5" />;
    }
  };
 
  const getInsightColor = (tipo: string) => {
    switch (tipo) {
      case 'economia': return 'green';
      case 'risco': return 'red';
      case 'oportunidade': return 'blue';
      case 'tendencia': return 'purple';
      default: return 'gray';
    }
  };
 
  const getPriorityBadge = (prioridade: string) => {
    const colors = {
      baixa: 'bg-gray-100 text-gray-700',
      media: 'bg-yellow-100 text-yellow-700',
      alta: 'bg-red-100 text-red-700'
    };
    return colors[prioridade as keyof typeof colors] || colors.baixa;
  };
 
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }
 
  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Inteligência DRE</h1>
            <p className="text-indigo-100 mt-1">Insights automáticos, anomalias e oportunidades</p>
          </div>
        </div>
      </div>
 
      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('insights')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
            activeTab === 'insights'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          💡 Insights ({insights.length})
        </button>
        <button
          onClick={() => setActiveTab('anomalias')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
            activeTab === 'anomalias'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          ⚠️ Anomalias ({anomalias.length})
        </button>
        <button
          onClick={() => setActiveTab('benchmark')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
            activeTab === 'benchmark'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          🏆 Benchmark ({benchmarks.length})
        </button>
        <button
          onClick={() => setActiveTab('previsoes')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
            activeTab === 'previsoes'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          📈 Previsões
        </button>
      </div>
 
      {/* CONTENT */}
      <div className="min-h-[400px]">
        
        {/* TAB: INSIGHTS */}
        {activeTab === 'insights' && (
          <DREInsightsPorLojaComponent />
        )}
 
        {/* TAB: ANOMALIAS */}
        {activeTab === 'anomalias' && (
          <div className="space-y-3">
            {anomalias.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Nenhuma anomalia detectada</p>
                <p className="text-sm text-gray-500 mt-1">Seus dados estão dentro do padrão esperado</p>
              </div>
            ) : (
              anomalias.map((anomalia, idx) => (
                <div
                  key={idx}
                  className={`border-l-4 ${
                    anomalia.severidade === 'critica' ? 'border-red-500 bg-red-50' :
                    anomalia.severidade === 'alta' ? 'border-orange-500 bg-orange-50' :
                    anomalia.severidade === 'media' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  } rounded-r-xl p-4`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className={`w-4 h-4 ${
                          anomalia.severidade === 'critica' ? 'text-red-600' :
                          anomalia.severidade === 'alta' ? 'text-orange-600' :
                          anomalia.severidade === 'media' ? 'text-yellow-600' :
                          'text-blue-600'
                        }`} />
                        <span className="font-semibold text-gray-900">{anomalia.descricao}</span>
                        <span className="text-xs text-gray-500">Loja {anomalia.loja_id}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          Real: <strong>{formatCurrency(anomalia.valor_real)}</strong>
                        </span>
                        <span className="text-gray-600">
                          Esperado: <strong>{formatCurrency(anomalia.valor_esperado)}</strong>
                        </span>
                        <span className={`font-bold ${
                          anomalia.desvio_percentual > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {anomalia.desvio_percentual > 0 ? '↑' : '↓'} {Math.abs(anomalia.desvio_percentual).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
 
        {/* TAB: BENCHMARK */}
        {activeTab === 'benchmark' && (
          <DREBenchmarkComponent />
        )}
 
        {/* TAB: PREVISÕES */}
        {activeTab === 'previsoes' && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-dashed border-purple-300 rounded-xl p-16 text-center">
            <Activity className="w-20 h-20 text-purple-400 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-800 mb-3">Previsões em Desenvolvimento</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Em breve: previsões de receita e despesa usando machine learning, análise de tendências sazonais e projeções de margem.
            </p>
          </div>
        )}
 
      </div>
    </div>
  );
};