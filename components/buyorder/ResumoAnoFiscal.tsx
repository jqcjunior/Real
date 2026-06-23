import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ensureSession } from '../../services/authService';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ChevronDown, ChevronUp, Mail, Store } from 'lucide-react';

// ─── Constantes ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// Lista definitiva de lojas — hardcoded para garantir exibição independente da prop stores
const TODAS_LOJAS: { number: string; city: string }[] = [
  { number: "5",   city: "Petrolina"     },
  { number: "8",   city: "Catu"          },
  { number: "9",   city: "P. Seguro"     },
  { number: "26",  city: "Cruz das Almas"},
  { number: "31",  city: "Euclides"      },
  { number: "34",  city: "Brumado"       },
  { number: "40",  city: "Jequié"        },
  { number: "43",  city: "Ipiaú"         },
  { number: "44",  city: "Livramento"    },
  { number: "45",  city: "Brumado 2"     },
  { number: "50",  city: "Euclides 2"    },
  { number: "56",  city: "T. Freitas"    },
  { number: "72",  city: "Eunápolis"     },
  { number: "88",  city: "Jequié 2"      },
  { number: "96",  city: "Itapetinga"    },
  { number: "100", city: "L. Freitas"    },
  { number: "102", city: "Itamaraju"     },
  { number: "109", city: "C. Jacuípe"    },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const toNumber = (v: any): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const fmt = (v: number): string => {
  const abs = Math.abs(v);
  const s = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '−R$ ' : 'R$ ') + s;
};

const fmtK = (v: number): string => {
  const abs = Math.abs(v);
  const s = abs.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (v < 0 ? '−R$ ' : 'R$ ') + s;
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

// ─── Semáforo ─────────────────────────────────────────────────────────────────
//  🟢 Verde   = exportado + central_status: cadastrado  → na central
//  🟡 Amarelo = exportado + central_status: exportado   → aguard. cadastro
//  🔴 Vermelho = rascunho | confirmado                  → só digitado

interface Sem { dot: string; bg: string; border: string; color: string; label: string; }

const getSem = (status: string, cs: string): Sem => {
  const s = (status || '').toLowerCase();
  const c = (cs || '').toLowerCase();
  if (s === 'exportado' && c === 'cadastrado')
    return { dot:'bg-emerald-500', bg:'bg-emerald-50', border:'border-emerald-200', color:'text-emerald-700', label:'Cadastrado' };
  if (s === 'exportado' && c === 'exportado')
    return { dot:'bg-amber-400',   bg:'bg-amber-50',   border:'border-amber-200',   color:'text-amber-700',   label:'Ag. Cadastro' };
  return   { dot:'bg-red-500',     bg:'bg-red-50',     border:'border-red-200',     color:'text-red-700',     label: s === 'confirmado' ? 'Confirmado' : 'Rascunho' };
};

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface PainelItem {
  mes: number; ano: number; store_number: string;
  valor_cota: number; pedidos_real: number; pedidos_previsao: number;
}

interface Pedido {
  id: string; numero_pedido: number; marca: string; fornecedor: string;
  representante: string | null; status: string; central_status: string;
  fat_inicio: string; fat_fim: string; vencimentos: string[]; prazos: number[];
  export_count: number; exported_at: string | null; created_at: string;
  email: string | null; email_representante: string | null;
  total_pares?: number; valor_bruto_total?: number; lojas?: number[];
}

interface ResumoAnoFiscalProps { user: any; stores: any[]; supabase: any; }

// ─── Componente ───────────────────────────────────────────────────────────────

export const ResumoAnoFiscal: React.FC<ResumoAnoFiscalProps> = ({ user, stores, supabase }) => {

  const [selectedStore, setSelectedStore] = useState<string>('5');
  const [painelData, setPainelData]       = useState<PainelItem[]>([]);
  const [pedidos, setPedidos]             = useState<Pedido[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [filtro, setFiltro]               = useState<'todos'|'cadastrado'|'exportado'|'rascunho'>('todos');

  // Rola permissão: gerente fica preso na própria loja
  const isAdmin = useMemo(() =>
    ['admin','super_admin','comprador'].includes(user?.role || ''), [user]);

  // Lojas disponíveis: usa TODAS_LOJAS, mas cruza com stores prop se disponível para pegar status
  const lojas = useMemo(() => {
    if (!stores || stores.length === 0) return TODAS_LOJAS;
    const ativos = new Set(
      stores
        .filter(s => !s.status || s.status === 'active')
        .map(s => String(s.number))
    );
    // se stores veio com dados, filtra; senão usa hardcoded completo
    return ativos.size > 0
      ? TODAS_LOJAS.filter(l => ativos.has(l.number))
      : TODAS_LOJAS;
  }, [stores]);

  // Loja inicial — gerente fica na sua, admin começa na 5
  useEffect(() => {
    if (isAdmin) {
      setSelectedStore(prev => prev || '5');
    } else if (user?.storeId && stores?.length) {
      const match = stores.find((s: any) => s.id === user.storeId);
      if (match) setSelectedStore(String(match.number));
    }
  }, [isAdmin, user, stores]);

  // Janela de 12 meses rolantes
  const rollingMonths = useMemo(() => {
    const now = new Date();
    let m = now.getMonth() + 1, y = now.getFullYear();
    return Array.from({ length: 12 }, () => {
      const cur = { mes: m, ano: y };
      if (++m > 12) { m = 1; y++; }
      return cur;
    });
  }, []);

  // Info da loja selecionada
  const lojaInfo = useMemo(() =>
    TODAS_LOJAS.find(l => l.number === selectedStore), [selectedStore]);

  // ── Carga ────────────────────────────────────────────────────────────────────
  const loadData = useCallback(async (store: string, isRefresh = false) => {
    if (!store) return;
    isRefresh ? setRefreshing(true) : setLoading(true);

    try {
      await ensureSession();

      const now = new Date();
      const cy = now.getFullYear();
      const cm = now.getMonth() + 1;

      // Painel cotas — 3 anos de cobertura
      const painelP = [cy, cy+1, cy+2].map(y =>
        supabase.rpc('get_cotas_painel', {
          p_ano: y,
          p_mes_inicio: y === cy ? cm : 1,
          p_mes_fim: 12,
          p_store_number: store
        })
      );

      // Pedidos — todos; filtraremos por loja via sub_orders
      const pedidosP = supabase
        .from('buy_orders')
        .select('id,numero_pedido,marca,fornecedor,representante,status,central_status,fat_inicio,fat_fim,vencimentos,prazos,export_count,exported_at,created_at,email,email_representante')
        .order('numero_pedido', { ascending: false });

      // Sub-orders — para identificar lojas e totais
      const subP = supabase
        .from('buy_order_sub_orders')
        .select('order_id,total_pares,valor_bruto,lojas_numeros');

      const [[...painelRes], pedidosRes, subRes] = await Promise.all([
        Promise.all(painelP),
        pedidosP,
        subP
      ]);

      // Painel
      setPainelData(painelRes.flatMap((r: any) => r.data || []));

      // Mapa de sub_orders por order_id
      const storeNum = parseInt(store, 10);
      type SubAgg = { total_pares: number; valor: number; lojas: Set<number> };
      const subMap = new Map<string, SubAgg>();

      for (const so of (subRes.data || [])) {
        const lojas: number[] = Array.isArray(so.lojas_numeros) ? so.lojas_numeros : [];
        const agg = subMap.get(so.order_id);
        if (agg) {
          agg.total_pares += toNumber(so.total_pares);
          agg.valor       += toNumber(so.valor_bruto);
          lojas.forEach(l => agg.lojas.add(l));
        } else {
          subMap.set(so.order_id, {
            total_pares: toNumber(so.total_pares),
            valor:       toNumber(so.valor_bruto),
            lojas:       new Set(lojas)
          });
        }
      }

      // Pedidos da loja selecionada
      const filtered: Pedido[] = (pedidosRes.data || [])
        .filter((p: any) => {
          const agg = subMap.get(p.id);
          return agg ? agg.lojas.has(storeNum) : false;
        })
        .map((p: any) => {
          const agg = subMap.get(p.id)!;
          return {
            ...p,
            total_pares:     agg.total_pares,
            valor_bruto_total: agg.valor,
            lojas:           Array.from(agg.lojas).sort((a, b) => a - b)
          };
        });

      setPedidos(filtered);

    } catch (err: any) {
      console.error('Erro Central de Cotas:', err);
      toast.error('Erro ao carregar: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => { if (selectedStore) loadData(selectedStore); }, [selectedStore, loadData]);

  // ── Matriz mensal 90/120/150 ──────────────────────────────────────────────────
  const matriz = useMemo(() =>
    rollingMonths.map(({ mes, ano }) => {
      let cota = 0, real = 0, prev = 0;
      [3,4,5].forEach(off => {
        const t = addMonths(mes, ano, off);
        const m = painelData.find(i => i.mes === t.mes && i.ano === t.ano);
        if (m) { cota += toNumber(m.valor_cota); real += toNumber(m.pedidos_real); prev += toNumber(m.pedidos_previsao); }
      });
      const comp = real + prev;
      const saldo = cota - comp;
      const pct = cota > 0 ? Math.round((comp / cota) * 100) : 0;
      return { mes, ano, cota, real, prev, comp, saldo, pct };
    }),
  [rollingMonths, painelData]);

  // Totais
  const totais = useMemo(() => ({
    cota:  matriz.reduce((a, r) => a + r.cota, 0),
    real:  matriz.reduce((a, r) => a + r.real, 0),
    prev:  matriz.reduce((a, r) => a + r.prev, 0),
    comp:  matriz.reduce((a, r) => a + r.comp, 0),
    saldo: matriz.reduce((a, r) => a + r.saldo, 0),
  }), [matriz]);

  // Pedidos filtrados
  const pedidosFiltrados = useMemo(() => pedidos.filter(p => {
    if (filtro === 'todos')      return true;
    if (filtro === 'cadastrado') return p.status === 'exportado' && p.central_status === 'cadastrado';
    if (filtro === 'exportado')  return p.status === 'exportado' && p.central_status === 'exportado';
    if (filtro === 'rascunho')   return p.status !== 'exportado';
    return true;
  }), [pedidos, filtro]);

  const cnt = useMemo(() => ({
    todos:     pedidos.length,
    cadastrado: pedidos.filter(p => p.status==='exportado' && p.central_status==='cadastrado').length,
    exportado:  pedidos.filter(p => p.status==='exportado' && p.central_status==='exportado').length,
    rascunho:   pedidos.filter(p => p.status!=='exportado').length,
  }), [pedidos]);

  // Barra de utilização
  const PctBar = ({ pct }: { pct: number }) => {
    const cap = Math.min(pct, 100);
    const color = pct >= 100 ? 'bg-red-500' : pct >= 85 ? 'bg-amber-400' : 'bg-emerald-400';
    return (
      <div className="flex items-center gap-2 min-w-[90px]">
        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${cap}%` }} />
        </div>
        <span className={`text-[10px] font-black tabular-nums w-6 text-right shrink-0
          ${pct>=100?'text-red-600':pct>=85?'text-amber-600':'text-slate-400'}`}>
          {pct}%
        </span>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-12">

      {/* ══ CABEÇALHO + BOTÃO ATUALIZAR ═══════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight">Central de Cotas</h2>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            Janela 90/120/150 dias
            {rollingMonths.length === 12 && (
              <> · {MONTH_NAMES[rollingMonths[0].mes-1]}/{rollingMonths[0].ano} → {MONTH_NAMES[rollingMonths[11].mes-1]}/{rollingMonths[11].ano}</>
            )}
          </p>
        </div>
        <button
          onClick={() => loadData(selectedStore, true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* ══ SELETOR DE LOJAS — sempre visível para admin/comprador ══════════════ */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Título da seção */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <Store className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Selecionar Loja
            </span>
            {lojaInfo && (
              <span className="ml-auto text-[11px] font-black text-slate-600">
                Loja {selectedStore} · {lojaInfo.city}
              </span>
            )}
          </div>

          {/* Grid de lojas */}
          <div className="p-3 flex flex-wrap gap-2">
            {lojas.map(loja => {
              const sel = loja.number === selectedStore;
              return (
                <button
                  key={loja.number}
                  onClick={() => { setSelectedStore(loja.number); setExpandedId(null); }}
                  title={loja.city}
                  className={`flex flex-col items-center px-3 py-2 rounded-lg border text-center transition-all min-w-[52px] ${
                    sel
                      ? 'bg-slate-800 border-slate-800 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-[13px] font-black leading-none ${sel ? 'text-white' : 'text-slate-700'}`}>
                    {loja.number}
                  </span>
                  <span className={`text-[9px] font-medium leading-none mt-1 max-w-[48px] truncate ${sel ? 'text-slate-300' : 'text-slate-400'}`}>
                    {loja.city}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ LOADING ═══════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-slate-300" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carregando dados...</p>
        </div>
      ) : (
        <>

          {/* ══ BLOCO 1 — CARDS DE RESUMO ═════════════════════════════════════ */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {([
              { k:'Cota Total',    v:totais.cota,  color:'text-slate-800', sub:'Orçamento 12 meses' },
              { k:'Comprometido',  v:totais.comp,  color:'text-slate-700', sub:'Real + Previsão' },
              { k:'Cota Real',     v:totais.real,  color:'text-emerald-600', sub:'Pedidos cadastrados' },
              { k:'Cota Previsão', v:totais.prev,  color:'text-blue-600', sub:'Não cadastrados ainda' },
              { k:'Saldo Livre',   v:totais.saldo, color: totais.saldo < 0 ? 'text-red-600' : 'text-emerald-600', sub:'Disponível para compra' },
            ] as const).map(c => (
              <div key={c.k} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{c.k}</p>
                <p className={`text-[15px] font-black font-mono mt-2 leading-none ${c.color}`}>
                  {fmtK(c.v)}
                </p>
                <p className="text-[9px] text-slate-400 mt-1.5 font-medium">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* ══ BLOCO 2 — MATRIZ MENSAL ═══════════════════════════════════════ */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Matriz de Cotas · Mês a Mês
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">
                Loja {selectedStore} {lojaInfo ? `· ${lojaInfo.city}` : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[680px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    {[
                      'Mês Ref.','Cota Disponível','Cota Real',
                      'Cota Previsão','Total Comprometido','Saldo','Utilização'
                    ].map(h => (
                      <th key={h} className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matriz.map((row, idx) => {
                    const cur  = idx === 0;
                    const neg  = row.saldo < 0;
                    const warn = !neg && row.pct >= 85;
                    return (
                      <tr key={`${row.mes}-${row.ano}`}
                          className={`border-b text-[12px] transition-colors ${
                            cur  ? 'bg-slate-800' :
                            neg  ? 'bg-red-50 hover:bg-red-100/70' :
                            warn ? 'bg-amber-50 hover:bg-amber-100/70' :
                                   'hover:bg-slate-50'
                          }`}>

                        {/* Mês */}
                        <td className="px-4 py-3.5 font-black whitespace-nowrap">
                          <span className={cur ? 'text-white' : 'text-slate-700'}>
                            {MONTH_NAMES[row.mes-1]}/{String(row.ano).slice(-2)}
                          </span>
                          {cur && (
                            <span className="ml-2 text-[8px] font-black bg-white/20 text-white/80 px-1.5 py-0.5 rounded uppercase">
                              Atual
                            </span>
                          )}
                        </td>

                        {/* Cota */}
                        <td className={`px-4 py-3.5 font-mono font-semibold ${cur?'text-slate-300':'text-slate-600'}`}>
                          {fmtK(row.cota)}
                        </td>

                        {/* Real */}
                        <td className={`px-4 py-3.5 font-mono font-semibold ${cur?'text-emerald-300':'text-emerald-600'}`}>
                          {row.real > 0 ? fmtK(row.real) : <span className={cur?'text-slate-600':'text-slate-300'}>—</span>}
                        </td>

                        {/* Previsão */}
                        <td className={`px-4 py-3.5 font-mono font-semibold ${cur?'text-blue-300':'text-blue-500'}`}>
                          {row.prev > 0 ? fmtK(row.prev) : <span className={cur?'text-slate-600':'text-slate-300'}>—</span>}
                        </td>

                        {/* Comprometido */}
                        <td className={`px-4 py-3.5 font-mono font-bold ${cur?'text-slate-200':'text-slate-800'}`}>
                          {row.comp > 0 ? fmtK(row.comp) : <span className={cur?'text-slate-600':'text-slate-300'}>—</span>}
                        </td>

                        {/* Saldo */}
                        <td className={`px-4 py-3.5 font-mono font-black ${
                          cur  ? (neg ? 'text-red-300' : 'text-emerald-300') :
                          neg  ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {fmt(row.saldo)}
                        </td>

                        {/* Utilização */}
                        <td className="px-4 py-3.5">
                          {cur ? (
                            <div className="flex items-center gap-2 min-w-[90px]">
                              <div className="flex-1 bg-white/10 rounded-full h-1.5">
                                <div className="h-full bg-white/50 rounded-full" style={{ width:`${Math.min(row.pct,100)}%` }} />
                              </div>
                              <span className="text-[10px] font-black text-white/60 w-6 text-right">{row.pct}%</span>
                            </div>
                          ) : (
                            <PctBar pct={row.pct} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 text-[11px] font-black text-slate-700">
                    <td className="px-4 py-3 uppercase tracking-wider text-slate-500">Total</td>
                    <td className="px-4 py-3 font-mono">{fmtK(totais.cota)}</td>
                    <td className="px-4 py-3 font-mono text-emerald-600">{fmtK(totais.real)}</td>
                    <td className="px-4 py-3 font-mono text-blue-500">{fmtK(totais.prev)}</td>
                    <td className="px-4 py-3 font-mono">{fmtK(totais.comp)}</td>
                    <td className={`px-4 py-3 font-mono ${totais.saldo<0?'text-red-600':'text-emerald-600'}`}>
                      {fmt(totais.saldo)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {totais.cota > 0 ? `${Math.round((totais.comp/totais.cota)*100)}%` : '0%'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ══ BLOCO 3 — LISTA DE PEDIDOS ════════════════════════════════════ */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

            {/* Header + filtros semáforo */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-auto">
                Pedidos · Loja {selectedStore} {lojaInfo ? `· ${lojaInfo.city}` : ''}
              </h3>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { k:'todos',      label:'Todos',          dot:null           },
                  { k:'cadastrado', label:'Cadastrado',     dot:'bg-emerald-500'},
                  { k:'exportado',  label:'Ag. Cadastro',   dot:'bg-amber-400' },
                  { k:'rascunho',   label:'Rascunho/Conf.', dot:'bg-red-500'   },
                ] as const).map(f => (
                  <button
                    key={f.k}
                    onClick={() => setFiltro(f.k)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-black rounded-lg border transition-all ${
                      filtro === f.k
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
                    {f.label}
                    <span className={`text-[9px] px-1 rounded ${filtro===f.k?'bg-white/20 text-white':'bg-slate-100 text-slate-400'}`}>
                      {cnt[f.k]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabela de pedidos */}
            {pedidosFiltrados.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">
                  Nenhum pedido encontrado para esta loja
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[820px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="w-8 pl-4 py-2.5" />
                      {['#','Marca / Fornecedor','Faturamento','Vencimentos','Pares','Valor Bruto','Status',''].map(h => (
                        <th key={h} className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosFiltrados.map(ped => {
                      const sem     = getSem(ped.status, ped.central_status);
                      const exp     = expandedId === ped.id;
                      const canMail = ped.status === 'exportado';
                      const venc    = Array.isArray(ped.vencimentos) ? ped.vencimentos : [];
                      const prazos  = Array.isArray(ped.prazos)      ? ped.prazos      : [];
                      const emailTo = ped.email_representante || ped.email || '';

                      return (
                        <React.Fragment key={ped.id}>
                          <tr
                            onClick={() => setExpandedId(exp ? null : ped.id)}
                            className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors text-[12px] cursor-pointer"
                          >
                            {/* Semáforo dot */}
                            <td className="pl-4 py-3.5">
                              <span className={`w-2.5 h-2.5 rounded-full inline-block ${sem.dot}`} title={sem.label} />
                            </td>

                            {/* Número */}
                            <td className="px-3 py-3.5 font-black text-slate-700 tabular-nums whitespace-nowrap">
                              #{ped.numero_pedido}
                            </td>

                            {/* Marca / Fornecedor */}
                            <td className="px-3 py-3.5 min-w-[140px]">
                              <p className="font-black text-slate-800 text-[12px] uppercase leading-tight">{ped.marca}</p>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-tight">{ped.fornecedor}</p>
                            </td>

                            {/* Faturamento */}
                            <td className="px-3 py-3.5 text-slate-500 font-medium whitespace-nowrap text-[11px]">
                              {fmtDate(ped.fat_inicio)}
                              {ped.fat_fim && ped.fat_fim !== ped.fat_inicio && (
                                <span className="text-slate-300"> › {fmtDate(ped.fat_fim)}</span>
                              )}
                            </td>

                            {/* Vencimentos */}
                            <td className="px-3 py-3.5 text-[11px]">
                              {venc.length > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  {venc.map((v, i) => (
                                    <span key={i} className="font-mono text-slate-500 whitespace-nowrap">
                                      {prazos[i] ? <span className="text-slate-300 mr-1">{prazos[i]}d</span> : null}
                                      {fmtDate(v)}
                                    </span>
                                  ))}
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>

                            {/* Pares */}
                            <td className="px-3 py-3.5 font-mono font-bold text-slate-700 text-right tabular-nums">
                              {(ped.total_pares||0).toLocaleString('pt-BR')}
                            </td>

                            {/* Valor */}
                            <td className="px-3 py-3.5 font-mono font-black text-slate-800 text-right tabular-nums whitespace-nowrap">
                              {fmt(ped.valor_bruto_total||0)}
                            </td>

                            {/* Badge */}
                            <td className="px-3 py-3.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border ${sem.bg} ${sem.color} ${sem.border}`}>
                                <span className={`w-1 h-1 rounded-full ${sem.dot}`} />
                                {sem.label}
                              </span>
                            </td>

                            {/* Toggle */}
                            <td className="pr-4 py-3.5 text-slate-300">
                              {exp ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                            </td>
                          </tr>

                          {/* Linha expandida */}
                          {exp && (
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                              <td colSpan={9} className="px-8 py-4">
                                <div className="flex flex-wrap gap-8 items-start text-[11px]">

                                  {/* Detalhes gerais */}
                                  <div className="space-y-1.5 min-w-[180px]">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Detalhes</p>
                                    {ped.representante && (
                                      <p className="text-slate-600"><span className="font-bold text-slate-400">Representante: </span>{ped.representante}</p>
                                    )}
                                    <p className="text-slate-600">
                                      <span className="font-bold text-slate-400">Exportações: </span>
                                      {ped.export_count||0}×
                                      {ped.exported_at && <span className="text-slate-400 ml-2">último: {fmtDate(ped.exported_at.substring(0,10))}</span>}
                                    </p>
                                    {(ped.lojas||[]).length > 0 && (
                                      <p className="text-slate-600">
                                        <span className="font-bold text-slate-400">Lojas do pedido: </span>
                                        {(ped.lojas||[]).join(' · ')}
                                      </p>
                                    )}
                                  </div>

                                  {/* Parcelas */}
                                  {venc.length > 0 && (
                                    <div className="space-y-1.5 min-w-[150px]">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Parcelas</p>
                                      {venc.map((v, i) => (
                                        <div key={i} className="flex items-center gap-2.5">
                                          <span className="w-9 text-center bg-slate-200 text-slate-600 rounded text-[9px] font-black py-0.5">
                                            {prazos[i] ? `${prazos[i]}d` : `${i+1}ª`}
                                          </span>
                                          <span className="font-mono text-slate-600">{fmtDate(v)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Botão e-mail */}
                                  <div className="ml-auto self-center">
                                    {canMail ? (
                                      <a
                                        href={`mailto:${emailTo}?subject=Pedido%20%23${ped.numero_pedido}%20${encodeURIComponent(ped.marca)}&body=Segue%20pedido%20exportado%20para%20cadastro%20na%20central.`}
                                        onClick={e => e.stopPropagation()}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-[11px] font-black hover:bg-slate-700 transition-colors"
                                      >
                                        <Mail className="w-3.5 h-3.5" />
                                        Enviar para Central
                                      </a>
                                    ) : (
                                      <p className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-center max-w-[160px]">
                                        Exporte antes de enviar à central
                                      </p>
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

            {/* Rodapé totais */}
            {pedidosFiltrados.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>
                  {pedidosFiltrados.length} pedido{pedidosFiltrados.length!==1?'s':''}
                  {filtro !== 'todos' && <span className="ml-1 text-slate-400">· filtro: {filtro}</span>}
                </span>
                <span className="font-black font-mono text-slate-700">
                  {fmt(pedidosFiltrados.reduce((a,p) => a+(p.valor_bruto_total||0), 0))}
                  <span className="ml-3 font-normal text-slate-400">
                    {pedidosFiltrados.reduce((a,p) => a+(p.total_pares||0), 0).toLocaleString('pt-BR')} pares
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