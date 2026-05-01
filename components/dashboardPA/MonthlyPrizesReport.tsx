import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { X, Download, TrendingUp, Calendar, Printer, Trophy, Medal, Award } from 'lucide-react';

interface PrizeReportRow {
  semana_numero: number;
  data_inicio: string;
  data_fim: string;
  store_id: string;
  store_name: string;
  total_premiacoes: number;
}

interface StoreMonthlyData {
  store_name: string;
  total_vendas: number;
  pa_medio: number;
  ticket_medio: number;
  qtde_premiados: number;
  total_premiacoes: number;
}

interface MonthlyPrizesReportProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MonthlyPrizesReport: React.FC<MonthlyPrizesReportProps> = ({ isOpen, onClose }) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [reportData, setReportData] = useState<PrizeReportRow[]>([]);
  const [storesData, setStoresData] = useState<StoreMonthlyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estilos de impressão para A4 horizontal
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-styles-monthly-report';
    style.innerHTML = `
      @media print {
        @page {
          size: A4 landscape;
          margin: 15mm 10mm;
        }
        body * {
          visibility: hidden;
        }
        #monthly-report-print, #monthly-report-print * {
          visibility: visible;
        }
        #monthly-report-print {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .no-print {
          display: none !important;
        }
        #monthly-report-print table {
          font-size: 9px !important;
          width: 100%;
        }
        #monthly-report-print th,
        #monthly-report-print td {
          padding: 3px 5px !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      const existingStyle = document.getElementById('print-styles-monthly-report');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Buscar premiações por semana usando a função existente
      const { data: premiacoesData, error: rpcError } = await supabase.rpc('get_monthly_prizes_report', {
        p_month: selectedMonth,
        p_year: selectedYear,
      });

      if (rpcError) throw rpcError;
      setReportData(premiacoesData || []);

      // 2. Buscar semanas do mês para obter week_ids
      const { data: semanasData } = await supabase
        .from('Dashboard_PA_Semanas')
        .select('id, store_id')
        .eq('mes_ref', selectedMonth)
        .eq('ano_ref', selectedYear);

      if (!semanasData || semanasData.length === 0) {
        setStoresData([]);
        return;
      }

      const weekIds = semanasData.map(w => w.id);

      // 3. Buscar vendas do mês
      const { data: vendasData } = await supabase
        .from('Dashboard_PA_Vendas')
        .select('store_id, pa, total_vendas, qtde_vendas')
        .in('semana_id', weekIds);

      // 4. Buscar premiações detalhadas do mês
      const { data: premiosDetailData } = await supabase
        .from('Dashboard_PA_Premiacoes')
        .select('store_id, atingiu_meta')
        .in('semana_id', weekIds);

      // 5. Buscar lojas ativas
      const { data: storesInfo } = await supabase
        .from('stores')
        .select('id, name')
        .eq('status', 'active');

      // 6. Agrupar dados por loja
      const storesMap = new Map<string, StoreMonthlyData>();

      storesInfo?.forEach(store => {
        const storeVendas = vendasData?.filter(v => v.store_id === store.id) || [];
        const storePremios = premiosDetailData?.filter(p => p.store_id === store.id) || [];
        const storePremiacoes = premiacoesData?.filter((p: PrizeReportRow) => p.store_id === store.id) || [];

        const totalVendas = storeVendas.reduce((sum, v) => sum + (v.total_vendas || 0), 0);
        const totalQtdeVendas = storeVendas.reduce((sum, v) => sum + (v.qtde_vendas || 0), 0);
        
        // PA médio = média aritmética dos PAs de todos os vendedores
        const paMedio = storeVendas.length > 0 
          ? storeVendas.reduce((sum, v) => sum + (v.pa || 0), 0) / storeVendas.length 
          : 0;
        
        // Ticket médio = total vendas / total qtde vendas
        const ticketMedio = totalQtdeVendas > 0 ? totalVendas / totalQtdeVendas : 0;
        
        // Quantidade de vendedores que atingiram a meta
        const qtdePremiados = storePremios.filter(p => p.atingiu_meta).length;
        
        // Total de premiações pagas (soma das semanas)
        const totalPremiacoes = storePremiacoes.reduce((sum, p) => sum + p.total_premiacoes, 0);

        storesMap.set(store.id, {
          store_name: store.name,
          total_vendas: totalVendas,
          pa_medio: paMedio,
          ticket_medio: ticketMedio,
          qtde_premiados: qtdePremiados,
          total_premiacoes: totalPremiacoes,
        });
      });

      const storesArray = Array.from(storesMap.values());
      setStoresData(storesArray);

    } catch (err: any) {
      console.error('Erro ao buscar relatório:', err);
      setError(err.message || 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen, selectedMonth, selectedYear]);

  if (!isOpen) return null;

  // Rankings
  const rankByPA = [...storesData].sort((a, b) => b.pa_medio - a.pa_medio);
  const rankByVendas = [...storesData].sort((a, b) => b.total_vendas - a.total_vendas);
  const rankByTicket = [...storesData].sort((a, b) => b.ticket_medio - a.ticket_medio);
  const rankByPremiados = [...storesData].sort((a, b) => b.qtde_premiados - a.qtde_premiados);
  const rankByTotal = [...storesData].sort((a, b) => b.total_premiacoes - a.total_premiacoes);

  const getRankPosition = (storeName: string, ranking: StoreMonthlyData[]) => {
    return ranking.findIndex(s => s.store_name === storeName) + 1;
  };

  const getMedalIcon = (position: number) => {
    if (position === 1) return <Trophy className="w-4 h-4 text-yellow-500 inline" />;
    if (position === 2) return <Medal className="w-4 h-4 text-gray-400 inline" />;
    if (position === 3) return <Award className="w-4 h-4 text-orange-600 inline" />;
    return null;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    return value.toFixed(decimals);
  };

  const exportToCSV = () => {
    const headers = ['Ranking', 'Loja', 'P.A', 'Rank PA', 'Vendas (R$)', 'Rank Vendas', 'Ticket (R$)', 'Rank Ticket', 'Premiados', 'Rank Premiados', 'Total Pago', 'Rank Total'];
    
    const rows = rankByTotal.map((store, index) => {
      const rankPA = getRankPosition(store.store_name, rankByPA);
      const rankVendas = getRankPosition(store.store_name, rankByVendas);
      const rankTicket = getRankPosition(store.store_name, rankByTicket);
      const rankPremiados = getRankPosition(store.store_name, rankByPremiados);
      
      return [
        index + 1,
        store.store_name,
        store.pa_medio.toFixed(2),
        rankPA,
        store.total_vendas.toFixed(2),
        rankVendas,
        store.ticket_medio.toFixed(2),
        rankTicket,
        store.qtde_premiados,
        rankPremiados,
        store.total_premiacoes.toFixed(2),
        index + 1
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ranking_premiacoes_${months.find(m => m.value === selectedMonth)?.label}_${selectedYear}.csv`;
    link.click();
  };

  const handlePrint = () => {
    const printContent = document.getElementById('monthly-report-print');
    if (!printContent) {
      alert('Não foi possível encontrar o conteúdo para impressão.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-ups bloqueados! Por favor, permita pop-ups para este site e tente novamente.');
      return;
    }

    const monthLabel = months.find(m => m.value === selectedMonth)?.label;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Ranking Mensal - ${monthLabel}/${selectedYear}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
              font-family: 'Inter', sans-serif;
            }

            @page {
              size: A4 landscape;
              margin: 10mm;
            }

            body {
              background: white;
              margin: 0;
              padding: 0;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px !important;
            }

            th, td {
              border: 1px solid #e2e8f0 !important;
              padding: 4px 6px !important;
            }

            .bg-orange-50 { background-color: #fffaf0 !important; }
            .bg-orange-100 { background-color: #ffedd5 !important; }
            .bg-red-100 { background-color: #fee2e2 !important; }
            .text-orange-600 { color: #ea580c !important; }
            .text-orange-800 { color: #9a3412 !important; }
            .text-blue-700 { color: #1d4ed8 !important; }
            .text-green-700 { color: #15803d !important; }
            .text-purple-700 { color: #7e22ce !important; }
            .text-amber-700 { color: #b45309 !important; }
            
            .font-black { font-weight: 900 !important; }
            .font-bold { font-weight: 700 !important; }
            
            .hidden.print\\:block { display: block !important; }
            .no-print { display: none !important; }
          </style>
        </head>
        <body class="bg-white p-4">
          <div class="w-full">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.focus();
                window.print();
                window.onafterprint = () => window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print">
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold uppercase italic">Ranking Mensal de Premiações</h2>
              <p className="text-orange-100 text-xs font-bold">Dashboard PA - Classificação por Desempenho</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros */}
        <div className="p-3 border-b bg-gray-50 flex gap-3 items-center flex-wrap no-print">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="font-bold text-gray-700 text-sm uppercase">Período:</span>
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-1.5 text-sm font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 text-sm font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <div className="ml-auto flex gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || storesData.length === 0}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors uppercase"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={exportToCSV}
              disabled={loading || storesData.length === 0}
              className="px-3 py-1.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors uppercase"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto p-4" id="monthly-report-print">
          {/* Cabeçalho para impressão */}
          <div className="hidden print:block mb-4">
            <h1 className="text-center font-black text-xl uppercase italic">RANKING MENSAL DE PREMIAÇÕES - DASHBOARD PA</h1>
            <p className="text-center text-sm font-bold uppercase">
              {months.find(m => m.value === selectedMonth)?.label} / {selectedYear}
            </p>
            <p className="text-center text-xs text-gray-600 mb-2">
              Gerado em: {new Date().toLocaleString('pt-BR')}
            </p>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-600 border-t-transparent"></div>
              <p className="mt-4 text-gray-600 font-bold">Carregando relatório...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              <strong>Erro:</strong> {error}
            </div>
          )}

          {!loading && !error && storesData.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-bold">Nenhum dado encontrado para este período</p>
            </div>
          )}

          {!loading && !error && storesData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-orange-100 to-red-100">
                    <th className="border-2 border-orange-300 px-3 py-2 text-center font-black text-gray-800 uppercase">
                      Rank
                    </th>
                    <th className="border-2 border-orange-300 px-3 py-2 text-left font-black text-gray-800 uppercase">
                      Loja
                    </th>
                    <th className="border-2 border-orange-300 px-3 py-2 text-center font-black text-gray-800 uppercase">
                      P.A
                    </th>
                    <th className="border-2 border-orange-300 px-3 py-2 text-center font-black text-gray-800 uppercase text-[10px]">
                      Rank<br/>P.A
                    </th>
                    <th className="border-2 border-orange-300 px-3 py-2 text-right font-black text-gray-800 uppercase">
                      Vendas
                    </th>
                    <th className="border-2 border-orange-300 px-3 py-2 text-center font-black text-gray-800 uppercase text-[10px]">
                      Rank<br/>Vendas
                    </th>
                    <th className="border-2 border-orange-300 px-3 py-2 text-right font-black text-gray-800 uppercase">
                      Ticket
                    </th>
                    <th className="border-2 border-orange-300 px-3 py-2 text-center font-black text-gray-800 uppercase text-[10px]">
                      Rank<br/>Ticket
                    </th>
                    <th className="border-2 border-orange-300 px-3 py-2 text-center font-black text-gray-800 uppercase text-[10px]">
                      Qtd<br/>Premiados
                    </th>
                    <th className="border-2 border-orange-300 px-3 py-2 text-center font-black text-gray-800 uppercase text-[10px]">
                      Rank<br/>Premiados
                    </th>
                    <th className="border-2 border-orange-300 px-3 py-2 text-right font-black text-orange-800 uppercase bg-orange-50">
                      Total Pago
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rankByTotal.map((store, index) => {
                    const rankPA = getRankPosition(store.store_name, rankByPA);
                    const rankVendas = getRankPosition(store.store_name, rankByVendas);
                    const rankTicket = getRankPosition(store.store_name, rankByTicket);
                    const rankPremiados = getRankPosition(store.store_name, rankByPremiados);
                    const position = index + 1;
                    const rowBg = position <= 3 ? 'bg-gradient-to-r from-orange-50 to-red-50' : 'hover:bg-gray-50';

                    return (
                      <tr key={store.store_name} className={rowBg}>
                        <td className="border border-gray-300 px-3 py-2 text-center font-black text-lg">
                          <div className="flex items-center justify-center gap-1">
                            {getMedalIcon(position)}
                            <span className={position <= 3 ? 'text-orange-600' : 'text-gray-600'}>
                              {position}º
                            </span>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 font-bold text-gray-900">
                          {store.store_name}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center font-bold text-blue-700">
                          {formatNumber(store.pa_medio)}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getMedalIcon(rankPA)}
                            <span className="font-bold text-gray-600 text-[11px]">{rankPA}º</span>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right font-bold text-green-700">
                          {formatCurrency(store.total_vendas)}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getMedalIcon(rankVendas)}
                            <span className="font-bold text-gray-600 text-[11px]">{rankVendas}º</span>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right font-bold text-purple-700">
                          {formatCurrency(store.ticket_medio)}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getMedalIcon(rankTicket)}
                            <span className="font-bold text-gray-600 text-[11px]">{rankTicket}º</span>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center font-bold text-amber-700">
                          {store.qtde_premiados}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getMedalIcon(rankPremiados)}
                            <span className="font-bold text-gray-600 text-[11px]">{rankPremiados}º</span>
                          </div>
                        </td>
                        <td className="border-2 border-orange-300 px-3 py-2 text-right font-black text-orange-800 bg-orange-50">
                          {formatCurrency(store.total_premiacoes)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && !error && storesData.length > 0 && (
          <div className="border-t p-3 bg-gradient-to-r from-orange-50 to-red-50 text-xs no-print">
            <p className="font-bold text-gray-700 text-center uppercase">
              🏆 = 1º Lugar • 🥈 = 2º Lugar • 🥉 = 3º Lugar | Ranking Total ordenado por "Total Pago"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};