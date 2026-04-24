import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

interface QuotaReportData {
  periodo: {
    year: number;
    month: number;
    mes_nome: string;
    periodo_completo: string;
  };
  resumo_geral: {
    total_lojas: number;
    cota_total_inicial: number;
    cota_total_utilizada: number;
    cota_total_disponivel: number;
    percentual_medio: number;
    lojas_ok: number;
    lojas_atencao: number;
    lojas_critico: number;
  };
  por_loja: any[];
  alertas_criticos: any[];
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function ReportsGenerator({ user }: { user: any }) {
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);

  if (!isAdmin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Acesso restrito. Apenas administradores podem gerar relatórios.</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GERAR EXCEL - RELATÓRIO DE COTAS
  // ═══════════════════════════════════════════════════════════════════════════

  const generateQuotaExcel = async () => {
    setLoading(true);
    try {
      // 1. Buscar dados via RPC
      const { data, error } = await supabase.rpc('generate_quota_report', {
        p_year: selectedYear,
        p_month: selectedMonth
      });

      if (error) throw error;
      if (!data) throw new Error('Sem dados para o período selecionado');

      const reportData: QuotaReportData = data;

      // 2. Criar workbook
      const wb = XLSX.utils.book_new();

      // 3. ABA 1: Resumo Geral
      const resumoData = [
        ['RELATÓRIO DE COTAS OTB - ' + reportData.periodo.periodo_completo],
        [],
        ['RESUMO GERAL'],
        ['Total de Lojas', reportData.resumo_geral.total_lojas],
        ['Cota Total Inicial', `R$ ${reportData.resumo_geral.cota_total_inicial.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`],
        ['Cota Total Utilizada', `R$ ${reportData.resumo_geral.cota_total_utilizada.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`],
        ['Cota Total Disponível', `R$ ${reportData.resumo_geral.cota_total_disponivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`],
        ['Percentual Médio', `${reportData.resumo_geral.percentual_medio}%`],
        [],
        ['DISTRIBUIÇÃO POR STATUS'],
        ['Lojas OK', reportData.resumo_geral.lojas_ok],
        ['Lojas em Atenção', reportData.resumo_geral.lojas_atencao],
        ['Lojas Críticas', reportData.resumo_geral.lojas_critico]
      ];
      
      const resumoWs = XLSX.utils.aoa_to_sheet(resumoData);
      
      // Larguras das colunas
      resumoWs['!cols'] = [
        { wch: 30 },
        { wch: 20 }
      ];
      
      XLSX.utils.book_append_sheet(wb, resumoWs, 'Resumo');

      // 4. ABA 2: Detalhamento por Loja
      if (reportData.por_loja && reportData.por_loja.length > 0) {
        const lojasFormatted = reportData.por_loja.map(loja => ({
          'Loja': loja.store_number,
          'Nome': loja.store_name,
          'Cidade': loja.city,
          'Cota Inicial': loja.cota_inicial,
          'Cota Utilizada': loja.cota_utilizada,
          'Cota Disponível': loja.cota_disponivel,
          '% Utilizado': loja.percentual_utilizado,
          'Status': loja.status,
          'Gerente Inicial': loja.gerente_inicial,
          'Gerente Utilizada': loja.gerente_utilizada,
          'Gerente %': loja.gerente_pct,
          'Comprador Inicial': loja.comprador_inicial,
          'Comprador Utilizada': loja.comprador_utilizada,
          'Comprador %': loja.comprador_pct,
          'Alertas': loja.alertas_ativos
        }));

        const lojasWs = XLSX.utils.json_to_sheet(lojasFormatted);
        
        // Larguras das colunas
        lojasWs['!cols'] = [
          { wch: 6 },  // Loja
          { wch: 25 }, // Nome
          { wch: 15 }, // Cidade
          { wch: 12 }, // Cota Inicial
          { wch: 12 }, // Cota Utilizada
          { wch: 12 }, // Cota Disponível
          { wch: 10 }, // % Utilizado
          { wch: 12 }, // Status
          { wch: 12 }, // Gerente Inicial
          { wch: 12 }, // Gerente Utilizada
          { wch: 10 }, // Gerente %
          { wch: 12 }, // Comprador Inicial
          { wch: 12 }, // Comprador Utilizada
          { wch: 10 }, // Comprador %
          { wch: 8 }   // Alertas
        ];
        
        XLSX.utils.book_append_sheet(wb, lojasWs, 'Por Loja');
      }

      // 5. ABA 3: Alertas Críticos
      if (reportData.alertas_criticos && reportData.alertas_criticos.length > 0) {
        const alertasFormatted = reportData.alertas_criticos.map(alerta => ({
          'Loja': alerta.store_number,
          'Nome': alerta.store_name,
          'Tipo': alerta.tipo_comprador,
          'Nível': alerta.nivel,
          '% Utilizado': alerta.percentual
        }));

        const alertasWs = XLSX.utils.json_to_sheet(alertasFormatted);
        
        alertasWs['!cols'] = [
          { wch: 6 },
          { wch: 25 },
          { wch: 12 },
          { wch: 15 },
          { wch: 12 }
        ];
        
        XLSX.utils.book_append_sheet(wb, alertasWs, 'Alertas Críticos');
      }

      // 6. Gerar e baixar arquivo
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      saveAs(blob, `Relatorio_Cotas_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`);

      alert('✅ Relatório Excel gerado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar Excel:', err);
      alert('❌ Erro ao gerar relatório: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // GERAR EXCEL - RELATÓRIO DE MONITORAMENTO CRON
  // ═══════════════════════════════════════════════════════════════════════════

  const generateCronExcel = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('generate_cron_report', {
        p_year: selectedYear,
        p_month: selectedMonth
      });

      if (error) throw error;
      if (!data) throw new Error('Sem dados para o período selecionado');

      const wb = XLSX.utils.book_new();

      // ABA 1: Resumo
      const resumoData = [
        ['RELATÓRIO DE MONITORAMENTO - ' + data.periodo.mes_nome],
        [],
        ['RESUMO DO MÊS'],
        ['Total de Execuções', data.resumo.total_execucoes],
        ['Execuções com Sucesso', data.resumo.execucoes_sucesso],
        ['Execuções com Erro', data.resumo.execucoes_erro],
        ['Total de Abatimentos', data.resumo.total_abatimentos],
        ['Valor Total Abatido', `R$ ${data.resumo.valor_total?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}`],
        ['Tempo Médio (ms)', data.resumo.tempo_medio_ms],
        ['Tempo Máximo (ms)', data.resumo.tempo_max_ms],
        ['Tempo Mínimo (ms)', data.resumo.tempo_min_ms]
      ];

      const resumoWs = XLSX.utils.aoa_to_sheet(resumoData);
      resumoWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, resumoWs, 'Resumo');

      // ABA 2: Execuções
      if (data.execucoes && data.execucoes.length > 0) {
        const execucoesFormatted = data.execucoes.map((exec: any) => ({
          'Data/Hora': new Date(exec.execution_time).toLocaleString('pt-BR'),
          'Abatimentos': exec.total_aplicado,
          'Valor Total': exec.valor_total,
          'Sucesso': exec.success ? 'Sim' : 'Não',
          'Erro': exec.error_message || '-',
          'Tempo (ms)': exec.execution_duration_ms
        }));

        const execWs = XLSX.utils.json_to_sheet(execucoesFormatted);
        execWs['!cols'] = [
          { wch: 18 },
          { wch: 12 },
          { wch: 15 },
          { wch: 8 },
          { wch: 40 },
          { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(wb, execWs, 'Execuções');
      }

      // ABA 3: Por Loja
      if (data.por_loja && data.por_loja.length > 0) {
        const lojasFormatted = data.por_loja.map((loja: any) => ({
          'Loja': loja.store_number,
          'Nome': loja.store_name,
          'Total Abatido': loja.total_abatido,
          'Quantidade': loja.qtd_abatimentos,
          'Gerente': loja.gerente_abatido,
          'Comprador': loja.comprador_abatido,
          'Futuro Agendado': loja.futuro_agendado
        }));

        const lojasWs = XLSX.utils.json_to_sheet(lojasFormatted);
        lojasWs['!cols'] = [
          { wch: 6 },
          { wch: 25 },
          { wch: 15 },
          { wch: 12 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, lojasWs, 'Por Loja');
      }

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      saveAs(blob, `Relatorio_Monitoramento_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`);

      alert('✅ Relatório de Monitoramento gerado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar Excel:', err);
      alert('❌ Erro ao gerar relatório: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="reports-generator">
      {/* Header */}
      <div className="header">
        <h1>📊 Gerador de Relatórios</h1>
        <p>Exporte dados consolidados em formato Excel</p>
      </div>

      {/* Seletor de Período */}
      <div className="period-selector">
        <div className="selector-group">
          <label>Período:</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {monthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>{name}</option>
            ))}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>
      </div>

      {/* Cards de Relatórios */}
      <div className="reports-grid">
        {/* Relatório de Cotas */}
        <div className="report-card">
          <div className="card-icon">📊</div>
          <h3>Relatório de Cotas OTB</h3>
          <p>Visão completa das cotas por loja com divisão Gerente/Comprador</p>
          <ul className="features">
            <li>✓ Resumo geral do período</li>
            <li>✓ Detalhamento por loja</li>
            <li>✓ Divisão Gerente/Comprador</li>
            <li>✓ Alertas críticos destacados</li>
          </ul>
          <button
            className="btn-generate"
            onClick={generateQuotaExcel}
            disabled={loading}
          >
            {loading ? '⏳ Gerando...' : '📥 Gerar Excel'}
          </button>
        </div>

        {/* Relatório de Monitoramento */}
        <div className="report-card">
          <div className="card-icon">🤖</div>
          <h3>Monitoramento Automático</h3>
          <p>Histórico completo de execuções do pg_cron e abatimentos</p>
          <ul className="features">
            <li>✓ Resumo de execuções</li>
            <li>✓ Performance detalhada</li>
            <li>✓ Abatimentos por loja</li>
            <li>✓ Taxa de sucesso/erro</li>
          </ul>
          <button
            className="btn-generate"
            onClick={generateCronExcel}
            disabled={loading}
          >
            {loading ? '⏳ Gerando...' : '📥 Gerar Excel'}
          </button>
        </div>
      </div>

      <style>{`
        .reports-generator {
          max-width: 1200px;
          margin: 0 auto;
        }

        .header {
          background: linear-gradient(135deg, #185FA5 0%, #378ADD 100%);
          color: white;
          padding: 2rem;
          border-radius: 12px 12px 0 0;
        }

        .header h1 {
          margin: 0 0 0.5rem;
          font-size: 24px;
          font-weight: 500;
        }

        .header p {
          margin: 0;
          opacity: 0.9;
          font-size: 13px;
        }

        .period-selector {
          background: white;
          padding: 1.5rem;
          border-bottom: 0.5px solid #E6E6E6;
        }

        .selector-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .selector-group label {
          font-size: 14px;
          font-weight: 500;
        }

        .selector-group select {
          padding: 8px 12px;
          border: 0.5px solid #D3D1C7;
          border-radius: 6px;
          font-size: 14px;
        }

        .reports-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1.5rem;
          padding: 1.5rem;
          background: #F8F8F8;
        }

        .report-card {
          background: white;
          border: 0.5px solid #E6E6E6;
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
        }

        .card-icon {
          font-size: 48px;
          text-align: center;
          margin-bottom: 1rem;
        }

        .report-card h3 {
          margin: 0 0 0.5rem;
          font-size: 18px;
          font-weight: 500;
        }

        .report-card p {
          margin: 0 0 1rem;
          font-size: 13px;
          color: #888780;
          line-height: 1.5;
        }

        .features {
          list-style: none;
          padding: 0;
          margin: 0 0 1.5rem;
          flex: 1;
        }

        .features li {
          font-size: 13px;
          color: #888780;
          padding: 4px 0;
        }

        .btn-generate {
          background: #0F6E56;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-generate:hover:not(:disabled) {
          background: #0D5A46;
        }

        .btn-generate:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
