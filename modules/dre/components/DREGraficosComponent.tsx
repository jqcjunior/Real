import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, RefreshCw } from 'lucide-react';

interface ChartData {
  mes: string;
  receitas: number;
  despesas: number;
  margem: number;
}

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

export const DREGraficosComponent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [evolutionData, setEvolutionData] = useState<ChartData[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [activeChart, setActiveChart] = useState<'evolution' | 'categories' | 'comparison'>('evolution');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadEvolution(), loadCategories()]);
    setLoading(false);
  };

  const loadEvolution = async () => {
    const { data } = await supabase
      .from('dre_data')
      .select('mes_referencia, type, valor')
      .order('mes_referencia');

    if (!data) return;

    // Agrupar por mês
    const grouped = data.reduce((acc, row) => {
      const mes = new Date(row.mes_referencia).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      if (!acc[mes]) acc[mes] = { mes, receitas: 0, despesas: 0, margem: 0 };
      
      if (row.type === 'RECEITA') acc[mes].receitas += row.valor;
      else if (row.type === 'DESPESA' || row.type === 'CMV') acc[mes].despesas += row.valor;
      
      return acc;
    }, {} as Record<string, ChartData>);

    const chartData = Object.values(grouped).map(item => ({
      ...item,
      margem: item.receitas - item.despesas
    }));

    setEvolutionData(chartData);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('dre_data')
      .select('descricao, valor, type')
      .eq('type', 'DESPESA')
      .gte('mes_referencia', '2025-01-01')
      .lte('mes_referencia', '2025-12-01');

    if (!data) return;

    // Top 5 despesas
    const grouped = data.reduce((acc, row) => {
      if (!acc[row.descricao]) acc[row.descricao] = 0;
      acc[row.descricao] += row.valor;
      return acc;
    }, {} as Record<string, number>);

    const sorted = Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    setCategoryData(sorted);
  };

  const formatCurrency = (value: number) => {
    return `R$ ${(value / 1000).toFixed(0)}k`;
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
      
      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveChart('evolution')}
          className={`px-4 py-2 font-medium ${activeChart === 'evolution' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Evolução Temporal
        </button>
        <button
          onClick={() => setActiveChart('categories')}
          className={`px-4 py-2 font-medium ${activeChart === 'categories' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}
        >
          <PieChartIcon className="w-4 h-4 inline mr-2" />
          Top Despesas
        </button>
        <button
          onClick={() => setActiveChart('comparison')}
          className={`px-4 py-2 font-medium ${activeChart === 'comparison' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Receitas vs Despesas
        </button>
      </div>

      {/* GRÁFICO: EVOLUÇÃO TEMPORAL */}
      {activeChart === 'evolution' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Evolução Mensal</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Line type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} name="Receitas" />
              <Line type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} name="Despesas" />
              <Line type="monotone" dataKey="margem" stroke="#3b82f6" strokeWidth={2} name="Margem" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* GRÁFICO: TOP DESPESAS */}
      {activeChart === 'categories' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Top 5 Despesas (Anual)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* GRÁFICO: COMPARAÇÃO BARRAS */}
      {activeChart === 'comparison' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Receitas vs Despesas por Mês</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="receitas" fill="#10b981" name="Receitas" />
              <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};