import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Building2,
  AlertCircle,
  BarChart3,
  LineChart,
  RefreshCw
} from 'lucide-react';
 
interface ResumoMensal {
  loja_id: number;
  mes_referencia: string;
  receita_total: number;
  despesa_total: number;
  margem_liquida: number;
  margem_percent: number;
}
 
export const DREAnalyticsComponent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<ResumoMensal[]>([]);
  const [lojasFiltro, setLojasFiltro] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
 
  const fetchData = async () => {
    setLoading(true);
    setError(null);
 
    try {
      const { data, error } = await supabase
        .from('view_dre_resumo_mensal')
        .select('*')
        .order('mes_referencia', { ascending: false })
        .limit(12);
 
      if (error) throw error;
 
      setResumo(data || []);
      
      // Extrair lojas únicas
      const lojasUnicas = Array.from(new Set(data?.map(d => d.loja_id) || []));
      setLojasFiltro(lojasUnicas);
      
    } catch (err: any) {
      console.error('Erro ao carregar analytics:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    fetchData();
  }, []);
 
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };
 
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  };
 
  // Calcular totais
  const totalReceitas = resumo.reduce((sum, r) => sum + Number(r.receita_total), 0);
  const totalDespesas = resumo.reduce((sum, r) => sum + Number(r.despesa_total), 0);
  const margemGeral = totalReceitas - totalDespesas;
  const margemPercentGeral = totalReceitas > 0 ? (margemGeral / totalReceitas) * 100 : 0;
 
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-600">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <p>Carregando analytics...</p>
        </div>
      </div>
    );
  }
 
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3 text-red-800">
          <AlertCircle className="w-6 h-6" />
          <div>
            <h3 className="font-semibold">Erro ao carregar dados</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }
 
  if (resumo.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center gap-3 text-yellow-800">
          <AlertCircle className="w-6 h-6" />
          <div>
            <h3 className="font-semibold">Nenhum dado disponível</h3>
            <p className="text-sm">Importe dados DRE para visualizar analytics</p>
          </div>
        </div>
      </div>
    );
  }
 
  return (
    <div className="space-y-6">
      
      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Total Receitas */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-600 uppercase tracking-wide">
              Receitas
            </span>
          </div>
          <p className="text-2xl font-bold text-green-900">
            {formatCurrency(totalReceitas)}
          </p>
          <p className="text-xs text-green-600 mt-1">
            Últimos 12 meses
          </p>
        </div>
 
        {/* Total Despesas */}
        <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-xs font-medium text-red-600 uppercase tracking-wide">
              Despesas
            </span>
          </div>
          <p className="text-2xl font-bold text-red-900">
            {formatCurrency(totalDespesas)}
          </p>
          <p className="text-xs text-red-600 mt-1">
            Últimos 12 meses
          </p>
        </div>
 
        {/* Margem Líquida */}
        <div className={`bg-gradient-to-br ${margemGeral >= 0 ? 'from-blue-50 to-indigo-50 border-blue-200' : 'from-orange-50 to-amber-50 border-orange-200'} border rounded-xl p-6 shadow-sm`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${margemGeral >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
              <DollarSign className={`w-5 h-5 ${margemGeral >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
            <span className={`text-xs font-medium uppercase tracking-wide ${margemGeral >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              Margem
            </span>
          </div>
          <p className={`text-2xl font-bold ${margemGeral >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
            {formatCurrency(margemGeral)}
          </p>
          <p className={`text-xs mt-1 ${margemGeral >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {margemPercentGeral.toFixed(1)}% margem
          </p>
        </div>
 
        {/* Lojas Analisadas */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">
              Lojas
            </span>
          </div>
          <p className="text-2xl font-bold text-purple-900">
            {lojasFiltro.length}
          </p>
          <p className="text-xs text-purple-600 mt-1">
            {lojasFiltro.join(', ')}
          </p>
        </div>
      </div>
 
      {/* TABELA DE EVOLUÇÃO MENSAL */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Evolução Mensal - Últimos 12 Meses
            </h3>
          </div>
        </div>
 
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Período
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Loja
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Receitas
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Despesas
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Margem
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resumo.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(row.mes_referencia)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {row.loja_id}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                    {formatCurrency(Number(row.receita_total))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                    {formatCurrency(Number(row.despesa_total))}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                    Number(row.margem_liquida) >= 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}>
                    {formatCurrency(Number(row.margem_liquida))}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-right text-xs font-medium ${
                    Number(row.margem_percent) >= 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}>
                    {Number(row.margem_percent).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
 
      {/* GRÁFICOS - COMING SOON */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <LineChart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Gráficos em Desenvolvimento
        </h3>
        <p className="text-gray-500">
          Visualizações gráficas estarão disponíveis em breve
        </p>
      </div>
    </div>
  );
};