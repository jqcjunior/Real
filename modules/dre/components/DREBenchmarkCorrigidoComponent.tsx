import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import { Award, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface BenchmarkItem {
  descricao: string;
  loja_melhor: number;
  valor_melhor: number;
  loja_pior: number;
  valor_pior: number;
  diferenca_absoluta: number;
  diferenca_percentual: number;
}

export const DREBenchmarkComponent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [benchmarks, setBenchmarks] = useState<BenchmarkItem[]>([]);
  const [mesReferencia, setMesReferencia] = useState('2025-01-01');

  useEffect(() => {
    loadBenchmarks();
  }, [mesReferencia]);

  const loadBenchmarks = async () => {
    setLoading(true);

    const { data } = await supabase
      .from('dre_data')
      .select('loja_id, descricao, valor, type')
      .eq('mes_referencia', mesReferencia)
      .eq('type', 'DESPESA')
      .gt('valor', 0);

    if (!data) {
      setLoading(false);
      return;
    }

    // Agrupar por descrição
    const grouped = data.reduce((acc, row) => {
      if (!acc[row.descricao]) acc[row.descricao] = [];
      acc[row.descricao].push({ loja_id: row.loja_id, valor: row.valor });
      return acc;
    }, {} as Record<string, Array<{ loja_id: number; valor: number }>>);

    // Calcular benchmarks
    const benchmarkList: BenchmarkItem[] = [];

    Object.entries(grouped).forEach(([descricao, valores]) => {
      // Precisa ter pelo menos 2 lojas
      if (valores.length < 2) return;

      // Ordenar por valor (menor = melhor para despesas)
      const sorted = valores.sort((a, b) => a.valor - b.valor);
      const melhor = sorted[0];
      const pior = sorted[sorted.length - 1];

      // Calcular diferença
      const diferenca_abs = pior.valor - melhor.valor;
      const diferenca_pct = (diferenca_abs / melhor.valor) * 100;

      // Só incluir se diferença for > 10%
      if (diferenca_pct > 10) {
        benchmarkList.push({
          descricao,
          loja_melhor: melhor.loja_id,
          valor_melhor: melhor.valor,
          loja_pior: pior.loja_id,
          valor_pior: pior.valor,
          diferenca_absoluta: diferenca_abs,
          diferenca_percentual: diferenca_pct
        });
      }
    });

    // Ordenar por diferença percentual (maior primeiro)
    benchmarkList.sort((a, b) => b.diferenca_percentual - a.diferenca_percentual);

    setBenchmarks(benchmarkList);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="space-y-4">
      
      {/* FILTRO DE MÊS */}
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mês de Referência para Comparação
        </label>
        <select
          value={mesReferencia}
          onChange={(e) => setMesReferencia(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="2025-01-01">Janeiro/2025</option>
          <option value="2025-02-01">Fevereiro/2025</option>
          <option value="2025-03-01">Março/2025</option>
          <option value="2025-04-01">Abril/2025</option>
          <option value="2025-05-01">Maio/2025</option>
          <option value="2025-06-01">Junho/2025</option>
          <option value="2025-07-01">Julho/2025</option>
          <option value="2025-08-01">Agosto/2025</option>
          <option value="2025-09-01">Setembro/2025</option>
          <option value="2025-10-01">Outubro/2025</option>
          <option value="2025-11-01">Novembro/2025</option>
          <option value="2025-12-01">Dezembro/2025</option>
        </select>
      </div>

      {/* LISTA DE BENCHMARKS */}
      {loading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : benchmarks.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
          <h3 className="font-semibold text-yellow-900 mb-2">Sem diferenças significativas</h3>
          <p className="text-sm text-yellow-700">
            Não foram encontradas despesas com diferença > 10% entre as lojas neste mês.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {benchmarks.map((item, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                {item.descricao}
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                {/* MELHOR DESEMPENHO */}
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-green-600" />
                    <span className="text-xs font-medium text-green-700 uppercase">
                      Melhor Desempenho
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Loja {item.loja_melhor}</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(item.valor_melhor)}
                  </p>
                </div>

                {/* PRECISA MELHORAR */}
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    <span className="text-xs font-medium text-red-700 uppercase">
                      Precisa Melhorar
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Loja {item.loja_pior}</p>
                  <p className="text-2xl font-bold text-red-700">
                    {formatCurrency(item.valor_pior)}
                  </p>
                </div>
              </div>

              {/* DIFERENÇA */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-600">Diferença:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {formatCurrency(item.diferenca_absoluta)}
                  </span>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  item.diferenca_percentual > 50 ? 'bg-red-100 text-red-700' :
                  item.diferenca_percentual > 25 ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  <TrendingDown className="w-4 h-4 inline mr-1" />
                  {item.diferenca_percentual.toFixed(1)}% mais caro
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};