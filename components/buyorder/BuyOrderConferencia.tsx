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

  const [sending, setSending]     = useState(false);
  const [lastLink, setLastLink]   = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<'success' | 'error' | null>(null);

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

  const handleSendEmail = async () => {
    if (!isAdmin) return;
    setSending(true);
    setSendResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        'https://rwwomakjhmglgoowbmsl.supabase.co/functions/v1/send-conferencia-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erro ao enviar');
      setLastLink(json.link);
      setSendResult('success');
      await loadOrders(); // Atualizar lista
    } catch (err: any) {
      console.error('[Conferência] Erro ao enviar email:', err);
      setSendResult('error');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    if (!lastLink) return;
    navigator.clipboard.writeText(lastLink);
    alert('Link copiado!');
  };

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

    const today = fmt.datetime(new Date().toISOString());
    const ordersRows = items.map((item, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8f8f8' : '#fff'}">
        <td style="padding:4px 8px;font-weight:700">${item.referencia}</td>
        <td style="padding:4px 8px">${item.tipo}</td>
        <td style="padding:4px 8px">${[item.cor1, item.cor2, item.cor3].filter(Boolean).join(' / ')}</td>
        <td style="padding:4px 8px">${item.modelo}</td>
        <td style="padding:4px 8px">${fmt.currency(item.custo)}</td>
        <td style="padding:4px 8px">${fmt.currency(item.preco_venda)}</td>
        <td style="padding:4px 8px;font-weight:700">${item.total_pares}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Pedido #${order.numero_pedido}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #000; font-size: 12px; }
        h1 { font-size: 18px; font-weight: 900; margin: 0; text-align: center; }
        h2 { font-size: 14px; font-weight: 700; margin: 4px 0; text-align: center; }
        p { margin: 2px 0; text-align: center; font-size: 11px; }
        hr { margin: 12px 0; border: none; border-top: 1px solid #ccc; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #1e3a5f; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
        td { padding: 4px 8px; font-size: 11px; }
        .info-label { font-weight: 700; width: 130px; }
        .footer { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 12px; font-size: 10px; color: #666; text-align: center; }
        tfoot td { background: #1e3a5f; color: #fff; font-weight: 900; }
      </style>
    </head><body>
      <h1>REAL CALÇADOS</h1>
      <h2>PEDIDO DE COMPRA Nº ${order.numero_pedido}</h2>
      <p>Emitido em: ${today}</p>
      <hr/>
      <table>
        <tr><td class="info-label">Marca:</td><td>${order.marca}</td><td class="info-label">Fornecedor:</td><td>${order.fornecedor}</td></tr>
        <tr><td class="info-label">Representante:</td><td>${order.representante}</td><td class="info-label">Prazos:</td><td>${order.prazos.join(' / ')} dias</td></tr>
        <tr><td class="info-label">Faturamento:</td><td>${fmt.date(order.fat_inicio)} a ${fmt.date(order.fat_fim)}</td><td class="info-label">Lojas:</td><td>${order.lojas.map(n => 'Loja ' + n).join(', ')}</td></tr>
        <tr><td class="info-label">Total Pares:</td><td>${order.total_pares}</td><td class="info-label">Valor Total:</td><td><strong>${fmt.currency(order.valor_total)}</strong></td></tr>
      </table>
      <hr/>
      <table>
        <thead><tr><th>Ref.</th><th>Tipo</th><th>Cor</th><th>Modelo</th><th>Custo</th><th>Venda</th><th>Pares</th></tr></thead>
        <tbody>${ordersRows}</tbody>
        <tfoot><tr><td colspan="6" style="text-align:right;padding:6px 8px">TOTAL PARES:</td><td style="padding:6px 8px">${order.total_pares}</td></tr></tfoot>
      </table>
      <div class="footer">Real Calçados — Sistema Real Admin — ${today}</div>
    </body></html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) { alert('Permita popups para usar a impressão.'); return; }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
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
              {/* Botão Enviar Email — somente admin */}
              {isAdmin && (
                <button
                  onClick={handleSendEmail}
                  disabled={sending || loading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                  title="Gerar link e enviar email para a central"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : '📧'}
                  {sending ? 'Enviando...' : 'Enviar Email'}
                </button>
              )}

              {/* Resultado do envio */}
              {sendResult === 'success' && lastLink && (
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 rounded-lg">
                  <span className="text-[10px] font-bold text-green-700 dark:text-green-400">✅ Email enviado!</span>
                  <button
                    onClick={copyLink}
                    className="text-[10px] font-black text-blue-600 dark:text-blue-400 underline"
                  >
                    Copiar link
                  </button>
                </div>
              )}
              {sendResult === 'error' && (
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400">❌ Erro ao enviar. Verifique os secrets.</span>
              )}

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
                  <button
                    onClick={() => setFilterStatus(filterStatus === 'cadastrado' ? 'all' : 'cadastrado')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${
                      filterStatus === 'cadastrado'
                        ? 'bg-green-600 text-white border-green-600 shadow-md'
                        : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:border-green-400'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {countVerde} cadastrados
                  </button>

                  <button
                    onClick={() => setFilterStatus(filterStatus === 'exportado' ? 'all' : 'exportado')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${
                      filterStatus === 'exportado'
                        ? 'bg-yellow-500 text-white border-yellow-500 shadow-md'
                        : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:border-yellow-400'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> {countAmarelo} enviados
                  </button>

                  <button
                    onClick={() => setFilterStatus(filterStatus === 'pendente' ? 'all' : 'pendente')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${
                      filterStatus === 'pendente'
                        ? 'bg-red-600 text-white border-red-600 shadow-md'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:border-red-400'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {countVermelho} pendentes
                  </button>
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
                  {/* Row principal — responsivo mobile */}
                  <div className="p-3 md:p-4">
                    {/* Linha 1: semáforo + número + marca + ações */}
                    <div className="flex items-start gap-2 mb-2">
                      {isAdmin && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest shrink-0 ${sem.bg} ${sem.text} ${sem.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sem.dot}`} />
                          <span className="hidden sm:inline">{sem.label}</span>
                        </div>
                      )}
                      <span className="text-base md:text-lg font-black text-blue-600 dark:text-blue-400 shrink-0">#{order.numero_pedido}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{order.marca}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{order.fornecedor} · {order.representante}</p>
                      </div>
                      {/* Ações sempre visíveis */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isAdmin && order.central_status !== 'cadastrado' && (
                          <button
                            onClick={() => markAsCadastrado(order)}
                            disabled={isUpdating}
                            className="flex items-center gap-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase transition-all"
                          >
                            {isUpdating ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                            OK
                          </button>
                        )}
                        <button
                          onClick={() => handlePrint(order)}
                          disabled={loadingItems[order.id]}
                          className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-all disabled:opacity-40"
                        >
                          {loadingItems[order.id] ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                        </button>
                        <button
                          onClick={() => toggleExpand(order.id)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-all"
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Linha 2: faturamento + valor + pares — sempre visível */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Faturamento</span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{fmt.date(order.fat_inicio)} → {fmt.date(order.fat_fim)}</span>
                        <span className="text-[9px] text-slate-400">{order.prazos.join('/')} dias</span>
                      </div>
                      <div className="flex flex-col ml-auto md:ml-0">
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{fmt.currency(order.valor_total)}</span>
                        <span className="text-[9px] text-slate-400">{order.total_pares} pares</span>
                      </div>

                      {/* Lojas — grid compacto */}
                      {order.lojas.length > 0 && (
                        <div className="w-full mt-1">
                          <div className="flex flex-wrap gap-1" style={{ maxHeight: '52px', overflow: 'hidden' }}>
                            {order.lojas.map(n => (
                              <span key={n} className="flex items-center justify-center w-9 h-6 text-[9px] font-black bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600 shrink-0">
                                {n}
                              </span>
                            ))}
                            {order.lojas.length > 16 && (
                              <span className="flex items-center justify-center px-2 h-6 text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600">
                                +{order.lojas.length - 16}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
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