import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Target, 
  Award,
  AlertCircle,
  Building2,
  Calendar,
  RefreshCw
} from 'lucide-react';

interface StoreInsight {
  loja_id: number;
  risco: 'Critico' | 'Alto' | 'Medio' | 'Baixo';
  margem_valor: number;
  margem_percent: number;
  tendencia: 'Crescimento' | 'Queda' | 'Estavel';
  tendencia_percent: number;
  maior_despesa_nome: string;
  maior_despesa_valor: number;
  melhor_mes: string;
  melhor_mes_margem: number;
  alerta: string;
  oportunidade: string;
}

export const DREInsightsPorLojaComponent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<StoreInsight[]>([]);
  const [mesInicio, setMesInicio] = useState('2025-01-01');
  const [mesFim, setMesFim] = useState('2025-12-01');

  useEffect(() => {
    loadInsights();
  }, [mesInicio, mesFim]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      // 1. Buscar resumo mensal por loja
      const { data: resumoData } = await supabase
        .from('view_dre_resumo_mensal')
        .select('*')
        .gte('mes_referencia', mesInicio)
        .lte('mes_referencia', mesFim);

      if (!resumoData || resumoData.length === 0) {
        setInsights([]);
        setLoading(false);
        return;
      }

      // 2. Buscar todas as despesas para encontrar a maior por loja
      const { data: despesasData } = await supabase
        .from('dre_data')
        .select('loja_id, descricao, valor')
        .eq('type', 'DESPESA')
        .gte('mes_referencia', mesInicio)
        .lte('mes_referencia', mesFim);

      // Agrupar lojas
      const lojasIds = Array.from(new Set(resumoData.map(d => d.loja_id)));
      
      const storesInsights: StoreInsight[] = lojasIds.map(lojaId => {
        const lojaData = resumoData.filter(d => d.loja_id === lojaId).sort((a, b) => a.mes_referencia.localeCompare(b.mes_referencia));
        
        // Margem Total e Média
        const margem_valor = lojaData.reduce((sum, d) => sum + Number(d.margem_liquida), 0);
        const receita_total = lojaData.reduce((sum, d) => sum + Number(d.receita_total), 0);
        const margem_percent = receita_total !== 0 ? (margem_valor / receita_total) * 100 : 0;

        // Tendência (Compara média dos primeiros 3 meses vs média dos últimos 3 meses)
        const count = lojaData.length;
        let tendencia_percent = 0;
        if (count >= 2) {
          const firstBatch = lojaData.slice(0, Math.min(3, Math.ceil(count / 2)));
          const lastBatch = lojaData.slice(-Math.min(3, Math.ceil(count / 2)));
          
          const avgFirst = firstBatch.reduce((sum, d) => sum + Number(d.receita_total), 0) / firstBatch.length;
          const avgLast = lastBatch.reduce((sum, d) => sum + Number(d.receita_total), 0) / lastBatch.length;
          
          tendencia_percent = avgFirst !== 0 ? ((avgLast - avgFirst) / avgFirst) * 100 : 0;
        }
        
        let tendencia: 'Crescimento' | 'Queda' | 'Estavel' = 'Estavel';
        if (tendencia_percent > 5) tendencia = 'Crescimento';
        else if (tendencia_percent < -5) tendencia = 'Queda';

        // Melhor Mês
        const melhorMesObj = [...lojaData].sort((a, b) => Number(b.margem_liquida) - Number(a.margem_liquida))[0];

        // Maior Despesa
        const lojaDespesas = (despesasData || []).filter(d => d.loja_id === lojaId);
        const agrupadoDespesas = lojaDespesas.reduce((acc, curr) => {
          acc[curr.descricao] = (acc[curr.descricao] || 0) + Number(curr.valor);
          return acc;
        }, {} as Record<string, number>);
        
        const sortedDespesas = Object.entries(agrupadoDespesas).sort((a, b) => b[1] - a[1]);
        const topDespesaEntry = sortedDespesas[0] || ["-", 0];

        // Risco e Margem Status
        let risco: 'Critico' | 'Alto' | 'Medio' | 'Baixo' = 'Baixo';
        if (margem_percent < 0) risco = 'Critico';
        else if (margem_percent < 5) risco = 'Alto';
        else if (margem_percent < 10) risco = 'Medio';

        // Alertas (conforme especificação)
        let alerta = "Operação estável - Monitorar";
        if (margem_percent < -50) alerta = "Margem crítica - Ação urgente";
        else if (margem_percent < 0) alerta = "Margem negativa - Revisar custos";
        else if (tendencia === 'Queda') alerta = `Receitas caindo ${Math.abs(tendencia_percent).toFixed(1)}% - Investigar`;

        // Oportunidades (conforme especificação)
        let oportunidade = `Buscar eficiência em ${topDespesaEntry[0]}`;
        if (topDespesaEntry[1] > (receita_total * 0.2)) {
          oportunidade = `${topDespesaEntry[0]} representa ${(topDespesaEntry[1]/receita_total * 100).toFixed(0)}% das receitas - Reduzir`;
        } else if (tendencia === 'Crescimento') {
          oportunidade = `Receitas crescendo ${tendencia_percent.toFixed(1)}% - Manter`;
        }

        return {
          loja_id: lojaId,
          risco,
          margem_valor,
          margem_percent,
          tendencia,
          tendencia_percent,
          maior_despesa_nome: topDespesaEntry[0],
          maior_despesa_valor: topDespesaEntry[1],
          melhor_mes: new Date(melhorMesObj.mes_referencia).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          melhor_mes_margem: Number(melhorMesObj.margem_liquida),
          alerta,
          oportunidade
        };
      });

      setInsights(storesInsights);
    } catch (error) {
      console.error('Erro ao carregar insights por loja:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const getRiscoColor = (risco: string) => {
    switch (risco) {
      case 'Critico': return 'bg-red-500 text-white';
      case 'Alto': return 'bg-orange-500 text-white';
      case 'Medio': return 'bg-yellow-400 text-black';
      case 'Baixo': return 'bg-green-500 text-white';
      default: return 'bg-gray-100';
    }
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
      
      {/* FILTROS */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Período:</span>
        </div>
        <input 
          type="month" 
          value={mesInicio.substring(0, 7)}
          onChange={(e) => setMesInicio(`${e.target.value}-01`)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        />
        <span className="text-gray-400 self-center">até</span>
        <input 
          type="month" 
          value={mesFim.substring(0, 7)}
          onChange={(e) => setMesFim(`${e.target.value}-01`)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* TABELA DE INSIGHTS */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500 sticky left-0 bg-gray-50 z-10 border-r min-w-[80px]">Loja</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500 min-w-[120px]">Risco</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500 min-w-[150px]">Margem</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500 min-w-[150px]">Tendência</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500 min-w-[200px]">Maior Despesa</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500 min-w-[150px]">Melhor Mês</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500 min-w-[250px]">Alerta Principal</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500 min-w-[250px]">Oportunidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {insights.map((store, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                  <td className="p-4 font-black text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r">
                    <div className="flex items-center gap-2">
                       <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">
                        🏆
                       </span>
                       {store.loja_id}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getRiscoColor(store.risco)}`}>
                      {store.risco === 'Critico' ? '⚠️ ' : ''}{store.risco}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className={`font-bold ${
                        store.margem_percent < 0 ? 'text-red-600' : 
                        store.margem_percent < 10 ? 'text-yellow-600' : 
                        'text-green-600'
                      }`}>
                        {formatCurrency(store.margem_valor)}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {store.margem_percent.toFixed(1)}% das receitas
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {store.tendencia === 'Crescimento' ? <TrendingUp className="text-green-600 w-4 h-4" /> : 
                       store.tendencia === 'Queda' ? <TrendingDown className="text-red-600 w-4 h-4" /> : 
                       <Minus className="text-gray-400 w-4 h-4" />}
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-700 text-sm">{store.tendencia}</span>
                        <span className={`text-[10px] ${store.tendencia_percent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {store.tendencia_percent > 0 ? '+' : ''}{store.tendencia_percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col max-w-[180px]">
                      <span className="text-xs font-bold text-gray-800 line-clamp-1 truncate uppercase" title={store.maior_despesa_nome}>
                        {store.maior_despesa_nome}
                      </span>
                      <span className="text-[10px] text-red-500 font-medium">
                        {formatCurrency(store.maior_despesa_valor)}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-indigo-600 uppercase">{store.melhor_mes}</span>
                      <span className="text-[10px] text-green-600 font-bold">{formatCurrency(store.melhor_mes_margem)}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 min-w-[300px]">
                      <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${store.risco === 'Critico' ? 'text-red-600' : 'text-orange-600'}`} />
                      <span className="text-[11px] font-medium text-gray-700 leading-tight">
                        {store.alerta}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-start gap-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100 min-w-[300px]">
                      <Target className="w-4 h-4 mt-0.5 text-indigo-600 shrink-0" />
                      <span className="text-[11px] font-medium text-indigo-800 leading-tight">
                        {store.oportunidade}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
