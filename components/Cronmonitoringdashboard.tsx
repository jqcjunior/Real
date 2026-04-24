import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

interface CronLog {
  id: string;
  job_name: string;
  execution_time: string;
  total_aplicado: number;
  valor_total: number;
  success: boolean;
  error_message: string | null;
  execution_duration_ms: number;
}

interface DailyStats {
  dia: string;
  total_execucoes: number;
  total_abatimentos: number;
  valor_total_abatido: number;
  execucoes_sucesso: number;
  execucoes_erro: number;
  tempo_medio_ms: number;
}

interface PendingPayment {
  vencimento_data: string;
  store_number: string;
  qtd_abatimentos: number;
  valor_total: number;
  urgencia: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function CronMonitoringDashboard({ user }: { user: any }) {
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';

  const [lastExecution, setLastExecution] = useState<CronLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<CronLog[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Verificar permissão
  if (!isAdmin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Acesso restrito. Apenas administradores podem visualizar o monitoramento.</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARREGAR DADOS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    loadAllData();
  }, []);

  // Auto-refresh a cada 5 minutos
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadAllData();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadLastExecution(),
        loadRecentLogs(),
        loadDailyStats(),
        loadPendingPayments()
      ]);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLastExecution = async () => {
    const { data } = await supabase
      .from('buyorder_cron_logs')
      .select('*')
      .order('execution_time', { ascending: false })
      .limit(1)
      .single();

    setLastExecution(data);
  };

  const loadRecentLogs = async () => {
    const { data } = await supabase
      .from('buyorder_cron_logs')
      .select('*')
      .order('execution_time', { ascending: false })
      .limit(20);

    setRecentLogs(data || []);
  };

  const loadDailyStats = async () => {
    const { data } = await supabase
      .from('v_cron_statistics')
      .select('*')
      .order('dia', { ascending: false })
      .limit(30);

    setDailyStats(data || []);
  };

  const loadPendingPayments = async () => {
    // Query customizada para próximos vencimentos
    const { data } = await supabase.rpc('get_pending_payments', {
      days_ahead: 30
    });

    setPendingPayments(data || []);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getPerformanceColor = (ms: number) => {
    if (ms < 1000) return '#97C459'; // Verde
    if (ms < 5000) return '#FAC775'; // Amarelo
    return '#F09595'; // Vermelho
  };

  const getUrgencyColor = (urgencia: string) => {
    if (urgencia.includes('Hoje')) return '#F09595';
    if (urgencia.includes('Amanhã')) return '#FAC775';
    if (urgencia.includes('Esta semana')) return '#97C459';
    return '#D3D1C7';
  };

  const getTimeSince = (dateStr: string) => {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `há ${days} dia${days > 1 ? 's' : ''}`;
    }
    if (diffHours > 0) {
      return `há ${diffHours}h ${diffMinutes}min`;
    }
    return `há ${diffMinutes} minutos`;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading && !lastExecution) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Carregando monitoramento...</p>
      </div>
    );
  }

  return (
    <div className="cron-monitoring-dashboard">
      {/* Header */}
      <div className="header">
        <div>
          <h1>📊 Monitoramento - Abatimentos Automáticos</h1>
          <p>Acompanhe as execuções do pg_cron em tempo real</p>
        </div>
        <div className="header-actions">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-atualizar (5 min)
          </label>
          <button onClick={loadAllData} className="btn-refresh">
            🔄 Atualizar
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="summary-cards">
        {/* Última Execução */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">⏱️</span>
            <h3>Última Execução</h3>
          </div>
          {lastExecution ? (
            <div className="card-content">
              <div className="big-number">
                {getTimeSince(lastExecution.execution_time)}
              </div>
              <div className="card-details">
                <div className="detail-row">
                  <span>Horário:</span>
                  <span>{formatDate(lastExecution.execution_time)}</span>
                </div>
                <div className="detail-row">
                  <span>Abatimentos:</span>
                  <span className="highlight">{lastExecution.total_aplicado}</span>
                </div>
                <div className="detail-row">
                  <span>Valor Total:</span>
                  <span className="highlight">{formatMoney(lastExecution.valor_total)}</span>
                </div>
                <div className="detail-row">
                  <span>Performance:</span>
                  <span 
                    className="performance-badge"
                    style={{ background: getPerformanceColor(lastExecution.execution_duration_ms) }}
                  >
                    {lastExecution.execution_duration_ms}ms
                  </span>
                </div>
                <div className="detail-row">
                  <span>Status:</span>
                  <span className={lastExecution.success ? 'status-success' : 'status-error'}>
                    {lastExecution.success ? '✅ Sucesso' : '❌ Erro'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="empty">Nenhuma execução registrada</p>
          )}
        </div>

        {/* Estatísticas do Mês */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">📈</span>
            <h3>Este Mês</h3>
          </div>
          <div className="card-content">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">
                  {dailyStats.reduce((sum, d) => sum + d.total_abatimentos, 0)}
                </div>
                <div className="stat-label">Total de Abatimentos</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {formatMoney(dailyStats.reduce((sum, d) => sum + d.valor_total_abatido, 0))}
                </div>
                <div className="stat-label">Valor Total</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {dailyStats.reduce((sum, d) => sum + d.execucoes_sucesso, 0)}
                </div>
                <div className="stat-label">Execuções OK</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {dailyStats.reduce((sum, d) => sum + d.execucoes_erro, 0)}
                </div>
                <div className="stat-label">Erros</div>
              </div>
            </div>
          </div>
        </div>

        {/* Próximos Vencimentos */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">📅</span>
            <h3>Próximos Vencimentos</h3>
          </div>
          <div className="card-content">
            {pendingPayments.length > 0 ? (
              <div className="pending-list">
                {pendingPayments.slice(0, 5).map((p, idx) => (
                  <div key={idx} className="pending-item">
                    <div 
                      className="urgency-dot"
                      style={{ background: getUrgencyColor(p.urgencia) }}
                    />
                    <div className="pending-info">
                      <div className="pending-date">
                        {new Date(p.vencimento_data).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="pending-value">
                        {formatMoney(p.valor_total)} ({p.qtd_abatimentos} abatimentos)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty">Nenhum vencimento próximo</p>
            )}
          </div>
        </div>
      </div>

      {/* Histórico de Execuções */}
      <div className="history-section">
        <h2>📜 Histórico de Execuções (Últimas 20)</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Abatimentos</th>
                <th>Valor Total</th>
                <th>Performance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map(log => (
                <tr key={log.id}>
                  <td>{formatDate(log.execution_time)}</td>
                  <td className="text-center">{log.total_aplicado}</td>
                  <td className="text-right">{formatMoney(log.valor_total)}</td>
                  <td className="text-center">
                    <span 
                      className="performance-badge"
                      style={{ background: getPerformanceColor(log.execution_duration_ms) }}
                    >
                      {log.execution_duration_ms}ms
                    </span>
                  </td>
                  <td className="text-center">
                    {log.success ? (
                      <span className="status-success">✅</span>
                    ) : (
                      <span className="status-error" title={log.error_message || ''}>
                        ❌
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estatísticas Diárias */}
      <div className="daily-stats-section">
        <h2>📊 Estatísticas Diárias (Últimos 30 Dias)</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Execuções</th>
                <th>Abatimentos</th>
                <th>Valor Total</th>
                <th>Tempo Médio</th>
                <th>Erros</th>
              </tr>
            </thead>
            <tbody>
              {dailyStats.map((stat, idx) => (
                <tr key={idx}>
                  <td>{new Date(stat.dia).toLocaleDateString('pt-BR')}</td>
                  <td className="text-center">{stat.total_execucoes}</td>
                  <td className="text-center">{stat.total_abatimentos}</td>
                  <td className="text-right">{formatMoney(stat.valor_total_abatido)}</td>
                  <td className="text-center">
                    <span 
                      className="performance-badge"
                      style={{ background: getPerformanceColor(stat.tempo_medio_ms) }}
                    >
                      {stat.tempo_medio_ms}ms
                    </span>
                  </td>
                  <td className="text-center">
                    {stat.execucoes_erro > 0 ? (
                      <span className="error-count">{stat.execucoes_erro}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .cron-monitoring-dashboard {
          max-width: 1400px;
          margin: 0 auto;
          padding-bottom: 2rem;
        }

        .header {
          background: linear-gradient(135deg, #185FA5 0%, #378ADD 100%);
          color: white;
          padding: 2rem;
          border-radius: 12px 12px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
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

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .auto-refresh-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          cursor: pointer;
        }

        .btn-refresh {
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        }

        .btn-refresh:hover {
          background: rgba(255,255,255,0.3);
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
          padding: 1.5rem;
          background: #F8F8F8;
        }

        .card {
          background: white;
          border: 0.5px solid #E6E6E6;
          border-radius: 12px;
          overflow: hidden;
        }

        .card-header {
          background: #F8F8F8;
          padding: 1rem 1.5rem;
          border-bottom: 0.5px solid #E6E6E6;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .card-icon {
          font-size: 24px;
        }

        .card-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
        }

        .card-content {
          padding: 1.5rem;
        }

        .big-number {
          font-size: 32px;
          font-weight: 500;
          color: #378ADD;
          margin-bottom: 1rem;
        }

        .card-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .detail-row span:first-child {
          color: #888780;
        }

        .highlight {
          font-weight: 500;
          color: #0F6E56;
        }

        .performance-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          color: white;
        }

        .status-success {
          color: #97C459;
          font-weight: 500;
        }

        .status-error {
          color: #F09595;
          font-weight: 500;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 500;
          color: #378ADD;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 11px;
          color: #888780;
        }

        .pending-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .pending-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
          background: #F8F8F8;
          border-radius: 6px;
        }

        .urgency-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .pending-info {
          flex: 1;
        }

        .pending-date {
          font-size: 13px;
          font-weight: 500;
        }

        .pending-value {
          font-size: 11px;
          color: #888780;
        }

        .empty {
          text-align: center;
          color: #888780;
          padding: 2rem;
          font-size: 13px;
        }

        .history-section,
        .daily-stats-section {
          background: white;
          margin: 1.5rem;
          padding: 1.5rem;
          border-radius: 12px;
          border: 0.5px solid #E6E6E6;
        }

        .history-section h2,
        .daily-stats-section h2 {
          margin: 0 0 1rem;
          font-size: 16px;
          font-weight: 500;
        }

        .table-container {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        thead {
          background: #F8F8F8;
        }

        th {
          padding: 12px;
          text-align: left;
          font-weight: 500;
          border-bottom: 0.5px solid #E6E6E6;
        }

        td {
          padding: 12px;
          border-bottom: 0.5px solid #F1EFE8;
        }

        .text-center {
          text-align: center;
        }

        .text-right {
          text-align: right;
        }

        .text-muted {
          color: #D3D1C7;
        }

        .error-count {
          background: #FCEBEB;
          color: #A32D2D;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}