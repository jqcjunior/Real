import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import BuyOrderModule from './BuyOrderModule';
import BuyOrderParams from './BuyOrderParams';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

interface BuyOrderParams {
  feminino_pct: number;
  infantil_menina_pct: number;
  infantil_menino_pct: number;
  masculino_pct: number;
  acessorio_pct: number;
  sub_metas: Record<string, { pct: number; categories: string[] }>;
  cota_default: number;
}

interface StoreAnalysis {
  store_number: string;
  store_name: string;
  city: string;
  total_pares: number;
  feminino_qtd: number;
  feminino_pct: number;
  inf_menina_qtd: number;
  inf_menina_pct: number;
  inf_menino_qtd: number;
  inf_menino_pct: number;
  masculino_qtd: number;
  masculino_pct: number;
  acessorio_qtd: number;
  acessorio_pct: number;
  feminino_tenis_pct: number;
  masculino_tenis_pct: number;
  inf_menina_tenis_pct: number;
  inf_menino_tenis_pct: number;
  cota_inicial: number;
  cota_utilizada: number;
  cota_disponivel: number;
  cota_gerente_inicial: number;
  cota_gerente_utilizada: number;
  cota_gerente_disponivel: number;
  cota_comprador_inicial: number;
  cota_comprador_utilizada: number;
  cota_comprador_disponivel: number;
  comprometido_futuro_comprador: number;
  comprometido_futuro_gerente: number;
  percentual_utilizado: number;
  status: string;
}

type TabType = 'analise' | 'novo_pedido' | 'pedidos_comprador' | 'pedidos_loja' | 'parametros';
type PeriodType = 'mensal' | 'semestral' | 'anual';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function BuyOrderDashboard({ user }: { user: any }) {
  const isAdmin = user?.role === 'ADMIN';
  const userStoreNumber = user?.store_number || null;

  const [activeTab, setActiveTab] = useState<TabType>('analise');
  const [period, setPeriod] = useState<PeriodType>('mensal');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(4);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  
  const [params, setParams] = useState<BuyOrderParams | null>(null);
  const [analysis, setAnalysis] = useState<StoreAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // ═══════════════════════════════════════════════════════════════════════════
  // CARREGAR PARÂMETROS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    loadParameters();
  }, [selectedYear, selectedMonth]);

  const loadParameters = async () => {
    try {
      const { data, error } = await supabase
        .from('buyorder_parameters_global')
        .select('*')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .single();

      if (error) throw error;
      setParams(data);
    } catch (err) {
      console.error('Erro ao carregar parâmetros:', err);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CARREGAR ANÁLISE
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    loadAnalysis();
  }, [selectedYear, selectedMonth, isAdmin, userStoreNumber]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      // Query complexa - combinar buyorder_records + stores + quota_control
      const { data: records, error } = await supabase
        .from('buyorder_records')
        .select('*')
        .eq('year', selectedYear)
        .eq('month', selectedMonth);

      if (error) throw error;

      // Agrupar por loja
      const grouped = groupByStore(records || []);
      
      // Buscar info de lojas
      const storeNumbers = Array.from(new Set(grouped.map(g => g.store_number)));
      const { data: stores } = await supabase
        .from('stores')
        .select('number, name, city')
        .in('number', storeNumbers);

      // Buscar cotas
      const { data: quotas } = await supabase
        .from('buyorder_quota_control')
        .select('*')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .in('store_number', storeNumbers);

      const quotaIds = quotas?.map(q => q.id) || [];
      const { data: pendingTransactions } = quotaIds.length > 0 
        ? await supabase
            .from('buyorder_quota_transactions')
            .select('quota_control_id, valor_abatido, tipo_comprador')
            .in('quota_control_id', quotaIds)
            .eq('aplicado', false)
        : { data: [] };

      // Combinar tudo
      const combined = grouped.map(g => {
        const store = stores?.find(s => s.number === g.store_number);
        const quota = quotas?.find(q => q.store_number === g.store_number);
        
        const storeTransactions = pendingTransactions?.filter(t => t.quota_control_id === quota?.id) || [];
        const comprometidoComprador = storeTransactions
            .filter(t => t.tipo_comprador === 'COMPRADOR')
            .reduce((sum, t) => sum + (Number(t.valor_abatido) || 0), 0);
        const comprometidoGerente = storeTransactions
            .filter(t => t.tipo_comprador === 'GERENTE')
            .reduce((sum, t) => sum + (Number(t.valor_abatido) || 0), 0);

        return {
          ...g,
          store_name: store?.name || 'Desconhecida',
          city: store?.city || '',
          cota_inicial: quota?.cota_inicial || 0,
          cota_utilizada: quota?.cota_utilizada || 0,
          cota_disponivel: quota?.cota_disponivel || 0,
          cota_gerente_inicial: quota?.cota_gerente_inicial || 0,
          cota_gerente_utilizada: quota?.cota_gerente_utilizada || 0,
          cota_gerente_disponivel: quota?.cota_gerente_disponivel || 0,
          cota_comprador_inicial: quota?.cota_comprador_inicial || 0,
          cota_comprador_utilizada: quota?.cota_comprador_utilizada || 0,
          cota_comprador_disponivel: quota?.cota_comprador_disponivel || 0,
          comprometido_futuro_comprador: comprometidoComprador,
          comprometido_futuro_gerente: comprometidoGerente,
          percentual_utilizado: quota?.percentual_utilizado || 0,
          status: quota?.status || 'OK'
        };
      });

      // Filtrar por permissão
      const filtered = isAdmin 
        ? combined 
        : combined.filter(c => c.store_number === userStoreNumber);

      setAnalysis(filtered);
    } catch (err) {
      console.error('Erro ao carregar análise:', err);
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AGRUPAR POR LOJA
  // ═══════════════════════════════════════════════════════════════════════════

  const groupByStore = (records: any[]): StoreAnalysis[] => {
    const grouped = new Map<string, any>();

    records.forEach(r => {
      r.store_numbers?.forEach((storeNum: string) => {
        const key = storeNum;
        if (!grouped.has(key)) {
          grouped.set(key, {
            store_number: key,
            total_pares: 0,
            feminino_qtd: 0,
            inf_menina_qtd: 0,
            inf_menino_qtd: 0,
            masculino_qtd: 0,
            acessorio_qtd: 0,
            feminino_tenis_qtd: 0,
            masculino_tenis_qtd: 0,
            inf_menina_tenis_qtd: 0,
            inf_menino_tenis_qtd: 0
          });
        }

        const g = grouped.get(key)!;
        g.total_pares += r.total_pares || 0;

        // Contar por categoria
        switch (r.categoria) {
          case 'FEMININO':
            g.feminino_qtd += r.total_pares || 0;
            if (r.is_tenis) g.feminino_tenis_qtd += r.total_pares || 0;
            break;
          case 'INF_MENINA':
            g.inf_menina_qtd += r.total_pares || 0;
            if (r.is_tenis) g.inf_menina_tenis_qtd += r.total_pares || 0;
            break;
          case 'INF_MENINO':
            g.inf_menino_qtd += r.total_pares || 0;
            if (r.is_tenis) g.inf_menino_tenis_qtd += r.total_pares || 0;
            break;
          case 'MASCULINO':
            g.masculino_qtd += r.total_pares || 0;
            if (r.is_tenis) g.masculino_tenis_qtd += r.total_pares || 0;
            break;
          case 'ACESSORIO':
            g.acessorio_qtd += r.total_pares || 0;
            break;
        }
      });
    });

    // Calcular percentuais
    return Array.from(grouped.values()).map(g => ({
      ...g,
      feminino_pct: g.total_pares > 0 ? (g.feminino_qtd / g.total_pares) * 100 : 0,
      inf_menina_pct: g.total_pares > 0 ? (g.inf_menina_qtd / g.total_pares) * 100 : 0,
      inf_menino_pct: g.total_pares > 0 ? (g.inf_menino_qtd / g.total_pares) * 100 : 0,
      masculino_pct: g.total_pares > 0 ? (g.masculino_qtd / g.total_pares) * 100 : 0,
      acessorio_pct: g.total_pares > 0 ? (g.acessorio_qtd / g.total_pares) * 100 : 0,
      feminino_tenis_pct: g.feminino_qtd > 0 ? (g.feminino_tenis_qtd / g.feminino_qtd) * 100 : 0,
      masculino_tenis_pct: g.masculino_qtd > 0 ? (g.masculino_tenis_qtd / g.masculino_qtd) * 100 : 0,
      inf_menina_tenis_pct: g.inf_menina_qtd > 0 ? (g.inf_menina_tenis_qtd / g.inf_menina_qtd) * 100 : 0,
      inf_menino_tenis_pct: g.inf_menino_qtd > 0 ? (g.inf_menino_tenis_qtd / g.inf_menino_qtd) * 100 : 0
    }));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const getColorForPct = (actual: number, target: number): string => {
    const ratio = actual / target;
    if (ratio >= 1.0) return '#97C459'; // Verde
    if (ratio >= 0.75) return '#FAC775'; // Amarelo
    if (ratio >= 0.5) return '#F0997B'; // Laranja
    return '#F09595'; // Vermelho
  };

  const getStatusBadge = (actual: number, target: number) => {
    const ratio = actual / target;
    if (ratio >= 1.0) return { bg: '#EAF3DE', text: '#3B6D11', label: '✓ Meta atingida' };
    if (ratio >= 0.75) return { bg: '#FAEEDA', text: '#854F0B', label: '⚠ Atenção' };
    if (ratio >= 0.5) return { bg: '#FAECE7', text: '#993C1D', label: '🔶 Pouco' };
    return { bg: '#FCEBEB', text: '#A32D2D', label: '🔴 Crítico' };
  };

  const filteredAnalysis = analysis.filter(a => {
    const matchSearch = searchTerm === '' || 
      a.store_number.includes(searchTerm) ||
      a.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.city.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = filterStatus === 'all' || a.status === filterStatus;

    return matchSearch && matchStatus;
  }).sort((a, b) => parseInt(a.store_number, 10) - parseInt(b.store_number, 10));

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="buy-order-analytics-dashboard">
      {/* Header */}
      <div className="header">
        <h1>📦 Pedidos de Compra</h1>
        <p>Análise completa de compras por loja, categoria e mês</p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={activeTab === 'analise' ? 'active' : ''}
          onClick={() => setActiveTab('analise')}
        >
          📊 Análise por Loja
        </button>
        <button 
          className={activeTab === 'novo_pedido' ? 'active' : ''}
          onClick={() => setActiveTab('novo_pedido')}
        >
          ➕ Novo Pedido
        </button>
        <button 
          className={activeTab === 'pedidos_comprador' ? 'active' : ''}
          onClick={() => setActiveTab('pedidos_comprador')}
        >
          📋 Últimos Pedidos (Comprador)
        </button>
        <button 
          className={activeTab === 'pedidos_loja' ? 'active' : ''}
          onClick={() => setActiveTab('pedidos_loja')}
        >
          🏪 Últimos Pedidos (Loja)
        </button>
        <button 
          className={activeTab === 'parametros' ? 'active' : ''}
          onClick={() => setActiveTab('parametros')}
        >
          ⚙️ Parâmetros
        </button>
      </div>

      {/* Filtros */}
      <div className="filters">
        <div className="filter-group">
          <label>Período</label>
          <div className="period-buttons">
            <button 
              className={period === 'mensal' ? 'active' : ''}
              onClick={() => setPeriod('mensal')}
            >
              Mensal
            </button>
            <button 
              className={period === 'semestral' ? 'active' : ''}
              onClick={() => setPeriod('semestral')}
            >
              Semestral
            </button>
            <button 
              className={period === 'anual' ? 'active' : ''}
              onClick={() => setPeriod('anual')}
            >
              Anual
            </button>
          </div>
        </div>

        <div className="filter-group">
          <label>Mês</label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2026, i).toLocaleDateString('pt-BR', { month: 'long' })} {selectedYear}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>🔍 Buscar loja</label>
          <input 
            type="text"
            placeholder="Número, nome ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Status da Cota</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="OK">✓ OK</option>
            <option value="ATENÇÃO">⚠ Atenção</option>
            <option value="CRÍTICO">🔴 Crítico</option>
            <option value="ESGOTADO">🚫 Esgotado</option>
          </select>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="content">
        {activeTab === 'analise' && (
          <AnaliseTab 
            analysis={filteredAnalysis}
            params={params}
            loading={loading}
            getColorForPct={getColorForPct}
            getStatusBadge={getStatusBadge}
          />
        )}

        {activeTab === 'novo_pedido' && (
          <NovoPedidoTab user={user} />
        )}

        {activeTab === 'pedidos_comprador' && (
          <PedidosCompradorTab isAdmin={isAdmin} userStoreNumber={userStoreNumber} />
        )}

        {activeTab === 'pedidos_loja' && (
          <PedidosLojaTab isAdmin={isAdmin} userStoreNumber={userStoreNumber} />
        )}

        {activeTab === 'parametros' && (
          <ParametrosTab user={user} />
        )}
      </div>

      <style>{`
        .buy-order-analytics-dashboard {
          max-width: 1400px;
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
          font-size: 28px;
          font-weight: 500;
        }

        .header p {
          margin: 0;
          opacity: 0.9;
          font-size: 14px;
        }

        .tabs {
          background: white;
          padding: 0 2rem;
          border-bottom: 0.5px solid #E6E6E6;
          display: flex;
          gap: 2rem;
        }

        .tabs button {
          padding: 1rem 0;
          border: none;
          background: none;
          color: #888780;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .tabs button.active {
          color: #378ADD;
          border-bottom-color: #378ADD;
        }

        .filters {
          background: white;
          padding: 1rem 2rem;
          border-bottom: 0.5px solid #E6E6E6;
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .filter-group {
          flex: 1;
          min-width: 200px;
        }

        .filter-group label {
          display: block;
          font-size: 12px;
          color: #888780;
          margin-bottom: 4px;
          font-weight: 500;
        }

        .filter-group input,
        .filter-group select {
          width: 100%;
          padding: 8px 12px;
          border: 0.5px solid #D3D1C7;
          border-radius: 6px;
          font-size: 14px;
        }

        .period-buttons {
          display: flex;
          gap: 8px;
        }

        .period-buttons button {
          flex: 1;
          padding: 8px 16px;
          border: 0.5px solid #D3D1C7;
          background: white;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .period-buttons button.active {
          background: #378ADD;
          color: white;
          border-color: #378ADD;
        }

        .content {
          background: #F8F8F8;
          padding: 1.5rem;
          min-height: 400px;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA: ANÁLISE POR LOJA
// ═══════════════════════════════════════════════════════════════════════════

function AnaliseTab({ 
  analysis, 
  params, 
  loading,
  getColorForPct,
  getStatusBadge
}: any) {
  if (loading) {
    return <div className="loading">Carregando análise...</div>;
  }

  if (!params) {
    return <div className="empty">Nenhum parâmetro configurado para este período.</div>;
  }

  if (analysis.length === 0) {
    return <div className="empty">Nenhuma compra registrada para este período.</div>;
  }

  return (
    <div className="analise-grid">
      {analysis.map((store: StoreAnalysis) => (
        <StoreCard 
          key={store.store_number}
          store={store}
          params={params}
          getColorForPct={getColorForPct}
          getStatusBadge={getStatusBadge}
        />
      ))}

      <style>{`
        .analise-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
        }

        .loading,
        .empty {
          text-align: center;
          padding: 3rem;
          color: #888780;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CARD DE LOJA
// ═══════════════════════════════════════════════════════════════════════════

function StoreCard({ store, params, getColorForPct, getStatusBadge }: any) {
  const femStatus = getStatusBadge(store.feminino_pct, params.feminino_pct);
  const tenisTarget = params.sub_metas?.TENIS?.pct || 25;
  const avgTenisPct = (
    store.feminino_tenis_pct + 
    store.masculino_tenis_pct + 
    store.inf_menina_tenis_pct + 
    store.inf_menino_tenis_pct
  ) / 4;

  return (
    <div className="store-card">
      {/* Header */}
      <div className="card-header">
        <div>
          <h3>Loja {store.store_number}</h3>
          <p>{store.city}</p>
        </div>
        <div 
          className="status-badge"
          style={{ background: femStatus.bg, color: femStatus.text }}
        >
          {femStatus.label}
        </div>
      </div>

      {/* Categorias */}
      <div className="categories">
        <CategoryBar 
          label="Feminino"
          actual={store.feminino_pct}
          target={params.feminino_pct}
          quantity={store.feminino_qtd}
          getColorForPct={getColorForPct}
        />

        <CategoryBar 
          label="Inf. Menina"
          actual={store.inf_menina_pct}
          target={params.infantil_menina_pct}
          quantity={store.inf_menina_qtd}
          getColorForPct={getColorForPct}
        />

        <CategoryBar 
          label="Inf. Menino"
          actual={store.inf_menino_pct}
          target={params.infantil_menino_pct}
          quantity={store.inf_menino_qtd}
          getColorForPct={getColorForPct}
        />

        <CategoryBar 
          label="Masculino"
          actual={store.masculino_pct}
          target={params.masculino_pct}
          quantity={store.masculino_qtd}
          getColorForPct={getColorForPct}
        />

        <CategoryBar 
          label="Acessórios"
          actual={store.acessorio_pct}
          target={params.acessorio_pct}
          quantity={store.acessorio_qtd}
          getColorForPct={getColorForPct}
        />
      </div>

      {/* Sub-meta Tênis */}
      <div className="submeta">
        <div className="submeta-header">
          <span>🎾 Tênis (25% de F/M/I)</span>
          <span 
            className="submeta-value"
            style={{ 
              background: avgTenisPct >= tenisTarget ? '#EAF3DE' : '#FAEEDA',
              color: avgTenisPct >= tenisTarget ? '#3B6D11' : '#854F0B'
            }}
          >
            {avgTenisPct.toFixed(0)}% {avgTenisPct >= tenisTarget ? '✓' : '⚠'}
          </span>
        </div>
      </div>

      {/* Cota */}
      <div className="quota-section">
        <div className="quota-header">
          <span>💰 Cota OTB</span>
          <span className="quota-status">{store.status}</span>
        </div>
        <div className="quota-bar">
          <div 
            className="quota-fill"
            style={{ 
              width: `${Math.min(store.percentual_utilizado, 100)}%`,
              background: store.percentual_utilizado >= 90 ? '#F09595' : 
                          store.percentual_utilizado >= 75 ? '#FAC775' : '#97C459'
            }}
          />
        </div>
        <div className="quota-values">
          <span>R$ {store.cota_utilizada.toLocaleString('pt-BR')}</span>
          <span>de R$ {store.cota_inicial.toLocaleString('pt-BR')}</span>
        </div>
      </div>

      <style>{`
        .store-card {
          background: white;
          border: 0.5px solid #E6E6E6;
          border-radius: 12px;
          padding: 1rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 0.5px solid #F1EFE8;
        }

        .card-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
        }

        .card-header p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #888780;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .categories {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .submeta {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 0.5px solid #E6E6E6;
        }

        .submeta-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #888780;
        }

        .submeta-value {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .quota-section {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 0.5px solid #E6E6E6;
        }

        .quota-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .quota-status {
          font-weight: 500;
          color: #888780;
        }

        .quota-bar {
          background: #F1EFE8;
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .quota-fill {
          height: 100%;
          transition: width 0.3s;
        }

        .quota-values {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #888780;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BARRA DE CATEGORIA
// ═══════════════════════════════════════════════════════════════════════════

function CategoryBar({ label, actual, target, quantity, getColorForPct }: any) {
  const color = getColorForPct(actual, target);
  const width = Math.min((actual / target) * 100, 100);

  return (
    <div className="category-bar">
      <div className="category-header">
        <span className="label">{label}</span>
        <span className="target">Meta: {target.toFixed(0)}%</span>
      </div>
      <div className="bar-container">
        <div 
          className="bar-fill"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      <div className="category-footer">
        <span className="actual" style={{ color }}>{actual.toFixed(0)}% comprado</span>
        <span className="qty">{quantity} pares</span>
      </div>

      <style>{`
        .category-bar {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .category-header {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .label {
          font-weight: 500;
        }

        .target {
          color: #888780;
          font-size: 12px;
        }

        .bar-container {
          background: #F1EFE8;
          height: 8px;
          border-radius: 8px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          transition: width 0.3s;
        }

        .category-footer {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
        }

        .actual {
          font-weight: 500;
        }

        .qty {
          color: #888780;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA: PEDIDOS DO COMPRADOR
// ═══════════════════════════════════════════════════════════════════════════

function PedidosCompradorTab({ isAdmin, userStoreNumber }: any) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      let query = supabase
        .from('buy_orders')
        .select('*, buy_order_items(*)')
        .order('created_at', { ascending: false })
        .limit(20);

      // Filtrar por loja se não for admin
      if (!isAdmin && userStoreNumber) {
        // Implementar filtro por loja
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
    }
  };

  return (
    <div className="pedidos-tab">
      <h3>Últimos Pedidos do Comprador</h3>
      {orders.length === 0 ? (
        <p>Nenhum pedido encontrado.</p>
      ) : (
        <div className="orders-list">
          {orders.map((order: any) => (
            <div key={order.id} className="order-card">
              <div>Pedido #{order.id.substring(0, 8)}</div>
              <div>{new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
              <div>{order.buy_order_items?.length || 0} itens</div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .pedidos-tab {
          background: white;
          padding: 2rem;
          border-radius: 12px;
        }

        .orders-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 1rem;
        }

        .order-card {
          background: #F8F8F8;
          padding: 1rem;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA: PEDIDOS POR LOJA
// ═══════════════════════════════════════════════════════════════════════════

function PedidosLojaTab({ isAdmin, userStoreNumber }: any) {
  return (
    <div className="pedidos-tab">
      <h3>Últimos Pedidos por Loja</h3>
      <p>Em desenvolvimento...</p>

      <style>{`
        .pedidos-tab {
          background: white;
          padding: 2rem;
          border-radius: 12px;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA: NOVO PEDIDO (PLACEHOLDER)
// ═══════════════════════════════════════════════════════════════════════════

function NovoPedidoTab({ user }: any) {
  return (
    <div className="novo-pedido-tab">
      <BuyOrderModule user={user} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA: PARÂMETROS
// ═══════════════════════════════════════════════════════════════════════════

function ParametrosTab({ user }: any) {
  return <BuyOrderParams user={user} />;
}