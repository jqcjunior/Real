import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardCheck, Loader2, Search, Printer, CheckCircle2,
  Clock, AlertCircle, ChevronDown, ChevronUp, Store,
  Package, Calendar, DollarSign, X, RefreshCw, Filter
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { User } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type CentralStatus = 'pendente' | 'exportado' | 'cadastrado';

interface StoreInfo {
  id: string;
  number: string;
  name: string;
  city: string;
}

interface ConferenciaOrder {
  id: string;
  numero_pedido: number;
  marca: string;
  fornecedor: string;
  representante: string;
  fat_inicio: string;
  fat_fim: string;
  prazos: number[];
  status: string;
  central_status: CentralStatus;
  created_at: string;
  exported_at: string | null;
  total_pares: number;
  valor_total: number;
  lojas: number[];
}

interface OrderItem {
  id: string;
  referencia: string;
  tipo: string;
  cor1: string;
  cor2: string;
  cor3: string;
  modelo: string;
  custo: number;
  preco_venda: number;
  total_pares: number;
  grades: any[];
}

interface BuyOrderConferenciaProps {
  currentUser: User;
  stores: StoreInfo[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const semaphore = (cs: CentralStatus) => {
  if (cs === 'cadastrado') return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-300 dark:border-green-700', dot: 'bg-green-500', label: 'Cadastrado' };
  if (cs === 'exportado')  return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-700', dot: 'bg-yellow-500', label: 'Enviado Central' };
  return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-300 dark:border-red-700', dot: 'bg-red-500', label: 'Pendente' };
};

const fmt = {
  currency: (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  date: (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—',
  datetime: (d: string) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const BuyOrderConferencia: React.FC<BuyOrderConferenciaProps> = ({ currentUser, stores }) => {

  const isAdmin   = String(currentUser?.role || '').toUpperCase() === 'ADMIN';
  const isGerente = !isAdmin;

  // ── State ──────────────────────────────────────────────────────────────────
  const [orders, setOrders]               = useState<ConferenciaOrder[]>([]);
  const [loading, setLoading]             = useState(true);
  const [updating, setUpdating]           = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [itemsMap, setItemsMap]           = useState<Record<string, OrderItem[]>>({});
  const [loadingItems, setLoadingItems]   = useState<Record<string, boolean>>({});
  const [storeNumber, setStoreNumber]     = useState<number | null>(null);
  const [storeReady, setStoreReady]       = useState(false);
  const [printOrder, setPrintOrder]       = useState<ConferenciaOrder | null>(null);
  const [printItems, setPrintItems]       = useState<OrderItem[]>([]);

  // Filters
  const [search, setSearch]                     = useState('');
  const [filterStatus, setFilterStatus]         = useState<CentralStatus | 'all'>('all');
  const [filterMarca, setFilterMarca]           = useState('');
  const [filterLoja, setFilterLoja]             = useState('');
  const [showFilters, setShowFilters]           = useState(false);

  // ── Gerente: buscar número da loja ─────────────────────────────────────────
  useEffect(() => {
    const resolveStore = async () => {
      if (isGerente && currentUser?.storeId) {
        try {
          const { data } = await supabase
            .from('stores')
            .select('number')
            .eq('id', currentUser.storeId)
            .single();
          if (data?.number) setStoreNumber(parseInt(data.number, 10));
        } catch (err) {
          console.error('[Conferência] Erro ao resolver loja:', err);
        }
      }
      setStoreReady(true);
    };
    resolveStore();
  }, []);

  // ── Load orders ────────────────────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    if (!storeReady) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('buy_orders')
        .select(`
          id, numero_pedido, marca, fornecedor, representante,
          fat_inicio, fat_fim, prazos, status, central_status,
          created_at, exported_at,
          buy_order_sub_orders ( lojas_numeros, total_pares, valor_bruto )
        `)
        .in('status', ['exportado', 'confirmado', 'stand_by', 'rascunho'])
        .order('numero_pedido', { ascending: false });

      if (error) throw error;

      let mapped: ConferenciaOrder[] = (data || []).map((o: any) => {
        const subs = (o.buy_order_sub_orders || []) as any[];
        const allLojas = [...new Set(subs.flatMap((s: any) => s.lojas_numeros || []))].sort((a, b) => a - b);
        return {
          id: o.id,
          numero_pedido: o.numero_pedido,
          marca: o.marca,
          fornecedor: o.fornecedor,
          representante: o.representante,
          fat_inicio: o.fat_inicio,
          fat_fim: o.fat_fim,
          prazos: o.prazos || [],
          status: o.status,
          central_status: (o.central_status || 'pendente') as CentralStatus,
          created_at: o.created_at,
          exported_at: o.exported_at,
          total_pares: subs.reduce((s: number, x: any) => s + (x.total_pares || 0), 0),
          valor_total: subs.reduce((s: number, x: any) => s + Number(x.valor_bruto || 0), 0),
          lojas: allLojas,
        };
      });

      // Gerente: filtrar apenas pedidos da sua loja
      if (isGerente && storeNumber !== null) {
        mapped = mapped.filter(o => o.lojas.includes(storeNumber));
      }

      setOrders(mapped);
    } catch (err) {
      console.error('[Conferência] Erro ao carregar pedidos:', err);
    } finally {
      setLoading(false);
    }
  }, [storeReady, storeNumber, isGerente]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // ── Carregar itens de um pedido sob demanda ─────────────────────────────────
  const loadItems = async (orderId: string) => {
    if (itemsMap[orderId]) return;
    setLoadingItems(prev => ({ ...prev, [orderId]: true }));
    try {
      const { data, error } = await supabase
        .from('buy_order_items')
        .select('id, referencia, tipo, cor1, cor2, cor3, modelo, custo, preco_venda, total_pares, grades')
        .eq('order_id', orderId)
        .order('item_order', { ascending: true });
      if (error) throw error;
      setItemsMap(prev => ({ ...prev, [orderId]: data || [] }));
    } catch (err) {
      console.error('[Conferência] Erro ao carregar itens:', err);
    } finally {
      setLoadingItems(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const toggleExpand = (orderId: string) => {
    if (expandedId === orderId) {
      setExpandedId(null);
    } else {
      setExpandedId(orderId);
      loadItems(orderId);
    }
  };

  // ── Marcar como cadastrado (somente admin) ──────────────────────────────────
  const markAsCadastrado = async (order: ConferenciaOrder) => {
    if (!isAdmin || order.central_status === 'cadastrado') return;
    setUpdating(prev => ({ ...prev, [order.id]: true }));
    try {
      const { error } = await supabase
        .from('buy_orders')
        .update({ central_status: 'cadastrado' })
        .eq('id', order.id);
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, central_status: 'cadastrado' } : o));
    } catch (err) {
      console.error('[Conferência] Erro ao marcar como cadastrado:', err);
      alert('Erro ao atualizar status. Tente novamente.');
    } finally {
      setUpdating(prev => ({ ...prev, [order.id]: false }));
    }
  };

  // ── Imprimir pedido ─────────────────────────────────────────────────────────
  const handlePrint = async (order: ConferenciaOrder) => {
    let items = itemsMap[order.id];
    if (!items) {
      setLoadingItems(prev => ({ ...prev, [order.id]: true }));
      try {
        const { data } = await supabase
          .from('buy_order_items')
          .select('id, referencia, tipo, cor1, cor2, cor3, modelo, custo, preco_venda, total_pares, grades')
          .eq('order_id', order.id)
          .order('item_order', { ascending: true });
        items = data || [];
        setItemsMap(prev => ({ ...prev, [order.id]: items! }));
      } finally {
        setLoadingItems(prev => ({ ...prev, [order.id]: false }));
      }
    }
    setPrintOrder(order);
    setPrintItems(items);
    setTimeout(() => window.print(), 300);
  };

  // ── Filtros aplicados ───────────────────────────────────────────────────────
  const filtered = orders.filter(o => {
    if (filterStatus !== 'all' && o.central_status !== filterStatus) return false;
    if (filterMarca && !o.marca.toLowerCase().includes(filterMarca.toLowerCase()) && !o.fornecedor.toLowerCase().includes(filterMarca.toLowerCase())) return false;
    if (filterLoja && !o.lojas.map(String).includes(filterLoja)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!String(o.numero_pedido).includes(q) && !o.marca.toLowerCase().includes(q) && !o.fornecedor.toLowerCase().includes(q) && !o.representante.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Totalizadores
  const totalPares  = filtered.reduce((s, o) => s + o.total_pares, 0);
  const totalValor  = filtered.reduce((s, o) => s + o.valor_total, 0);
  const countVerde  = filtered.filter(o => o.central_status === 'cadastrado').length;
  const countAmarelo = filtered.filter(o => o.central_status === 'exportado').length;
  const countVermelho = filtered.filter(o => o.central_status === 'pendente').length;

  // Marcas únicas para filtro
  const marcasUnicas = [...new Set(orders.map(o => o.marca))].sort();
  // Lojas únicas para filtro
  const lojasUnicas = [...new Set(orders.flatMap(o => o.lojas))].sort((a, b) => a - b);

  const getStoreName = (num: number) => {
    const s = stores.find(x => x.number === String(num));
    return s ? s.name.replace('Loja ', '') : `Loja ${num}`;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Print styles (oculto em tela, visível só ao imprimir) ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #conferencia-print { display: block !important; }
        }
        #conferencia-print { display: none; }
      `}</style>

      {/* ── Print View ── */}
      {printOrder && (
        <div id="conferencia-print" style={{ fontFamily: 'Arial, sans-serif', padding: 24, color: '#000' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>REAL CALÇADOS</h1>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '4px 0' }}>PEDIDO DE COMPRA Nº {printOrder.numero_pedido}</h2>
            <p style={{ fontSize: 11, margin: 0 }}>Emitido em: {fmt.datetime(new Date().toISOString())}</p>
          </div>
          <hr style={{ margin: '12px 0' }} />
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', marginBottom: 12 }}>
            <tbody>
              <tr><td style={{ fontWeight: 700, padding: '2px 8px 2px 0', width: 140 }}>Marca:</td><td>{printOrder.marca}</td><td style={{ fontWeight: 700, padding: '2px 8px 2px 0', width: 140 }}>Fornecedor:</td><td>{printOrder.fornecedor}</td></tr>
              <tr><td style={{ fontWeight: 700, padding: '2px 8px 2px 0' }}>Representante:</td><td>{printOrder.representante}</td><td style={{ fontWeight: 700, padding: '2px 8px 2px 0' }}>Prazos:</td><td>{printOrder.prazos.join(' / ')} dias</td></tr>
              <tr><td style={{ fontWeight: 700, padding: '2px 8px 2px 0' }}>Faturamento:</td><td>{fmt.date(printOrder.fat_inicio)} a {fmt.date(printOrder.fat_fim)}</td><td style={{ fontWeight: 700, padding: '2px 8px 2px 0' }}>Lojas:</td><td>{printOrder.lojas.map(n => `Loja ${n}`).join(', ')}</td></tr>
              <tr><td style={{ fontWeight: 700, padding: '2px 8px 2px 0' }}>Total Pares:</td><td>{printOrder.total_pares}</td><td style={{ fontWeight: 700, padding: '2px 8px 2px 0' }}>Valor Total:</td><td style={{ fontWeight: 900 }}>{fmt.currency(printOrder.valor_total)}</td></tr>
            </tbody>
          </table>
          <hr style={{ margin: '12px 0' }} />
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e3a5f', color: '#fff' }}>
                {['Ref.', 'Tipo', 'Cor', 'Modelo', 'Custo', 'Venda', 'Pares'].map(h => (
                  <th key={h} style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printItems.map((item, i) => (
                <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? '#f8f8f8' : '#fff' }}>
                  <td style={{ padding: '3px 6px', fontWeight: 700 }}>{item.referencia}</td>
                  <td style={{ padding: '3px 6px' }}>{item.tipo}</td>
                  <td style={{ padding: '3px 6px' }}>{[item.cor1, item.cor2, item.cor3].filter(Boolean).join(' / ')}</td>
                  <td style={{ padding: '3px 6px' }}>{item.modelo}</td>
                  <td style={{ padding: '3px 6px' }}>{fmt.currency(item.custo)}</td>
                  <td style={{ padding: '3px 6px' }}>{fmt.currency(item.preco_venda)}</td>
                  <td style={{ padding: '3px 6px', fontWeight: 700 }}>{item.total_pares}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 900 }}>
                <td colSpan={6} style={{ padding: '4px 6px', textAlign: 'right' }}>TOTAL PARES:</td>
                <td style={{ padding: '4px 6px' }}>{printOrder.total_pares}</td>
              </tr>
            </tfoot>
          </table>
          <div style={{ marginTop: 24, borderTop: '1px solid #ccc', paddingTop: 12, fontSize: 10, color: '#666', textAlign: 'center' }}>
            Real Calçados — Sistema Real Admin — Documento gerado em {fmt.datetime(new Date().toISOString())}
          </div>
        </div>
      )}

      {/* ── Tela principal ── */}
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">

        {/* Header */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 shrink-0 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="text-blue-600 dark:text-blue-400" size={24} />
                Conferência de Pedidos
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAdmin ? 'Acompanhamento e confirmação de cadastro na central' : `Pedidos da sua loja — Loja ${storeNumber || '...'}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadOrders} disabled={loading} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all disabled:opacity-40" title="Atualizar">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Totalizadores */}
          {!loading && (
            <div className="flex flex-wrap gap-3 mt-4">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                <Package size={13} /> {filtered.length} pedidos
              </div>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                <DollarSign size={13} /> {fmt.currency(totalValor)}
              </div>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                {totalPares.toLocaleString('pt-BR')} pares
              </div>
              {isAdmin && (
                <>
                  <div className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/20 px-3 py-1.5 rounded-lg text-xs font-bold text-green-700 dark:text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {countVerde} cadastrados
                  </div>
                  <div className="flex items-center gap-1.5 bg-yellow-100 dark:bg-yellow-900/20 px-3 py-1.5 rounded-lg text-xs font-bold text-yellow-700 dark:text-yellow-400">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> {countAmarelo} enviados
                  </div>
                  <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-lg text-xs font-bold text-red-700 dark:text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {countVermelho} pendentes
                  </div>
                </>
              )}
            </div>
          )}

          {/* Busca e filtros */}
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nº, marca, fornecedor ou representante..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}
            >
              <Filter size={13} /> Filtros
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 mt-2">
              {isAdmin && (
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                  className="text-xs px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos os status</option>
                  <option value="pendente">🔴 Pendente</option>
                  <option value="exportado">🟡 Enviado Central</option>
                  <option value="cadastrado">🟢 Cadastrado</option>
                </select>
              )}
              <select
                value={filterMarca}
                onChange={e => setFilterMarca(e.target.value)}
                className="text-xs px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as marcas</option>
                {marcasUnicas.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {isAdmin && (
                <select
                  value={filterLoja}
                  onChange={e => setFilterLoja(e.target.value)}
                  className="text-xs px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas as lojas</option>
                  {lojasUnicas.map(n => <option key={n} value={String(n)}>{getStoreName(n)}</option>)}
                </select>
              )}
              {(filterStatus !== 'all' || filterMarca || filterLoja || search) && (
                <button
                  onClick={() => { setFilterStatus('all'); setFilterMarca(''); setFilterLoja(''); setSearch(''); }}
                  className="text-xs px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 font-bold hover:bg-red-100 transition-all"
                >
                  ✕ Limpar
                </button>
              )}
            </div>
          )}
        </header>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Carregando pedidos...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <ClipboardCheck size={40} className="text-slate-300" />
              <span className="text-sm font-semibold text-slate-400">Nenhum pedido encontrado.</span>
            </div>
          ) : (
            filtered.map(order => {
              const sem = semaphore(order.central_status);
              const isExpanded = expandedId === order.id;
              const items = itemsMap[order.id] || [];
              const isLoadingItems = loadingItems[order.id] || false;
              const isUpdating = updating[order.id] || false;

              return (
                <div
                  key={order.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border transition-all duration-200 ${isExpanded ? 'border-blue-300 dark:border-blue-700 shadow-md' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}`}
                >
                  {/* Row principal */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">

                    {/* Semáforo — só admin */}
                    {isAdmin && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest shrink-0 ${sem.bg} ${sem.text} ${sem.border}`}>
                        <span className={`w-2 h-2 rounded-full ${sem.dot}`} />
                        {sem.label}
                      </div>
                    )}

                    {/* Número e marca */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-lg font-black text-blue-600 dark:text-blue-400 shrink-0">
                        #{order.numero_pedido}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{order.marca}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{order.fornecedor} · {order.representante}</p>
                      </div>
                    </div>

                    {/* Fat. e prazos */}
                    <div className="hidden md:flex flex-col text-right shrink-0">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Faturamento</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmt.date(order.fat_inicio)} → {fmt.date(order.fat_fim)}</span>
                      <span className="text-[10px] text-slate-400">{order.prazos.join('/')} dias</span>
                    </div>

                    {/* Lojas */}
                    <div className="hidden lg:flex flex-wrap gap-1 shrink-0 max-w-[180px]">
                      {order.lojas.map(n => (
                        <span key={n} className="text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                          Lj {n}
                        </span>
                      ))}
                    </div>

                    {/* Valores */}
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{fmt.currency(order.valor_total)}</span>
                      <span className="text-[10px] text-slate-400">{order.total_pares} pares</span>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botão verde — somente admin e quando não está cadastrado */}
                      {isAdmin && order.central_status !== 'cadastrado' && (
                        <button
                          onClick={() => markAsCadastrado(order)}
                          disabled={isUpdating}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                          title="Marcar como cadastrado na central"
                        >
                          {isUpdating ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                          OK
                        </button>
                      )}

                      {/* Imprimir */}
                      <button
                        onClick={() => handlePrint(order)}
                        disabled={loadingItems[order.id]}
                        className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-all disabled:opacity-40"
                        title="Imprimir / Salvar PDF"
                      >
                        {loadingItems[order.id] ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                      </button>

                      {/* Expandir */}
                      <button
                        onClick={() => toggleExpand(order.id)}
                        className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-all"
                        title={isExpanded ? 'Recolher itens' : 'Ver itens'}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Expansão de itens */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-700 p-4">
                      {isLoadingItems ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
                          <Loader2 size={14} className="animate-spin" /> Carregando itens...
                        </div>
                      ) : items.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">Nenhum item cadastrado neste pedido.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-700/50">
                                {['Referência', 'Tipo', 'Cor', 'Modelo', 'Custo', 'Venda', 'Pares'].map(h => (
                                  <th key={h} className="text-left px-3 py-2 font-black text-slate-500 dark:text-slate-400 uppercase text-[9px] tracking-wider">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                              {items.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                  <td className="px-3 py-2 font-black text-slate-800 dark:text-slate-100 select-all">{item.referencia}</td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.tipo}</td>
                                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{[item.cor1, item.cor2, item.cor3].filter(Boolean).join(' / ')}</td>
                                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{item.modelo}</td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{fmt.currency(item.custo)}</td>
                                  <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">{fmt.currency(item.preco_venda)}</td>
                                  <td className="px-3 py-2 font-black text-slate-800 dark:text-slate-100">{item.total_pares}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-100 dark:bg-slate-700/50">
                                <td colSpan={6} className="px-3 py-2 font-black text-slate-600 dark:text-slate-300 text-right text-[10px] uppercase">Total Pares:</td>
                                <td className="px-3 py-2 font-black text-slate-800 dark:text-slate-100">{order.total_pares}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default BuyOrderConferencia;