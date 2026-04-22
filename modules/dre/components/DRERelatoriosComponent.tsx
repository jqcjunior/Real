import React, { useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { Printer, FileText, Download } from 'lucide-react';

export const DRERelatoriosComponent: React.FC = () => {
  const [mesInicio, setMesInicio] = useState('2025-01-01');
  const [mesFim, setMesFim] = useState('2025-12-01');
  const [lojasSelecionadas, setLojasSelecionadas] = useState<number[]>([]);
  const [tipoRelatorio, setTipoRelatorio] = useState<'comparativo' | 'evolucao' | 'benchmark'>('comparativo');

  const gerarRelatorioPDF = async () => {
    // Buscar dados
    const { data } = await supabase
      .from('dre_data')
      .select('*')
      .gte('mes_referencia', mesInicio)
      .lte('mes_referencia', mesFim)
      .in('loja_id', lojasSelecionadas.length > 0 ? lojasSelecionadas : [5, 26]);

    if (!data) return;

    // Criar HTML para impressão
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório DRE - ${new Date().toLocaleDateString('pt-BR')}</title>
        <style>
          @media print {
            @page { margin: 2cm; }
            body { font-family: Arial, sans-serif; }
          }
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #4f46e5; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4f46e5; color: white; }
          .receita { color: #10b981; font-weight: bold; }
          .despesa { color: #ef4444; }
          .total { background-color: #f3f4f6; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Relatório DRE - Real Calçados</h1>
        <p><strong>Período:</strong> ${new Date(mesInicio).toLocaleDateString('pt-BR')} a ${new Date(mesFim).toLocaleDateString('pt-BR')}</p>
        <p><strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
        
        <table>
          <thead>
            <tr>
              <th>Loja</th>
              <th>Mês</th>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                <td>${row.loja_id}</td>
                <td>${new Date(row.mes_referencia).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</td>
                <td>${row.descricao}</td>
                <td>${row.type}</td>
                <td class="${row.type === 'RECEITA' ? 'receita' : 'despesa'}">
                  R$ ${row.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Abrir em nova janela para impressão
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          Configurar Relatório
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mês Inicial
            </label>
            <input
              type="month"
              value={mesInicio.substring(0, 7)}
              onChange={(e) => setMesInicio(`${e.target.value}-01`)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mês Final
            </label>
            <input
              type="month"
              value={mesFim.substring(0, 7)}
              onChange={(e) => setMesFim(`${e.target.value}-01`)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Relatório
          </label>
          <select
            value={tipoRelatorio}
            onChange={(e) => setTipoRelatorio(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="comparativo">Comparativo entre Lojas</option>
            <option value="evolucao">Evolução Temporal</option>
            <option value="benchmark">Benchmark de Despesas</option>
          </select>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={gerarRelatorioPDF}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" />
            Gerar e Imprimir
          </button>
          <button
            onClick={gerarRelatorioPDF}
            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            PDF
          </button>
        </div>
      </div>
    </div>
  );
};