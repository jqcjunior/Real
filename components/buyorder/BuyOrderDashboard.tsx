import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Package, Store as StoreIcon, Activity, BarChart3, Tag, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';

interface DashboardSummary {
  total_pares: number;
  total_unidades: number;
  valor_total: number;
}

interface TypeStat {
  tipo: string;
  pares: number;
  valor: number;
  percentual: number;
  modelos: ModelStat[];
}

interface ModelStat {
  subtipo?: string;
  modelo: string;
  pares: number;
  valor: number;
  percentual: number;
  pares_por_loja?: Record<number, number>;
  valor_por_loja?: Record<number, number>;
}

interface StoreStat {
  loja: string;
  cidade: string;
  pares: number;
  unidades: number;
  valor: number;
  pedidos: number;
}

interface BrandStat {
  marca: string;
  pares: number;
  valor: number;
  percentual: number;
}

// Estrutura interna de agregação por marca (com por loja)
interface BrandAggEntry {
  pares: number;
  valor: number;
  pares_por_loja: Map<number, number>;
  valor_por_loja: Map<number, number>;
}

const LOJAS = [5, 8, 9, 26, 31, 34, 40, 43, 44, 45, 50, 56, 72, 88, 96, 100, 102, 109];

export default function BuyOrderDashboard({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [userStoreNumber, setUserStoreNumber] = useState<number | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [typeStats, setTypeStats] = useState<TypeStat[]>([]);
  const [storeStats, setStoreStats] = useState<StoreStat[]>([]);
  // brandAggData guarda os dados brutos para recalcular brandStats quando lojaFiltro muda
  const [brandAggData, setBrandAggData] = useState<Map<string, BrandAggEntry>>(new Map());
  const [brandStats, setBrandStats] = useState<BrandStat[]>([]);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [lojaFiltro, setLojaFiltro] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState<3 | 6>(3);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const [categoriaParams, setCategoriaParams] = useState<{
    feminino_pct: number;
    masculino_pct: number;
    infantil_menina_pct: number;
    infantil_menino_pct: number;
    acessorio_pct: number;
    cota_valor: number;
  } | null>(null);

  useEffect(() => {
    const fetchCategoriaParams = async () => {
      const storeNum = lojaFiltro !== null
        ? String(lojaFiltro)
        : userStoreNumber !== null
          ? String(userStoreNumber)
          : null;

      if (!storeNum) { setCategoriaParams(null); return; }

      const currentMonth = new Date().getMonth() + 1;
      const currentYear  = new Date().getFullYear();

      const { data } = await supabase
        .from('buyorder_parameters_store')
        .select('feminino_pct, masculino_pct, infantil_menina_pct, infantil_menino_pct, acessorio_pct, cota_valor')
        .eq('store_number', storeNum)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .maybeSingle();

      setCategoriaParams(data ? {
        feminino_pct:        Number(data.feminino_pct        || 0),
        masculino_pct:       Number(data.masculino_pct       || 0),
        infantil_menina_pct: Number(data.infantil_menina_pct || 0),
        infantil_menino_pct: Number(data.infantil_menino_pct || 0),
        acessorio_pct:       Number(data.acessorio_pct       || 0),
        cota_valor:          Number(data.cota_valor           || 0),
      } : null);
    };
    fetchCategoriaParams();
  }, [lojaFiltro, userStoreNumber]);

  // ── Recalcular brandStats sempre que lojaFiltro ou brandAggData mudar ──
  useEffect(() => {
    if (brandAggData.size === 0) return;

    // totalPares e totalUnidades globais (sem filtro de loja) para o percentual
    const totalGlobal = Array.from(brandAggData.values()).reduce((s, a) => s + a.pares, 0);

    const brStats: BrandStat[] = Array.from(brandAggData.entries())
      .map(([marca, agg]) => {
        const pares = Math.round(lojaFiltro !== null
          ? (agg.pares_por_loja.get(lojaFiltro) || 0)
          : agg.pares);
        const valor = lojaFiltro !== null
          ? (agg.valor_por_loja.get(lojaFiltro) || 0)
          : agg.valor;
        return {
          marca: marca || 'SEM MARCA',
          pares,
          valor,
          percentual: totalGlobal > 0 ? (pares / totalGlobal) * 100 : 0,
        };
      })
      .filter(b => b.pares > 0)
      .sort((a, b) => b.pares - a.pares)
      .slice(0, 18);

    setBrandStats(brStats);
  }, [lojaFiltro, brandAggData]);

  useEffect(() => {
    async function fetchStoreNumber() {
      if (!user?.storeId || user.role === 'ADMIN') { setUserStoreNumber(null); return; }
      const { data } = await supabase.from('stores').select('number').eq('id', user.storeId).single();
      if (data?.number) {
        const num = parseInt(data.number);
        setUserStoreNumber(num);
        // ✅ FIX: Ativar filtro automaticamente para gerente
        // Sem isso, lojaFiltro ficava null e os cards/totais mostravam dados de TODAS as lojas
        setLojaFiltro(num);
      }
    }
    fetchStoreNumber();
  }, [user]);

  useEffect(() => { fetchData(); }, [userStoreNumber]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();

      // ============================================================
      // 🚨 ATENÇÃO: NUNCA FAZER JOIN ENTRE buy_order_items E buy_order_sub_orders
      // Isso causa multiplicação de valores. Este padrão de queries separadas
      // foi definido para evitar esse bug. NÃO ALTERE esta estrutura.
      // ============================================================

      const { data: orders, error: oError } = await supabase
        .from('buy_orders')
        .select('id, marca, status, created_at, desconto')
        .in('status', ['confirmado', 'exportado'])
        .gte('created_at', `${currentYear}-01-01T00:00:00.000Z`)
        .lte('created_at', `${currentYear}-12-31T23:59:59.999Z`);

      if (oError) throw oError;

      const orderIds = (orders || []).map(o => o.id);

      const { data: allItems } = await supabase
        .from('buy_order_items')
        .select(`
          id,
          order_id, 
          total_pares, 
          custo, 
          tipo, 
          modelo, 
          grades,
          buy_order_item_suborder_grades (
            sub_order_num
          )
        `)
        .in('order_id', orderIds);

      const { data: allSubOrders } = await supabase
        .from('buy_order_sub_orders')
        .select('order_id, sub_order_num, lojas_numeros, total_pares, valor_bruto')
        .in('order_id', orderIds);

      // ===== QUERY 4: Grade-SubOrder links (para distribuição correta de acessórios) =====
      const { data: itemSubGrades } = await supabase
        .from('buy_order_item_suborder_grades')
        .select('item_id, sub_order_num, grade_letra');

      // Criar lookup Map: item_id -> Map<sub_order_num, grade_letra>
      const gradeMap = new Map<string, Map<number, string>>();
      (itemSubGrades || []).forEach((g: any) => {
        if (!gradeMap.has(g.item_id)) gradeMap.set(g.item_id, new Map());
        gradeMap.get(g.item_id)!.set(Number(g.sub_order_num), g.grade_letra);
      });

      const itemsByOrder = new Map<string, any[]>();
      (allItems || []).forEach(item => {
        if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
        itemsByOrder.get(item.order_id)!.push(item);
      });

      const subsByOrder = new Map<string, any[]>();
      (allSubOrders || []).forEach(sub => {
        if (!subsByOrder.has(sub.order_id)) subsByOrder.set(sub.order_id, []);
        subsByOrder.get(sub.order_id)!.push(sub);
      });

      const descontoByOrder = new Map<string, number>();
      (orders || []).forEach(o => descontoByOrder.set(o.id, Number(o.desconto || 0)));

      const { data: storesObj } = await supabase.from('stores').select('number, city');
      const cityMap = new Map<string, string>();
      storesObj?.forEach(s => cityMap.set(String(s.number), s.city));

      // ── totais GLOBAIS ──
      let totalPares = 0;
      let totalUnidades = 0;
      let valorTotal = 0;

      const storeAgg = new Map<string, { pares: number; unidades: number; valor: number; pedidos: Set<string> }>();
      const brandAgg = new Map<string, BrandAggEntry>();
      const typeAgg = new Map<string, {
        pares: number; valor: number;
        modelStats: Map<string, {
          pares: number; valor: number;
          pares_por_loja: Map<number, number>;
          valor_por_loja: Map<number, number>;
        }>;
      }>();

      const isAcessorio = (item: any): boolean => {
        const modelo = (item.modelo || '').toUpperCase().trim();
        const tipo   = (item.tipo   || '').toUpperCase().trim();
        return modelo === 'ACES'      || modelo === 'ACESSÓRIO' || modelo === 'ACESSORIO'
            || tipo   === 'ACES'      || tipo   === 'ACESSÓRIO' || tipo   === 'ACESSORIO';
      };

      for (const order of (orders || [])) {
        const subOrders = subsByOrder.get(order.id) || [];
        const items     = itemsByOrder.get(order.id) || [];

        if (user?.role !== 'ADMIN' && userStoreNumber) {
          const incluiLoja = subOrders.some((sub: any) =>
            (sub.lojas_numeros || []).map(String).includes(String(userStoreNumber))
          );
          if (!incluiLoja) continue;
        }

        const todasLojas = Array.from(new Set(
          subOrders.flatMap((sub: any) => (sub.lojas_numeros || []).map(Number))
        ));
        if (todasLojas.length === 0) continue;

        const desconto     = descontoByOrder.get(order.id) || 0;
        const fatorDesconto = 1 - (desconto / 100);

        const bAgg = brandAgg.get(order.marca) || {
          pares: 0,
          valor: 0,
          pares_por_loja: new Map<number, number>(),
          valor_por_loja: new Map<number, number>(),
        };

        for (const item of items) {
          const isAces = isAcessorio(item);
          
          let dept = (item.modelo || 'OUTROS').toUpperCase();
          if (isAces)           dept = 'ACESSÓRIO';
          else if (dept === 'FEM')  dept = 'FEMININO';
          else if (dept === 'MASC') dept = 'MASCULINO';
          else if (dept === 'INF')  dept = 'INFANTIL';

          const itemSubOrderNums: number[] = (item.buy_order_item_suborder_grades || [])
            .map((g: any) => Number(g.sub_order_num))
            .filter((n: number) => !isNaN(n));

          let activeSubOrders = subOrders;
          if (itemSubOrderNums.length > 0) {
            activeSubOrders = subOrders.filter((sub: any) => itemSubOrderNums.includes(Number(sub.sub_order_num)));
          }

          const storeParesMap = new Map<number, number>();
          const storeValorMap = new Map<number, number>();

          let itemTotalParesOfDraft = 0;
          let itemTotalValorOfDraft = 0;

          // Lógica unificada para TODOS os itens (calçados e acessórios)
          for (const sub of activeSubOrders) {
            const lojas: number[] = (sub.lojas_numeros || []).map(Number);
            if (lojas.length === 0) continue;

            const itemGrades = gradeMap.get(item.id);
            const gradLetra = itemGrades?.get(Number(sub.sub_order_num));
            if (!gradLetra) continue;

            // Extrair quantidade da grade específica do JSONB
            const gradeEntry = (item.grades || []).find((g: any) => g.letra === gradLetra);
            if (!gradeEntry || !gradeEntry.tamanhos) continue;

            const qtdPerStore = Object.values(gradeEntry.tamanhos as Record<string, number>)
              .reduce((sum: number, v: number) => sum + (typeof v === 'number' ? v : 0), 0);

            const valorPerStore = qtdPerStore * Number(item.custo || 0) * fatorDesconto;

            for (const loja of lojas) {
              storeParesMap.set(loja, (storeParesMap.get(loja) || 0) + qtdPerStore);
              storeValorMap.set(loja, (storeValorMap.get(loja) || 0) + valorPerStore);

              itemTotalParesOfDraft += qtdPerStore;
              itemTotalValorOfDraft += valorPerStore;
            }
          }

          if (itemTotalParesOfDraft === 0 && itemTotalValorOfDraft === 0) continue;

          if (isAces) {
            totalUnidades      += itemTotalParesOfDraft;
          } else {
            totalPares         += itemTotalParesOfDraft;
          }
          valorTotal           += itemTotalValorOfDraft;

          const tAgg = typeAgg.get(dept) || { pares: 0, valor: 0, modelStats: new Map() };
          tAgg.pares += itemTotalParesOfDraft;
          tAgg.valor += itemTotalValorOfDraft;

          let subCat = (item.tipo || 'OUTROS').toUpperCase();
          let mapKey = subCat;
          if (dept === 'INFANTIL') {
            if (subCat.includes('FEM') || subCat.includes('MENINA'))        mapKey = 'FEMININO|'  + subCat;
            else if (subCat.includes('MASC') || subCat.includes('MENINO'))  mapKey = 'MASCULINO|' + subCat;
            else                                                             mapKey = 'UNISSEX|'   + subCat;
          }

          const mAgg = tAgg.modelStats.get(mapKey) || {
            pares: 0, valor: 0,
            pares_por_loja: new Map<number, number>(),
            valor_por_loja: new Map<number, number>(),
          };
          mAgg.pares += itemTotalParesOfDraft;
          mAgg.valor += itemTotalValorOfDraft;

          storeParesMap.forEach((pares, lojaNum) => {
            mAgg.pares_por_loja.set(lojaNum, (mAgg.pares_por_loja.get(lojaNum) || 0) + pares);
            mAgg.valor_por_loja.set(lojaNum, (mAgg.valor_por_loja.get(lojaNum) || 0) + storeValorMap.get(lojaNum)!);

            // Store Aggregation
            const loja = String(lojaNum);
            const sAgg = storeAgg.get(loja) || { pares: 0, unidades: 0, valor: 0, pedidos: new Set<string>() };
            if (isAces) {
              sAgg.unidades += pares;
            } else {
              sAgg.pares    += pares;
            }
            sAgg.valor      += storeValorMap.get(lojaNum)!;
            sAgg.pedidos.add(order.id);
            storeAgg.set(loja, sAgg);

            // Brand Aggregation per store
            bAgg.pares_por_loja.set(lojaNum, (bAgg.pares_por_loja.get(lojaNum) || 0) + pares);
            bAgg.valor_por_loja.set(lojaNum, (bAgg.valor_por_loja.get(lojaNum) || 0) + storeValorMap.get(lojaNum)!);
          });

          bAgg.pares += itemTotalParesOfDraft;
          bAgg.valor += itemTotalValorOfDraft;

          tAgg.modelStats.set(mapKey, mAgg);
          typeAgg.set(dept, tAgg);
        }

        brandAgg.set(order.marca, bAgg);
      }

      setSummary({ total_pares: totalPares, total_unidades: totalUnidades, valor_total: valorTotal });

      const stStats: StoreStat[] = Array.from(storeAgg.entries())
        .map(([loja, agg]) => ({
          loja,
          cidade:   cityMap.get(loja) || 'Desconhecida',
          pares:    Math.round(agg.pares),
          unidades: Math.round(agg.unidades),
          valor:    agg.valor,
          pedidos:  agg.pedidos.size,
        }))
        .filter(s => {
          if (user?.role !== 'ADMIN' && userStoreNumber) return parseInt(s.loja) === userStoreNumber;
          return true;
        })
        .sort((a, b) => Number(a.loja) - Number(b.loja));
      setStoreStats(stStats);

      // Salvar brandAgg bruto — brandStats será calculado pelo useEffect
      setBrandAggData(new Map(brandAgg));

      const builtTypes: TypeStat[] = Array.from(typeAgg.entries()).map(([tipo, agg]) => {
        const typePares = agg.pares;
        const typeModelos: ModelStat[] = Array.from(agg.modelStats.entries()).map(([key, mAgg]) => {
          let subtipo: string | undefined = undefined;
          let modelo = key;
          if (tipo === 'INFANTIL' && key.includes('|')) {
            [subtipo, modelo] = key.split('|') as [string, string];
          }
          const paresPorLojaObj: Record<number, number> = {};
          mAgg.pares_por_loja.forEach((v, k) => { paresPorLojaObj[k] = Math.round(v); });
          const valorPorLojaObj: Record<number, number> = {};
          mAgg.valor_por_loja.forEach((v, k) => { valorPorLojaObj[k] = v; });

          // TOTAL = soma de pares_por_loja de TODAS as lojas
          const totalModelo = Object.values(paresPorLojaObj).reduce((s, v) => s + v, 0);

          // VALOR = soma de valor_por_loja de TODAS as lojas
          const valorModelo = Object.values(valorPorLojaObj).reduce((s, v) => s + v, 0);

          return {
            subtipo, modelo,
            pares:       totalModelo,
            valor:       valorModelo,
            percentual:  typePares > 0 ? (totalModelo / typePares) * 100 : 0,
            pares_por_loja: paresPorLojaObj,
            valor_por_loja: valorPorLojaObj,
          };
        }).sort((a, b) => b.pares - a.pares);

        return {
          tipo,
          pares:      agg.pares,
          valor:      agg.valor,
          percentual: (totalPares + totalUnidades) > 0 ? (agg.pares / (totalPares + totalUnidades)) * 100 : 0,
          modelos:    typeModelos,
        };
      });

      const sortOrder = ['FEMININO', 'MASCULINO', 'INFANTIL', 'ACESSÓRIO'];
      builtTypes.sort((a, b) => {
        const ia = sortOrder.indexOf(a.tipo) === -1 ? 99 : sortOrder.indexOf(a.tipo);
        const ib = sortOrder.indexOf(b.tipo) === -1 ? 99 : sortOrder.indexOf(b.tipo);
        return ia - ib;
      });
      setTypeStats(builtTypes);

    } catch (err) {
      console.error('Erro ao buscar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeClick = (tipo: string) => setExpandedType(expandedType === tipo ? null : tipo);

  const toNumber = (v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(n) ? 0 : n;
  };
  const formatBRLValue = (val: number) => toNumber(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatNum      = (val: number) => toNumber(val).toLocaleString('pt-BR');

  const getTypeStyles = (tipo: string) => {
    switch (tipo) {
      case 'FEMININO':  return 'bg-pink-50 border-pink-500 text-pink-700';
      case 'MASCULINO': return 'bg-blue-50 border-blue-500 text-blue-700';
      case 'INFANTIL':  return 'bg-purple-50 border-purple-500 text-purple-700';
      case 'ACESSÓRIO': return 'bg-amber-50 border-amber-500 text-amber-700';
      default:          return 'bg-slate-50 border-slate-500 text-slate-700';
    }
  };
  const getTypeIcons = (tipo: string) => {
    switch (tipo) {
      case 'FEMININO':  return '👗';
      case 'MASCULINO': return '👔';
      case 'INFANTIL':  return '👶';
      case 'ACESSÓRIO': return '💼';
      default:          return '📦';
    }
  };

  // ── FILTRO POR LOJA ───────────────────────────────────────────────────────
  const filteredTypeStats = lojaFiltro === null ? typeStats : typeStats.map(ts => {
    const modelos = ts.modelos.map(m => ({
      ...m,
      pares: m.pares_por_loja?.[lojaFiltro] || 0,
      valor: m.valor_por_loja?.[lojaFiltro] || 0,
    })).filter(m => m.pares > 0);
    return {
      ...ts,
      pares: modelos.reduce((a, m) => a + m.pares, 0),
      valor: modelos.reduce((a, m) => a + m.valor, 0),
      modelos,
    };
  }).filter(ts => ts.pares > 0);

  const filteredStoreStats = lojaFiltro === null
    ? storeStats
    : storeStats.filter(s => parseInt(s.loja) === lojaFiltro);

  const filteredSummary = lojaFiltro === null ? summary : {
    total_pares:    filteredTypeStats.filter(t => t.tipo !== 'ACESSÓRIO').reduce((a, t) => a + t.pares, 0),
    total_unidades: filteredTypeStats.find(t => t.tipo === 'ACESSÓRIO')?.pares || 0,
    valor_total:    filteredStoreStats.reduce((a, s) => a + s.valor, 0),
  };

  const expandedStat = filteredTypeStats.find(t => t.tipo === expandedType);

  // ── DONUT META ─────────────────────────────────────────────────────────────
  const DonutMeta = ({
    meta, realizado, cor, corClaro, label = 'META', small = false,
  }: {
    meta: number; realizado: number; cor: string; corClaro: string; label?: string; small?: boolean;
  }) => {
    const size   = small ? 52 : 72;
    const stroke = small ? 5 : 7;
    const r      = (size - stroke) / 2;
    const circ   = 2 * Math.PI * r;
    const prog   = meta > 0 ? Math.min(realizado / meta, 1) : 0;
    const offset = circ * (1 - prog);
    return (
      <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={corClaro} strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cor} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: size, height: size,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: small ? 12 : 15, fontWeight: 900, color: cor, lineHeight: 1 }}>
            {meta.toFixed(0)}%
          </span>
          <span style={{ fontSize: 8, color: cor, opacity: 0.7, marginTop: 1, fontWeight: 700 }}>{label}</span>
        </div>
      </div>
    );
  };

  // ── DONUT INFANTIL duplo (menina rosa + menino azul) ──────────────────────
  const DonutInfantil = ({
    paresMenina, paresMenino, small = false,
  }: {
    paresMenina: number; paresMenino: number; small?: boolean;
  }) => {
    const total = paresMenina + paresMenino;
    if (total === 0) return null;
    const pctMenina = (paresMenina / total) * 100;
    const pctMenino = (paresMenino / total) * 100;

    const size   = small ? 52 : 72;
    const stroke = small ? 5 : 7;
    const r      = (size - stroke) / 2;
    const circ   = 2 * Math.PI * r;

    // menina: arco do início
    const dashMenina  = circ * (paresMenina / total);
    // menino: arco depois da menina
    const dashMenino  = circ * (paresMenino / total);
    const offsetMenino = circ * (paresMenina / total);   // começa onde a menina termina

    return (
      <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
          {/* fundo */}
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3e8ff" strokeWidth={stroke} />
          {/* menina (rosa) */}
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ec4899" strokeWidth={stroke}
            strokeDasharray={`${dashMenina} ${circ - dashMenina}`} strokeDashoffset={0} strokeLinecap="butt" />
          {/* menino (azul) */}
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#3b82f6" strokeWidth={stroke}
            strokeDasharray={`${dashMenino} ${circ - dashMenino}`} strokeDashoffset={-offsetMenino} strokeLinecap="butt" />
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: size, height: size,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 1 }}>
          <span style={{ fontSize: small ? 7 : 9, fontWeight: 900, color: '#ec4899', lineHeight: 1 }}>
            ♀ {pctMenina.toFixed(0)}%
          </span>
          <span style={{ fontSize: small ? 7 : 9, fontWeight: 900, color: '#3b82f6', lineHeight: 1 }}>
            ♂ {pctMenino.toFixed(0)}%
          </span>
        </div>
      </div>
    );
  };
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Activity className="animate-spin text-blue-600 mb-4" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header + filtro */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-blue-600 dark:text-blue-400" size={28} />
            <h1 className="text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
              Dashboard de Compras
              {lojaFiltro !== null && <span className="ml-3 text-blue-600 dark:text-blue-400">· Loja {lojaFiltro}</span>}
            </h1>
          </div>
          {user?.role === 'ADMIN' && (
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
              <button onClick={() => setLojaFiltro(null)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  lojaFiltro === null ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>
                TODAS
              </button>
              {LOJAS.map(num => (
                <button key={num} onClick={() => setLojaFiltro(lojaFiltro === num ? null : num)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    lojaFiltro === num ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>
                  {num}
                </button>
              ))}
              <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />
              {lojaFiltro !== null && ([3, 6] as const).map(p => (
                <button key={p} onClick={() => setPeriodo(p)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    periodo === p ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>
                  {p}M
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CARDS DE RESUMO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total de Pares', val: filteredSummary?.total_pares || 0, sub: 'Calçados', unit: 'pares' },
            { label: 'Total de Unidades', val: filteredSummary?.total_unidades || 0, sub: 'Acessórios', unit: 'unid.' },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col justify-center">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
                <Package size={16} /> {c.label}
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">
                {formatNum(c.val)} <span className="text-lg font-medium text-slate-400">{c.unit}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">{c.sub}</div>
            </div>
          ))}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col justify-center">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
              <DollarSign size={16} /> Total Compra
            </div>
            <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">
              {formatBRLValue(filteredSummary?.valor_total || 0)}
            </div>
          </div>
        </div>

        {/* CARDS POR TIPO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {['FEMININO', 'MASCULINO', 'INFANTIL', 'ACESSÓRIO'].map((tipoBase) => {
            const stat = filteredTypeStats.find(t => t.tipo === tipoBase) || {
              tipo: tipoBase, pares: 0, valor: 0, percentual: 0, modelos: [],
            };
            const isExpanded = expandedType === stat.tipo;
            const style = getTypeStyles(stat.tipo);
            const icon  = getTypeIcons(stat.tipo);

            const donutCor = (() => {
              switch (tipoBase) {
                case 'FEMININO':  return { forte: '#ec4899', claro: '#fce7f3' };
                case 'MASCULINO': return { forte: '#3b82f6', claro: '#dbeafe' };
                case 'INFANTIL':  return { forte: '#a855f7', claro: '#f3e8ff' };
                case 'ACESSÓRIO': return { forte: '#f59e0b', claro: '#fef3c7' };
                default:          return { forte: '#64748b', claro: '#f1f5f9' };
              }
            })();

            const totalGeralValor = filteredTypeStats.reduce((a, t) => a + t.valor, 0);
            const mixPct = totalGeralValor > 0 ? (stat.valor / totalGeralValor) * 100 : 0;

            const metaPct = categoriaParams ? (() => {
              switch (tipoBase) {
                case 'FEMININO':  return categoriaParams.feminino_pct;
                case 'MASCULINO': return categoriaParams.masculino_pct;
                case 'INFANTIL':  return categoriaParams.infantil_menina_pct + categoriaParams.infantil_menino_pct;
                case 'ACESSÓRIO': return categoriaParams.acessorio_pct;
                default:          return 0;
              }
            })() : 0;

            const baseMetaValor = categoriaParams ? categoriaParams.cota_valor * periodo * (metaPct / 100) : 0;
            const realizadoPctMeta = baseMetaValor > 0 ? (stat.valor / baseMetaValor) * 100 : 0;

            const modoTodas = lojaFiltro === null && userStoreNumber === null;
            const modoLoja  = !modoTodas && metaPct > 0;

            // Pares menina/menino para donut infantil
            const paresMenina = tipoBase === 'INFANTIL'
              ? stat.modelos.filter(m => m.subtipo === 'FEMININO').reduce((a, m) => a + m.pares, 0)
              : 0;
            const paresMenino = tipoBase === 'INFANTIL'
              ? stat.modelos.filter(m => m.subtipo === 'MASCULINO').reduce((a, m) => a + m.pares, 0)
              : 0;

            return (
              <div key={stat.tipo} onClick={() => handleTypeClick(stat.tipo)}
                className={`rounded-xl border cursor-pointer transition-all duration-200 p-4 ${style}
                  ${isExpanded ? 'shadow-md scale-[1.02] border-b-4' : 'shadow-sm hover:shadow opacity-90 hover:opacity-100 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200'}`}>
                <div className="font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>{icon}</span> {stat.tipo}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="font-bold text-base sm:text-lg leading-none">
                      {formatNum(stat.pares)}{' '}
                      <span className="text-[10px] font-normal uppercase opacity-70">
                        {stat.tipo === 'ACESSÓRIO' ? 'unid.' : 'pares'}
                      </span>
                    </div>
                    <div className="font-bold text-xs sm:text-sm leading-none opacity-90 truncate">
                      {formatBRLValue(stat.valor)}
                    </div>
                    {modoTodas && (
                      <div className="font-bold text-sm leading-none opacity-70">
                        {mixPct.toFixed(1)}% <span className="text-[10px] font-normal opacity-60">do mix</span>
                      </div>
                    )}
                    {modoLoja && (
                      <div className="font-bold text-sm leading-none opacity-70">
                        {realizadoPctMeta.toFixed(1)}% <span className="text-[10px] font-normal opacity-60">da meta {periodo}M</span>
                      </div>
                    )}
                    {/* Sub-info infantil: menina × menino */}
                    {tipoBase === 'INFANTIL' && (paresMenina + paresMenino) > 0 && (
                      <div className="flex gap-2 mt-1">
                        <span className="text-[9px] font-bold text-pink-500">♀ {paresMenina}p</span>
                        <span className="text-[9px] font-bold text-blue-500">♂ {paresMenino}p</span>
                      </div>
                    )}
                  </div>

                  {/* Donut INFANTIL duplo */}
                  {tipoBase === 'INFANTIL' && (paresMenina + paresMenino) > 0 && (
                    <DonutInfantil paresMenina={paresMenina} paresMenino={paresMenino} small={isMobile} />
                  )}

                  {/* Donut TODAS — mix (não infantil) */}
                  {tipoBase !== 'INFANTIL' && modoTodas && totalGeralValor > 0 && (
                    <DonutMeta meta={mixPct} realizado={mixPct}
                      cor={donutCor.forte} corClaro={donutCor.claro} label="MIX" small={isMobile} />
                  )}

                  {/* Donut LOJA — meta (não infantil) */}
                  {tipoBase !== 'INFANTIL' && modoLoja && (
                    <DonutMeta meta={metaPct} realizado={realizadoPctMeta}
                      cor={donutCor.forte} corClaro={donutCor.claro} label="META" small={isMobile} />
                  )}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 opacity-70 mt-3">
                  {isExpanded ? <><ChevronDown size={14} /> Fechar</> : <><ChevronRight size={14} /> Detalhes</>}
                </div>
              </div>
            );
          })}
        </div>

        {/* DETALHAMENTO EXPANDIDO */}
        {expandedStat && (() => {
          const storesInType = Array.from(new Set(
            expandedStat.modelos.flatMap(m => Object.keys(m.pares_por_loja || {}).map(Number))
          )).sort((a, b) => a - b);

          const renderTable = (modelos: ModelStat[]) => (
            <div className="bg-white dark:bg-slate-900 p-0 border-t border-opacity-20 overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 shadow-sm border-b border-slate-200 dark:border-slate-700 z-20">
                  <tr>
                    <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-900 z-10">Modelo</th>
                    {storesInType.map(loja => (
                      <th key={loja} className="px-1 py-3 font-bold text-[9px] uppercase text-blue-600 text-center min-w-[32px] w-8">
                        L{loja}
                      </th>
                    ))}
                    <th className="px-6 py-3 font-bold text-xs uppercase text-slate-400 text-right">Total</th>
                    <th className="px-6 py-3 font-bold text-xs uppercase text-slate-400 text-right">Valor</th>
                    <th className="px-6 py-3 font-bold text-xs uppercase text-slate-400 text-right w-24">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {modelos.map(m => (
                    <tr key={m.modelo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-3 font-bold text-slate-900 dark:text-slate-200 bg-inherit sticky left-0">{m.modelo}</td>
                      {storesInType.map(loja => {
                        const pares = m.pares_por_loja?.[loja] || 0;
                        return (
                          <td key={loja} className={`px-1 py-2 text-center text-[10px] font-bold ${pares > 0 ? 'text-green-700' : 'text-slate-200 dark:text-slate-700'}`}>
                            {pares > 0 ? pares : ''}
                          </td>
                        );
                      })}
                      <td className="px-6 py-3 text-right font-bold text-slate-900 dark:text-slate-200">{formatNum(m.pares)}</td>
                      <td className="px-6 py-3 text-right font-medium text-emerald-600">{formatBRLValue(m.valor)}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-500">{m.percentual.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {modelos.length === 0 && (
                    <tr><td colSpan={storesInType.length + 4} className="py-8 text-center text-slate-400 italic">Nenhum dado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          );

          return (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <div className={`rounded-xl shadow-md border ${getTypeStyles(expandedStat.tipo)} p-0 overflow-hidden dark:bg-slate-800 dark:border-slate-700`}>
                <div className="px-6 py-4 border-b border-opacity-20 flex items-center gap-2 font-bold uppercase tracking-wider text-sm dark:text-slate-200">
                  {getTypeIcons(expandedStat.tipo)} {expandedStat.tipo} - Modelos Comprados
                </div>
                {expandedStat.tipo === 'INFANTIL' ? (
                  <div className="bg-white dark:bg-slate-900 border-t border-opacity-20 overflow-auto">
                    {['FEMININO', 'MASCULINO', 'UNISSEX'].map(subtipo => {
                      const subModelos = expandedStat.modelos.filter(m => m.subtipo === subtipo);
                      if (subModelos.length === 0) return null;
                      return (
                        <div key={subtipo} className="border-b last:border-0 border-slate-100 dark:border-slate-800">
                          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-2 font-black text-[11px] text-slate-500 uppercase tracking-widest">
                            {getTypeIcons(subtipo)} {subtipo} INFANTIL
                          </div>
                          {renderTable(subModelos)}
                        </div>
                      );
                    })}
                  </div>
                ) : renderTable(expandedStat.modelos)}
              </div>
            </div>
          );
        })()}

        {/* TABELAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          {/* Compras por Loja */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[500px]">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-4 border-b sticky top-0 z-10 flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <StoreIcon size={18} /> Compras por Loja
              </h2>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded">
                {lojaFiltro !== null ? '1 Loja' : user?.role === 'ADMIN' ? '18 Lojas' : '1 Loja'}
              </span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white dark:bg-slate-900 sticky top-0 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400">Loja</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400">Cidade</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 text-right">Pares</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 text-right">Unid.</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 text-right">Valor</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 text-center">Pedidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStoreStats.map(s => (
                    <tr key={s.loja} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-2.5 font-black text-blue-600">{s.loja}</td>
                      <td className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-300">{s.cidade}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-slate-900 dark:text-slate-200">{formatNum(s.pares)}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-slate-900 dark:text-slate-200">{formatNum(s.unidades)}</td>
                      <td className="px-5 py-2.5 text-right text-emerald-600 font-bold">{formatBRLValue(s.valor)}</td>
                      <td className="px-5 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center bg-slate-100 text-slate-600 font-bold text-[10px] px-2 py-0.5 rounded">
                          {s.pedidos}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredStoreStats.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-400 italic">Nenhum dado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compras por Marca */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[500px]">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-4 border-b sticky top-0 z-10 flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <Tag size={18} /> Compras por Marca
              </h2>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded">Top 18</span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white dark:bg-slate-900 sticky top-0 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase text-slate-400">Marca</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase text-slate-400 text-right">Pares</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase text-slate-400 text-right">Valor</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase text-slate-400 w-20">% Total</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase text-slate-400 w-24">Barra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {brandStats.map(b => (
                    <tr key={b.marca} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-2.5 font-bold text-slate-900 dark:text-white uppercase text-[11px]">{b.marca}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">{formatNum(b.pares)}</td>
                      <td className="px-5 py-2.5 text-right text-emerald-600 font-bold">{formatBRLValue(b.valor)}</td>
                      <td className="px-5 py-2.5 text-right font-black text-slate-600">{b.percentual.toFixed(0)}%</td>
                      <td className="px-5 py-2.5">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, b.percentual))}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {brandStats.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">Nenhum dado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}