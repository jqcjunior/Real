import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ensureSession } from '../../services/authService';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ChevronDown, ChevronUp, Mail } from 'lucide-react';

// ─── Constantes ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const STORE_CITIES: Record<string, string> = {
  "5":"Petrolina","8":"Catu","9":"P.Seguro","26":"Cruz das Almas",
  "31":"Euclides","34":"Brumado","40":"Jequié","43":"Ipiaú",
  "44":"Livramento","45":"Brumado","50":"Euclides","56":"T.Freitas",
  "72":"Eunápolis","88":"Jequié","96":"Itapetinga","100":"L.Freitas",
  "102":"Itamaraju","109":"C.Jacuípe"
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const toNumber = (v: any): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const fmt = (v: number): string => {
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '−R$ ' : 'R$ ') + formatted;
};

const fmtShort = (v: number): string => {
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (v < 0 ? '−R$ ' : 'R$ ') + formatted;
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : d;
};

const addMonths = (mes: number, ano: number, delta: number) => {
  let m = mes + delta;
  let y = ano;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1)  { m += 12; y -= 1; }
  return { mes: m, ano: y };
};

// ─── Semáforo de pedidos ───────────────────────────────────────────────────────
// 🟢 exportado + cadastrado  → já cadastrado na central
// 🟡 exportado + exportado   → exportado aguardando cadastro
// 🔴 rascunho / confirmado   → só digitado, não exportado

interface SemaforoConfig {
  color: string;
  bg: string;
  border: string;
  label: string;
  dot: string;
}

const getSemaforo = (status: string, centralStatus: string): SemaforoConfig => {
  const s = (status || '').toLowerCase();
  const cs = (centralStatus || '').toLowerCase();

  if (s === 'exportado' && cs === 'cadastrado') {
    return { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Cadastrado', dot: 'bg-emerald-500' };
  }
  if (s === 'exportado' && cs === 'exportado') {
    return { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Aguard. Cadastro', dot: 'bg-amber-400' };
  }
  // rascunho, confirmado, pendente → vermelho
  return { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: s === 'confirmado' ? 'Confirmado' : 'Rascunho', dot: 'bg-red-500' };
};

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface PainelItem {
  mes: number;
  ano: number;
  store_number: string;
  valor_cota: number;
  pedidos_real: number;
  pedidos_previsao: number;
}

interface Pedido {
  id: string;
  numero_pedido: number;
  marca: string;
  fornecedor: string;
  status: string;
  central_status: string;
  fat_inicio: string;
  fat_fim: string;
  vencimentos: string[];
  prazos: number[];
  export_count: number;
  exported_at: string | null;
  created_at: string;
  email: string | null;
  email_representante: string | null;
  representante: string | null;
  // enriquecidos no frontend
  total_pares?: number;
  valor_bruto_total?: number;
  lojas?: number[];
}

interface SubOrderSummary {
  order_id: string;
  total_pares: number;
  valor_bruto_total: number;
  lojas: number[];
}

interface ResumoAnoFiscalProps {
  user: any;
  stores: any[];
  supabase: any;
}

// ─── Componente principal ──────────────────────────────────────────────────────

export const ResumoAnoFiscal: React.FC<ResumoAnoFiscalProps> = ({ user, stores, supabase }) => {

  const [selectedStore, setSelectedStore] = useState<string>('');
  const [painelData, setPainelData] = useState<PainelItem[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPedido, setExpandedPedido] = useState<string | null>(null);
  const [filtroPedidos, setFiltroPedidos] = useState<'todos' | 'exportado' | 'cadastrado' | 'rascunho'>('todos');

  // ── Lojas disponíveis ────────────────────────────────────────────────────────
  const isAdmin = useMemo(() => ['admin', 'super_admin', 'comprador'].includes(user?.role || ''), [user]);

  const activeStores = useMemo(() =>
    (stores || [])
      .filter(s => !s.status || s.status === 'active')
      .sort((a, b) => parseInt(a.number) - parseInt(b.number)),
    [stores]
  );

  // Loja inicial
  useEffect(() => {
    if (activeStores.length === 0) return;
    if (isAdmin) {
      setSelectedStore(prev => prev || activeStores[0].number);
    } else {
      const userStore = activeStores.find(s => s.id === user?.storeId);
      setSelectedStore(userStore?.number || activeStores[0].number);
    }
  }, [activeStores, isAdmin, user]);

  // ── Janela de meses (atual → +11) ───────────────────────────────────────────
  const rollingMonths = useMemo(() => {
    const now = new Date();
    let m = now.getMonth() + 1;
    let y = now.getFullYear();
    return Array.from({ length: 12 }, () => {
      const cur = { mes: m, ano: y };
      m++; if (m > 12) { m = 1; y++; }
      return cur;
    });
  }, []);

  // ── Carga de dados ───────────────────────────────────────────────────────────
  const loadData = useCallback(async (store: string, showRefresh = false) => {
    if (!store) return;
    if (showRefresh) setRefreshing(true); else setLoading(true);

    try {
      await ensureSession();

      const now = new Date();
      const cy = now.getFullYear();
      const cm = now.getMonth() + 1;

      // 1) Painel de cotas (3 anos para cobrir janela +150 dias)
      const painelPromises = [cy, cy + 1, cy + 2].map(y =>
        supabase.rpc('get_cotas_painel', {
          p_ano: y,
          p_mes_inicio: y === cy ? cm : 1,
          p_mes_fim: 12,
          p_store_number: store
        })
      );

      // 2) Pedidos da loja (via sub_orders que contêm lojas_numeros)
      const pedidosPromise = supabase
        .from('buy_orders')
        .select(`
          id, numero_pedido, marca, fornecedor, representante,
          status, central_status, fat_inicio, fat_fim,
          vencimentos, prazos, export_count, exported_at, created_at,
          email, email_representante
        `)
        .order('numero_pedido', { ascending: false });

      // 3) Sub-orders para totais
      const subOrdersPromise = supabase
        .from('buy_order_sub_orders')
        .select('order_id, total_pares, valor_bruto, lojas_numeros');

      const [painelResults, pedidosRes, subOrdersRes] = await Promise.all([
        Promise.all(painelPromises),
        pedidosPromise,
        subOrdersPromise
      ]);

      // Processar painel
      const painelCombined: PainelItem[] = painelResults.flatMap(r => r.data || []);
      setPainelData(painelCombined);

      // Processar sub_orders → mapa de totais por order_id
      const subMap = new Map<string, SubOrderSummary>();
      for (const so of (subOrdersRes.data || [])) {
        const existing = subMap.get(so.order_id);
        const lojas = so.lojas_numeros || [];
        if (existing) {
          existing.total_pares += toNumber(so.total_pares);
          existing.valor_bruto_total += toNumber(so.valor_bruto);
          lojas.forEach((l: number) => { if (!existing.lojas.includes(l)) existing.lojas.push(l); });
        } else {
          subMap.set(so.order_id, {
            order_id: so.order_id,
            total_pares: toNumber(so.total_pares),
            valor_bruto_total: toNumber(so.valor_bruto),
            lojas
          });
        }
      }

      // Filtrar pedidos da loja selecionada e enriquecer
      const storeNum = parseInt(store);
      const pedidosFiltrados: Pedido[] = (pedidosRes.data || [])
        .filter((p: Pedido) => {
          const sub = subMap.get(p.id);
          return sub ? sub.lojas.includes(storeNum) : false;
        })
        .map((p: Pedido) => {
          const sub = subMap.get(p.id);
          return {
            ...p,
            total_pares: sub?.total_pares || 0,
            valor_bruto_total: sub?.valor_bruto_total || 0,
            lojas: sub?.lojas || []
          };
        });

      setPedidos(pedidosFiltrados);

    } catch (err: any) {
      console.error('Erro Central de Cotas:', err);
      toast.error('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (selectedStore) loadData(selectedStore);
  }, [selectedStore, loadData]);

  // ── Matriz mensal com regra 90/120/150 ──────────────────────────────────────
  const matrizMensal = useMemo(() => {
    return rollingMonths.map(({ mes, ano }) => {
      const targets = [3, 4, 5].map(offset => addMonths(mes, ano, offset));

      let sumCota = 0, sumReal = 0, sumPrevisao = 0;
      targets.forEach(t => {
        const match = painelData.find(i => i.mes === t.mes && i.ano === t.ano);
        if (match) {
          sumCota += toNumber(match.valor_cota);
          sumReal += toNumber(match.pedidos_real);
          sumPrevisao += toNumber(match.pedidos_previsao);
        }
      });

      const comprometido = sumReal + sumPrevisao;
      const saldo = sumCota - comprometido;
      const pct = sumCota > 0 ? Math.round((comprometido / sumCota) * 100) : 0;

      return { mes, ano, sumCota, sumReal, sumPrevisao, comprometido, saldo, pct };
    });
  }, [rollingMonths, painelData]);

  // ── Totais dos cards ─────────────────────────────────────────────────────────
  const totais = useMemo(() => ({
    cota:          matrizMensal.reduce((a, i) => a + i.sumCota, 0),
    real:          matrizMensal.reduce((a, i) => a + i.sumReal, 0),
    previsao:      matrizMensal.reduce((a, i) => a + i.sumPrevisao, 0),
    comprometido:  matrizMensal.reduce((a, i) => a + i.comprometido, 0),
    saldo:         matrizMensal.reduce((a, i) => a + i.saldo, 0),
  }), [matrizMensal]);

  // ── Pedidos filtrados ────────────────────────────────────────────────────────
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      if (filtroPedidos === 'todos') return true;
      const s = p.status.toLowerCase();
      const cs = (p.central_status || '').toLowerCase();
      if (filtroPedidos === 'cadastrado') return s === 'exportado' && cs === 'cadastrado';
      if (filtroPedidos === 'exportado')  return s === 'exportado' && cs === 'exportado';
      if (filtroPedidos === 'rascunho')   return s !== 'exportado';
      return true;
    });
  }, [pedidos, filtroPedidos]);

  // ── Contadores para badges de filtro ────────────────────────────────────────
  const contadores = useMemo(() => ({
    todos:     pedidos.length,
    cadastrado: pedidos.filter(p => p.status === 'exportado' && p.central_status === 'cadastrado').length,
    exportado:  pedidos.filter(p => p.status === 'exportado' && p.central_status === 'exportado').length,
    rascunho:   pedidos.filter(p => p.status !== 'exportado').length,
  }), [pedidos]);

  // ── Helpers de renderização ──────────────────────────────────────────────────
  const storeName = STORE_CITIES[selectedStore] || activeStores.find(s => s.number === selectedStore)?.city || '';

  const pctBar = (pct: number) => {
    const capped = Math.min(pct, 100);
    let bg = 'bg-emerald-400';
    if (pct >= 100) bg = 'bg-red-500';
    else if (pct >= 85) bg = 'bg-amber-400';
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full rounded-full ${bg} transition-all`} style={{ width: `${capped}%` }} />
        </div>
        <span className={`text-[10px] font-black tabular-nums w-7 text-right ${pct >= 100 ? 'text-red-600' : pct >= 85 ? 'text-amber-600' : 'text-slate-500'}`}>
          {pct}%
        </span>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-10">

      {/* ── CABEÇALHO ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight">Central de Cotas</h2>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
            Janela 90/120/150 dias · {rollingMonths[0] && `${MONTH_NAMES[rollingMonths[0].mes - 1]}/${rollingMonths[0].ano} → ${MONTH_NAMES[rollingMonths[11].mes - 1]}/${rollingMonths[11].ano}`}
          </p>
        </div>
        <button
          onClick={() => loadData(selectedStore, true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* ── SELETOR DE LOJAS (admin/comprador) ────────────────────────────── */}
      {isAdmin && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
          {activeStores.map(store => {
            const sel = store.number === selectedStore;
            return (
              <button
                key={store.number}
                onClick={() => setSelectedStore(store.number)}
                className={`px-3 py-1 text-[11px] font-black rounded-lg border transition-all ${
                  sel
                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {store.number}
                {storeName && sel && <span className="ml-1 font-normal opacity-70">· {storeName}</span>}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Carregando...</p>
        </div>
      ) : (
        <>
          {/* ── BLOCO 1 — CARDS DE RESUMO ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Cota Total',     value: totais.cota,         color: 'text-slate-800',   sub: 'Orçamento 12 meses' },
              { label: 'Comprometido',   value: totais.comprometido, color: 'text-slate-700',   sub: 'Real + Previsão' },
              { label: 'Cota Real',      value: totais.real,         color: 'text-emerald-600', sub: 'Pedidos cadastrados' },
              { label: 'Cota Previsão',  value: totais.previsao,     color: 'text-blue-600',    sub: 'Não cadastrados ainda' },
              { label: 'Saldo Livre',    value: totais.saldo,        color: totais.saldo < 0 ? 'text-red-600' : 'text-emerald-600', sub: 'Disponível para compra' },
            ].map(card => (
              <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
                <p className={`text-[15px] font-black font-mono mt-1.5 leading-none ${card.color}`}>
                  {fmtShort(card.value)}
                </p>
                <p className="text-[9px] text-slate-400 mt-1.5 font-medium">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ── BLOCO 2 — MATRIZ MENSAL ───────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                Matriz de Cotas · Mês a Mês
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Mês Ref.','Cota Disponível','Cota Real','Cota Previsão','Total Comprometido','Saldo','Utilização'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrizMensal.map((row, idx) => {
                    const isCurrent = idx === 0;
                    const isNeg = row.saldo < 0;
                    const isWarn = !isNeg && row.pct >= 85;
                    return (
                      <tr
                        key={`${row.mes}-${row.ano}`}
                        className={`border-b border-slate-50 text-[12px] transition-colors ${
                          isCurrent ? 'bg-slate-800 text-white' :
                          isNeg     ? 'bg-red-50 hover:bg-red-100' :
                          isWarn    ? 'bg-amber-50 hover:bg-amber-100' :
                                      'hover:bg-slate-50'
                        }`}
                      >
                        {/* Mês */}
                        <td className="px-4 py-3 font-black whitespace-nowrap">
                          <span className={isCurrent ? 'text-white' : 'text-slate-700'}>
                            {MONTH_NAMES[row.mes - 1]}/{String(row.ano).slice(-2)}
                          </span>
                          {isCurrent && (
                            <span className="ml-2 text-[8px] font-black bg-white/20 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Atual
                            </span>
                          )}
                        </td>
                        {/* Cota */}
                        <td className={`px-4 py-3 font-mono font-bold ${isCurrent ? 'text-slate-200' : 'text-slate-700'}`}>
                          {fmtShort(row.sumCota)}
                        </td>
                        {/* Real */}
                        <td className={`px-4 py-3 font-mono font-semibold ${isCurrent ? 'text-emerald-300' : 'text-emerald-600'}`}>
                          {row.sumReal > 0 ? fmtShort(row.sumReal) : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Previsão */}
                        <td className={`px-4 py-3 font-mono font-semibold ${isCurrent ? 'text-blue-300' : 'text-blue-500'}`}>
                          {row.sumPrevisao > 0 ? fmtShort(row.sumPrevisao) : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Comprometido */}
                        <td className={`px-4 py-3 font-mono font-bold ${isCurrent ? 'text-slate-200' : 'text-slate-800'}`}>
                          {row.comprometido > 0 ? fmtShort(row.comprometido) : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Saldo */}
                        <td className={`px-4 py-3 font-mono font-black ${
                          isCurrent ? (isNeg ? 'text-red-300' : 'text-emerald-300') :
                          isNeg ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {fmt(row.saldo)}
                        </td>
                        {/* Utilização */}
                        <td className="px-4 py-3 min-w-[100px]">
                          {isCurrent ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-white/10 rounded-full h-1.5">
                                <div className="h-full bg-white/60 rounded-full" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                              </div>
                              <span className="text-[10px] font-black text-white/70 w-7 text-right">{row.pct}%</span>
                            </div>
                          ) : (
                            pctBar(row.pct)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totais */}
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 text-[11px] font-black text-slate-700">
                    <td className="px-4 py-3 uppercase tracking-wider">Total</td>
                    <td className="px-4 py-3 font-mono">{fmtShort(totais.cota)}</td>
                    <td className="px-4 py-3 font-mono text-emerald-600">{fmtShort(totais.real)}</td>
                    <td className="px-4 py-3 font-mono text-blue-500">{fmtShort(totais.previsao)}</td>
                    <td className="px-4 py-3 font-mono">{fmtShort(totais.comprometido)}</td>
                    <td className={`px-4 py-3 font-mono ${totais.saldo < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {fmt(totais.saldo)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {totais.cota > 0 ? `${Math.round((totais.comprometido / totais.cota) * 100)}%` : '0%'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── BLOCO 3 — LISTA DE PEDIDOS ────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

            {/* Header + filtros */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                Pedidos da Loja {selectedStore} {storeName && `· ${storeName}`}
              </h3>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { key: 'todos',      label: 'Todos',         dot: null },
                  { key: 'cadastrado', label: 'Cadastrado',    dot: 'bg-emerald-500' },
                  { key: 'exportado',  label: 'Aguard. Cadastro', dot: 'bg-amber-400' },
                  { key: 'rascunho',   label: 'Rascunho/Conf.', dot: 'bg-red-500' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFiltroPedidos(f.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black rounded-lg border transition-all ${
                      filtroPedidos === f.key
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {f.dot && (
                      <span className={`w-1.5 h-1.5 rounded-full ${f.dot} ${filtroPedidos === f.key ? 'opacity-100' : ''}`} />
                    )}
                    {f.label}
                    <span className={`text-[9px] rounded px-1 py-0.5 ${filtroPedidos === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {contadores[f.key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {pedidosFiltrados.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Nenhum pedido encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[780px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['','#','Marca / Fornecedor','Faturamento','Vencimentos','Pares','Valor Bruto','Status',''].map((h, i) => (
                        <th key={i} className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosFiltrados.map(ped => {
                      const sem = getSemaforo(ped.status, ped.central_status);
                      const isExpanded = expandedPedido === ped.id;
                      const canEmail = ped.status === 'exportado';
                      const emailDest = ped.email_representante || ped.email || '';
                      const venc = Array.isArray(ped.vencimentos) ? ped.vencimentos : [];
                      const prazos = Array.isArray(ped.prazos) ? ped.prazos : [];

                      return (
                        <React.Fragment key={ped.id}>
                          <tr
                            className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors text-[12px] cursor-pointer"
                            onClick={() => setExpandedPedido(isExpanded ? null : ped.id)}
                          >
                            {/* Dot semáforo */}
                            <td className="pl-4 pr-2 py-3">
                              <span className={`w-2.5 h-2.5 rounded-full inline-block ${sem.dot}`} title={sem.label} />
                            </td>

                            {/* Número */}
                            <td className="px-3 py-3 font-black text-slate-700 tabular-nums">
                              #{ped.numero_pedido}
                            </td>

                            {/* Marca / Fornecedor */}
                            <td className="px-3 py-3">
                              <p className="font-black text-slate-800 text-[12px] uppercase leading-none">{ped.marca}</p>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{ped.fornecedor}</p>
                            </td>

                            {/* Faturamento */}
                            <td className="px-3 py-3 text-slate-500 font-semibold whitespace-nowrap text-[11px]">
                              {fmtDate(ped.fat_inicio)}
                              {ped.fat_fim && ped.fat_fim !== ped.fat_inicio && (
                                <span className="text-slate-300"> → {fmtDate(ped.fat_fim)}</span>
                              )}
                            </td>

                            {/* Vencimentos */}
                            <td className="px-3 py-3 text-[11px]">
                              {venc.length > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  {venc.map((v, i) => (
                                    <span key={i} className="text-slate-500 font-mono whitespace-nowrap">
                                      <span className="text-slate-300 mr-1">{prazos[i] ? `${prazos[i]}d` : ''}</span>
                                      {fmtDate(v)}
                                    </span>
                                  ))}
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>

                            {/* Pares */}
                            <td className="px-3 py-3 font-mono font-bold text-slate-700 text-right tabular-nums">
                              {(ped.total_pares || 0).toLocaleString('pt-BR')}
                            </td>

                            {/* Valor bruto */}
                            <td className="px-3 py-3 font-mono font-black text-slate-800 text-right tabular-nums whitespace-nowrap">
                              {fmt(ped.valor_bruto_total || 0)}
                            </td>

                            {/* Badge status */}
                            <td className="px-3 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${sem.bg} ${sem.color} ${sem.border}`}>
                                <span className={`w-1 h-1 rounded-full ${sem.dot}`} />
                                {sem.label}
                              </span>
                            </td>

                            {/* Expand toggle */}
                            <td className="pr-4 py-3 text-slate-300">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </td>
                          </tr>

                          {/* Linha expandida */}
                          {isExpanded && (
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                              <td colSpan={9} className="px-8 py-4">
                                <div className="flex flex-wrap gap-6 items-start text-[11px]">

                                  {/* Detalhes */}
                                  <div className="space-y-1.5 min-w-[180px]">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Detalhes</p>
                                    {ped.representante && (
                                      <p className="text-slate-600"><span className="font-bold text-slate-400">Representante:</span> {ped.representante}</p>
                                    )}
                                    <p className="text-slate-600">
                                      <span className="font-bold text-slate-400">Exportações:</span> {ped.export_count || 0}×
                                      {ped.exported_at && <span className="ml-2 text-slate-400">(último: {fmtDate(ped.exported_at.split('T')[0])})</span>}
                                    </p>
                                    <p className="text-slate-600">
                                      <span className="font-bold text-slate-400">Lojas:</span>{' '}
                                      {(ped.lojas || []).sort((a,b) => a-b).join(', ') || '—'}
                                    </p>
                                  </div>

                                  {/* Prazos e vencimentos detalhados */}
                                  {venc.length > 0 && (
                                    <div className="space-y-1.5 min-w-[160px]">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Parcelas</p>
                                      {venc.map((v, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                          <span className="w-8 text-center bg-slate-200 text-slate-600 rounded font-black text-[9px] py-0.5">
                                            {prazos[i] ? `${prazos[i]}d` : `${i+1}ª`}
                                          </span>
                                          <span className="font-mono text-slate-600">{fmtDate(v)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Ação de e-mail */}
                                  <div className="ml-auto">
                                    {canEmail ? (
                                      <a
                                        href={`mailto:${emailDest}?subject=Pedido%20%23${ped.numero_pedido}%20${encodeURIComponent(ped.marca)}&body=Segue%20o%20pedido%20exportado%20para%20cadastro%20na%20central.`}
                                        onClick={e => e.stopPropagation()}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-[11px] font-black hover:bg-slate-700 transition-colors"
                                      >
                                        <Mail className="w-3.5 h-3.5" />
                                        Enviar para Central
                                      </a>
                                    ) : (
                                      <div className="text-[10px] text-slate-400 font-semibold bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 max-w-[180px] text-center">
                                        Exporte o pedido antes de enviar à central
                                      </div>
                                    )}
                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rodapé da lista */}
            {pedidosFiltrados.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>
                  {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? 's' : ''}
                  {filtroPedidos !== 'todos' && ` · filtro: ${filtroPedidos}`}
                </span>
                <span className="font-mono font-black text-slate-700">
                  Total: {fmt(pedidosFiltrados.reduce((a, p) => a + (p.valor_bruto_total || 0), 0))}
                  <span className="ml-3 font-normal text-slate-400">
                    {pedidosFiltrados.reduce((a, p) => a + (p.total_pares || 0), 0).toLocaleString('pt-BR')} pares
                  </span>
                </span>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
};

export default ResumoAnoFiscal;