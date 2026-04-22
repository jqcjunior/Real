import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import { Download, Filter } from 'lucide-react';

interface TabelaComparativaData {
  grupo: string;
  descricao: string;
  lojas: Record<number, number>; // loja_id -> valor
}

export const DRETabelaComparativaComponent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TabelaComparativaData[]>([]);
  const [lojas, setLojas] = useState<number[]>([]);
  const [mesReferencia, setMesReferencia] = useState('2025-01-01');
  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | 'RECEITA' | 'DESPESA'>('DESPESA');

  useEffect(() => {
    loadData();
  }, [mesReferencia, tipoFiltro]);

  const loadData = async () => {
    setLoading(true);

    // Buscar lojas únicas
    const { data: lojasData } = await supabase
      .from('dre_data')
      .select('loja_id')
      .eq('mes_referencia', mesReferencia);

    if (lojasData) {
      const lojasUnicas = Array.from(new Set(lojasData.map(d => d.loja_id))).sort((a, b) => a - b);
      setLojas(lojasUnicas);
    }

    // Buscar dados
    let query = supabase
      .from('dre_data')
      .select('descricao, loja_id, valor, type, grupo')
      .eq('mes_referencia', mesReferencia);

    if (tipoFiltro !== 'TODOS') {
      query = query.eq('type', tipoFiltro);
    }

    const { data: dreData } = await query;

    if (!dreData) {
      setLoading(false);
      return;
    }

    // Agrupar por descrição
    const grouped = dreData.reduce((acc, row) => {
      if (!acc[row.descricao]) {
        acc[row.descricao] = {
          grupo: row.grupo || '-',
          descricao: row.descricao,
          lojas: {}
        };
      }
      acc[row.descricao].lojas[row.loja_id] = row.valor;
      return acc;
    }, {} as Record<string, TabelaComparativaData>);

    setData(Object.values(grouped));
    setLoading(false);
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  const exportToExcel = () => {
    // Preparar CSV
    const headers = ['Grupo', 'Descrição', ...lojas.map(l => `Loja ${l}`)];
    const rows = data.map(row => [
      row.grupo,
      row.descricao,
      ...lojas.map(l => row.lojas[l] || 0)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dre_comparativo_${mesReferencia}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      
      {/* FILTROS */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mês de Referência
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

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Filter className="w-4 h-4 inline mr-1" />
            Tipo
          </label>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="TODOS">Todos</option>
            <option value="RECEITA">Receitas</option>
            <option value="DESPESA">Despesas</option>
          </select>
        </div>

        <div className="pt-6">
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* TABELA COMPARATIVA */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                  Grupo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 sticky left-[120px] bg-gray-50 z-10">
                  Descrição
                </th>
                {lojas.map(loja => (
                  <th
                    key={loja}
                    className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200"
                  >
                    Loja {loja}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100 sticky left-0 bg-white">
                    {row.grupo}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-100 sticky left-[120px] bg-white">
                    {row.descricao}
                  </td>
                  {lojas.map(loja => {
                    const valor = row.lojas[loja];
                    const temValor = valor !== undefined && valor !== 0;
                    return (
                      <td
                        key={loja}
                        className={`px-4 py-3 text-center border-r border-gray-100 ${
                          temValor ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-400'
                        }`}
                      >
                        {temValor ? formatCurrency(valor) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            Nenhum dado disponível para o período selecionado
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-gray-500">
            Carregando...
          </div>
        )}
      </div>
    </div>
  );
};