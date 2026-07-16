import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Package, Store as StoreIcon, Activity, BarChart3, Tag, ChevronDown, ChevronRight, DollarSign, Search, PieChart } from 'lucide-react';
import BuyOrderDashboardBarra from './BuyOrderDashboardBarra';
import BuyOrderParams, {
  AlertasGradePorLoja,
  AlertasMarcaGlobal,
  AlertasProdutoGlobal,
  AlertasMarcaStore,
  AlertasProdutoStore
} from './BuyOrderParams';

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
  const [error, setError] = useState<string | null>(null);
  const [userStoreNumber, setUserStoreNumber] = useState<number | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [typeStats, setTypeStats] = useState<TypeStat[]>([]);
  const [storeStats, setStoreStats] = useState<StoreStat[]>([]);
  // brandAggData guarda os dados brutos para recalcular brandStats quando lojaFiltro muda
  const [brandAggData, setBrandAggData] = useState<Map<string, BrandAggEntry>>(new Map());
  const [brandStats, setBrandStats] = useState<BrandStat[]>([]);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});
  const toggleModel = (category: string, subtipo: string, modelo: string) => {
    const key = `${category}|${subtipo}|${modelo}`;
    setExpandedModels(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  const isModelExpanded = (category: string, subtipo: string, modelo: string) => {
    return !!expandedModels[`${category}|${subtipo}|${modelo}`];
  };
  const [lojaFiltro, setLojaFiltro] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState<3 | 6>(3);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [activeTab, setActiveTab] = useState('resumo');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [realizedSubtypes, setRealizedSubtypes] = useState<Map<string, { pares: number; valor: number }>>(new Map());

  const [subcategoryMapState, setSubcategoryMapState] = useState<Map<string, { subtipo: string, categoria: string }>>(new Map());
  const [subcategoryParams, setSubcategoryParams] = useState<Record<string, Record<string, number>>>({});
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  const toggleClass = (category: string, classKey: string) => {
    const key = `${category}|${classKey}`;
    setExpandedClasses(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isClassExpanded = (category: string, classKey: string) => {
    return !!expandedClasses[`${category}|${classKey}`];
  };

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

      if (!storeNum) { 
        setCategoriaParams(null); 
        setSubcategoryParams({});
        return; 
      }

      const currentMonth = new Date().getMonth() + 1;
      const currentYear  = new Date().getFullYear();

      // Fetch category parameters
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

      // Fetch subcategory parameters (metas de classes)
      try {
        const { data: subData } = await supabase
          .from('buyorder_subcategory_params')
          .select('categoria, subtipo, percentual')
          .eq('store_number', storeNum)
          .eq('year', currentYear)
          .eq('month', currentMonth);

        const newSubParams: Record<string, Record<string, number>> = {
          FEMININO: {},
          MASCULINO: {},
          INFANTIL: {},
          ACESSÓRIO: {}
        };
        subData?.forEach(row => {
          if (row.categoria && row.subtipo) {
            const cat = row.categoria.toUpperCase().trim();
            if (!newSubParams[cat]) {
              newSubParams[cat] = {};
            }
            newSubParams[cat][row.subtipo.toUpperCase().trim()] = Number(row.percentual || 0);
          }
        });
        setSubcategoryParams(newSubParams);
      } catch (err) {
        console.error("Erro ao carregar buyorder_subcategory_params:", err);
      }
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
      .sort((a, b) => b.pares - a.pares);

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
    setError(null);
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

      // ===== QUERY 5: Tipo -> Subtipo mapping =====
      const { data: mappingData } = await supabase
        .from('buy_tipo_subtipo_map')
        .select('tipo_raw, subtipo, categoria');

      const subcategoryMap = new Map<string, { subtipo: string, categoria: string }>();
      (mappingData || []).forEach(row => {
        if (row.tipo_raw) {
          subcategoryMap.set(String(row.tipo_raw).toUpperCase().trim(), {
            subtipo: row.subtipo,
            categoria: row.categoria
          });
        }
      });

      setSubcategoryMapState(subcategoryMap);

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
      const realizedSubtypesAcc = new Map<string, { pares: number; valor: number }>();

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
          const incluiLoja = subOrders.some((sub: any) => {
            const subLojas = Array.isArray(sub.lojas_numeros) ? sub.lojas_numeros : [];
            return subLojas.map(String).includes(String(userStoreNumber));
          });
          if (!incluiLoja) continue;
        }

        const todasLojas = Array.from(new Set(
          subOrders.flatMap((sub: any) => {
            const subLojas = Array.isArray(sub.lojas_numeros) ? sub.lojas_numeros : [];
            return subLojas.map(Number);
          })
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

          // Ensure it's safe if buy_order_item_suborder_grades is not an array
          const suborderGradesRelation = item.buy_order_item_suborder_grades;
          const suborderGradesArray = Array.isArray(suborderGradesRelation)
            ? suborderGradesRelation
            : suborderGradesRelation
              ? [suborderGradesRelation]
              : [];

          const itemSubOrderNums: number[] = suborderGradesArray
            .map((g: any) => Number(g?.sub_order_num))
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
            const subLojas = Array.isArray(sub.lojas_numeros) ? sub.lojas_numeros : [];
            const lojas: number[] = subLojas.map(Number);
            if (lojas.length === 0) continue;

            const itemGrades = gradeMap.get(item.id);
            const gradLetra = itemGrades?.get(Number(sub.sub_order_num));
            if (!gradLetra) continue;

            // Extrair quantidade da grade específica do JSONB
            const gradesList = Array.isArray(item.grades) ? item.grades : [];
            const gradeEntry = gradesList.find((g: any) => g && g.letra === gradLetra);
            if (!gradeEntry || !gradeEntry.tamanhos) continue;

            const qtdPerStore = Object.values((gradeEntry.tamanhos || {}) as Record<string, number>)
              .reduce((sum: number, v: number) => sum + (typeof v === 'number' ? v : 0), 0);

            const valorPerStore = qtdPerStore * Number(item.custo || 0) * fatorDesconto;

            const itemTipoRaw = (item.tipo || '').toUpperCase().trim();
            const mapping = subcategoryMap.get(itemTipoRaw);
            const subtipoCanon = mapping?.subtipo || 'Não classificado';
            const itemCategory = dept.toUpperCase();

            for (const loja of lojas) {
              storeParesMap.set(loja, (storeParesMap.get(loja) || 0) + qtdPerStore);
              storeValorMap.set(loja, (storeValorMap.get(loja) || 0) + valorPerStore);

              itemTotalParesOfDraft += qtdPerStore;
              itemTotalValorOfDraft += valorPerStore;

              // Specific subtipo key: store_number|categoria|subtipo
              const subKey = `${loja}|${itemCategory}|${subtipoCanon.toUpperCase()}`;
              const subEntry = realizedSubtypesAcc.get(subKey) || { pares: 0, valor: 0 };
              subEntry.pares += qtdPerStore;
              subEntry.valor += valorPerStore;
              realizedSubtypesAcc.set(subKey, subEntry);

              // Specific subtipo key for GLOBAL: GLOBAL|categoria|subtipo
              const globalSubKey = `GLOBAL|${itemCategory}|${subtipoCanon.toUpperCase()}`;
              const globalSubEntry = realizedSubtypesAcc.get(globalSubKey) || { pares: 0, valor: 0 };
              globalSubEntry.pares += qtdPerStore;
              globalSubEntry.valor += valorPerStore;
              realizedSubtypesAcc.set(globalSubKey, globalSubEntry);

              // Category total key: store_number|categoria|TOTAL_CATEGORIA
              const totalKey = `${loja}|${itemCategory}|TOTAL_CATEGORIA`;
              const totalEntry = realizedSubtypesAcc.get(totalKey) || { pares: 0, valor: 0 };
              totalEntry.pares += qtdPerStore;
              totalEntry.valor += valorPerStore;
              realizedSubtypesAcc.set(totalKey, totalEntry);

              // Category total key for GLOBAL: GLOBAL|categoria|TOTAL_CATEGORIA
              const globalTotalKey = `GLOBAL|${itemCategory}|TOTAL_CATEGORIA`;
              const globalTotalEntry = realizedSubtypesAcc.get(globalTotalKey) || { pares: 0, valor: 0 };
              globalTotalEntry.pares += qtdPerStore;
              globalTotalEntry.valor += valorPerStore;
              realizedSubtypesAcc.set(globalTotalKey, globalTotalEntry);
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
            mAgg.valor_por_loja.set(lojaNum, (mAgg.valor_por_loja.get(lojaNum) || 0) + (storeValorMap.get(lojaNum) || 0));

            // Store Aggregation
            const loja = String(lojaNum);
            const sAgg = storeAgg.get(loja) || { pares: 0, unidades: 0, valor: 0, pedidos: new Set<string>() };
            if (isAces) {
              sAgg.unidades += pares;
            } else {
              sAgg.pares    += pares;
            }
            sAgg.valor      += (storeValorMap.get(lojaNum) || 0);
            sAgg.pedidos.add(order.id);
            storeAgg.set(loja, sAgg);

            // Brand Aggregation per store
            bAgg.pares_por_loja.set(lojaNum, (bAgg.pares_por_loja.get(lojaNum) || 0) + pares);
            bAgg.valor_por_loja.set(lojaNum, (bAgg.valor_por_loja.get(lojaNum) || 0) + (storeValorMap.get(lojaNum) || 0));
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
      setRealizedSubtypes(realizedSubtypesAcc);

    } catch (err: any) {
      console.error('Erro ao buscar dashboard:', err);
      setError(err?.message || String(err));
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

  const filteredSummary = lojaFiltro === null 
    ? (summary || { total_pares: 0, total_unidades: 0, valor_total: 0 }) 
    : {
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
        <div className="text-center space-y-4">
          <Activity className="animate-spin text-blue-600 mx-auto" size={36} />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando Central...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 text-center">
        <div className="max-w-md p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-red-200 dark:border-red-900/30 space-y-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ⚠️
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Erro ao buscar dashboard
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {error}
          </p>
          <button
            onClick={() => fetchData()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-blue-700 transition"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB RENDERERS
  // ─────────────────────────────────────────────────────────────────────────

  const renderResumoTab = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Total de Pares */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex items-center gap-5 transition-all hover:shadow-md">
            <div className="w-14 h-14 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center flex-shrink-0 font-bold text-xl">
              👠
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                Total de Pares
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {formatNum(filteredSummary?.total_pares || 0)}{' '}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">pares</span>
              </div>
              <div className="text-[10px] font-bold text-pink-500 uppercase mt-1">
                Calçados Cadastrados
              </div>
            </div>
          </div>

          {/* Card Total de Unidades */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex items-center gap-5 transition-all hover:shadow-md">
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 font-bold text-xl">
              💼
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                Total de Unidades
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {formatNum(filteredSummary?.total_unidades || 0)}{' '}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">unid.</span>
              </div>
              <div className="text-[10px] font-bold text-blue-500 uppercase mt-1">
                Acessórios Cadastrados
              </div>
            </div>
          </div>

          {/* Card Total Compra */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex items-center gap-5 transition-all hover:shadow-md">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-xl">
              💰
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                Total Compra
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {formatBRLValue(filteredSummary?.valor_total || 0)}
              </div>
              <div className="text-[10px] font-bold text-emerald-500 uppercase mt-1">
                Investimento Total
              </div>
            </div>
          </div>
        </div>

        {/* Visual helper card / intro */}
        <div className="bg-slate-100 dark:bg-slate-800/40 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-800/80">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">
            Visão Geral das Compras
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Utilize o menu lateral para navegar entre as <strong>Compras por Loja</strong> (com drill-down por modelo), o desempenho de compras por <strong>Marca</strong>,
            ou configure as <strong>Metas de Mix</strong> para cada uma das filiais autorizadas.
          </p>
        </div>

        {/* Mix de Compra - Detailed Cards */}
        <div className="mt-8">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
            <PieChart size={20} className="text-slate-400" />
            Detalhes por Mix de Compra
          </h2>
          {renderCategoryCards()}
        </div>
      </div>
    );
  };

  const renderPremiumStoreDistribution = (m: ModelStat, category: string) => {
    const LOJA_NAMES: Record<number, string> = {
      5: "Petrolina",
      8: "Catu",
      9: "P. Seguro",
      26: "Cruz das Almas",
      31: "Euclides da Cunha",
      44: "Livramento",
      40: "Jequié",
      43: "Ipiaú",
      34: "Brumado",
      45: "Brumado 2",
      50: "Euclides 2",
      56: "T. Freitas",
      72: "Eunápolis",
      88: "Jequié 2",
      96: "Itapetinga",
      100: "L. Freitas",
      102: "Itamaraju",
      109: "C. Jacuípe",
    };

    const getCategoryColor = (cat: string) => {
      switch (cat.toUpperCase()) {
        case 'FEMININO': return 'pink';
        case 'MASCULINO': return 'blue';
        case 'INFANTIL': return 'amber';
        default: return 'slate';
      }
    };

    const storesData = Object.entries(m.pares_por_loja || {})
      .map(([storeNumStr, pares]) => {
        const storeNum = Number(storeNumStr);
        const valor = m.valor_por_loja?.[storeNum] || 0;
        return {
          storeNum,
          name: `${storeNum.toString().padStart(2, '0')} - ${LOJA_NAMES[storeNum] || 'Loja ' + storeNum}`,
          pares,
          valor,
        };
      })
      .filter(item => item.pares > 0)
      .sort((a, b) => b.pares - a.pares);

    let displayedStores: any[] = [];
    let otherStoresRow: any = null;

    if (storesData.length <= 5) {
      displayedStores = storesData;
    } else {
      displayedStores = storesData.slice(0, 4);
      const remaining = storesData.slice(4);
      const totalParesRemaining = remaining.reduce((acc, curr) => acc + curr.pares, 0);
      const totalValorRemaining = remaining.reduce((acc, curr) => acc + curr.valor, 0);
      otherStoresRow = {
        name: `Demais lojas (${remaining.length})`,
        pares: totalParesRemaining,
        valor: totalValorRemaining,
      };
    }

    const catColor = getCategoryColor(category);
    const barBgClass = catColor === 'pink' ? 'bg-pink-500' : catColor === 'blue' ? 'bg-blue-500' : catColor === 'amber' ? 'bg-amber-500' : 'bg-slate-500';

    return (
      <div className="bg-slate-50/50 dark:bg-slate-950/30 w-full overflow-hidden">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/60">
              <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400">Loja</th>
              <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-right">Pares</th>
              <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-right">Valor</th>
              <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-left">% da Compra</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayedStores.map((item) => {
              const pct = m.pares > 0 ? (item.pares / m.pares) * 100 : 0;
              return (
                <tr key={item.storeNum} className="hover:bg-slate-100/30 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-300">{item.name}</td>
                  <td className="px-6 py-3 text-right font-black text-slate-900 dark:text-slate-100">{formatNum(item.pares)}</td>
                  <td className="px-6 py-3 text-right font-semibold text-emerald-600">{formatBRLValue(item.valor)}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{pct.toFixed(1)}%</span>
                      <div className="hidden sm:block w-24 bg-slate-200/55 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${barBgClass} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {otherStoresRow && (() => {
              const pct = m.pares > 0 ? (otherStoresRow.pares / m.pares) * 100 : 0;
              return (
                <tr className="bg-slate-100/10 dark:bg-slate-900/10 hover:bg-slate-100/30 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-3 font-bold text-slate-500 italic">{otherStoresRow.name}</td>
                  <td className="px-6 py-3 text-right font-black text-slate-500">{formatNum(otherStoresRow.pares)}</td>
                  <td className="px-6 py-3 text-right font-semibold text-slate-500">{formatBRLValue(otherStoresRow.valor)}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-500 w-10 text-right">{pct.toFixed(1)}%</span>
                      <div className="hidden sm:block w-24 bg-slate-200/55 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full bg-slate-400 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPremiumModelList = (modelos: ModelStat[], subtipo = '', category = '') => {
    // 1. Group modelos by Class (Subtipo)
    const groups: Record<string, { classe: string; pares: number; valor: number; percentual: number; items: ModelStat[] }> = {};

    modelos.forEach(m => {
      const rawTipo = m.modelo.toUpperCase().trim();
      const mapping = subcategoryMapState.get(rawTipo);
      
      const classeName = mapping?.subtipo ? mapping.subtipo.toUpperCase().trim() : 'OUTROS / NÃO CLASSIFICADO';

      if (!groups[classeName]) {
        groups[classeName] = {
          classe: classeName,
          pares: 0,
          valor: 0,
          percentual: 0,
          items: []
        };
      }

      groups[classeName].pares += m.pares;
      groups[classeName].valor += m.valor;
      groups[classeName].items.push(m);
    });

    const categoryStat = filteredTypeStats.find(t => t.tipo === category);
    const totalBaseParaEssaTela = category === 'TODOS'
      ? filteredSummary?.total_pares || 0
      : categoryStat
        ? categoryStat.pares
        : modelos.reduce((a, m) => a + m.pares, 0);

    // Calculate percentage and sort items inside each class by pares desc
    Object.values(groups).forEach(g => {
      g.percentual = totalBaseParaEssaTela > 0 ? (g.pares / totalBaseParaEssaTela) * 100 : 0;
      g.items.sort((a, b) => b.pares - a.pares);
    });

    // Sort classes by pares desc, but keep 'OUTROS / NÃO CLASSIFICADO' always at the end
    const sortedClasses = Object.values(groups).sort((a, b) => {
      const aIsOther = a.classe === 'OUTROS / NÃO CLASSIFICADO';
      const bIsOther = b.classe === 'OUTROS / NÃO CLASSIFICADO';
      if (aIsOther && !bIsOther) return 1;
      if (!aIsOther && bIsOther) return -1;
      return b.pares - a.pares;
    });

    const getClassEmoji = (classe: string) => {
      const name = classe.toLowerCase().trim();
      if (name.includes('scarpin')) return '👠';
      if (name.includes('bota')) return '👢';
      if (name.includes('tênis') || name.includes('tenis')) return '👟';
      if (name.includes('sapatilha')) return '🥿';
      if (name.includes('sandália') || name.includes('sandalias') || name.includes('sandálias') || name.includes('sandalia')) return '👡';
      if (name.includes('tamanco')) return '🩴';
      if (name.includes('chinelo')) return '🩴';
      if (name.includes('sapato')) return '👞';
      if (name.includes('papete')) return '🩴';
      if (name.includes('mala')) return '🧳';
      if (name.includes('relógio') || name.includes('relogio')) return '⌚';
      if (name.includes('bolsa')) return '👜';
      if (name.includes('meia')) return '🧦';
      if (name.includes('bola esportiva') || name.includes('bola')) return '⚽';
      if (name.includes('equipamento de futebol') || name.includes('equipamento')) return '🥅';
      if (name.includes('proteção esportiva') || name.includes('protecao')) return '🛡️';
      if (name.includes('óculos') || name.includes('oculos')) return '🕶️';
      if (name.includes('carteira')) return '👛';
      if (name.includes('necessaire')) return '🧴';
      if (name.includes('mochila')) return '🎒';
      if (name.includes('vestuário') || name.includes('vestuario')) return '👕';
      
      if (name.includes('cinto')) {
        return <Tag className="w-5 h-5 text-slate-400 dark:text-slate-500 inline" />;
      }
      
      // Fallbacks
      if (name.includes('acessorio') || name.includes('acessório')) return '👜';
      
      return '📦';
    };

    return (
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {sortedClasses.map((group, index) => {
          const isClassExpandedItem = isClassExpanded(category, group.classe);
          const rank = index + 1;
          
          // Badge color for rank
          const rankBadgeStyle = (() => {
            if (rank === 1) return 'bg-rose-500 text-white';
            if (rank === 2) return 'bg-orange-500 text-white';
            if (rank === 3) return 'bg-amber-500 text-white';
            return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
          })();

          // Determine the category of this class for looking up params
          const firstItem = group.items[0];
          const rawTipoFirst = firstItem ? firstItem.modelo.toUpperCase().trim() : '';
          const mappingFirst = subcategoryMapState.get(rawTipoFirst);
          const itemCategory = mappingFirst?.categoria || category || 'FEMININO';

          // Get the target meta from parameters
          const metaPct = subcategoryParams[itemCategory.toUpperCase()]?.[group.classe.toUpperCase()] || 0;

          return (
            <div key={`${category}-${subtipo}-${group.classe}-${index}`} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Ranking, icon, name, progress */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Badge Number */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 shadow-sm ${rankBadgeStyle}`}>
                    #{rank}
                  </div>

                  {/* Thumbnail Placeholder with class-specific emoji */}
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                    <span className="text-xl">{getClassEmoji(group.classe)}</span>
                  </div>

                  {/* Info details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        {group.classe}
                      </h4>
                      {rank === 1 && (
                        <span className="bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                          Classe mais comprada
                        </span>
                      )}
                    </div>
                    {/* Inline stats */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2.5 mb-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatNum(group.pares)} {itemCategory === 'ACESSÓRIO' ? 'unid.' : 'pares'}</span>
                      <span className="opacity-40">•</span>
                      <span className="font-semibold text-emerald-600">{formatBRLValue(group.valor)}</span>
                      <span className="opacity-40">•</span>
                      <span className="font-bold text-blue-500">{group.percentual.toFixed(1)}% do Mix</span>
                    </div>

                    {/* Progress Bar (comparando % realizado vs % meta da classe) */}
                    <div className="space-y-1 max-w-sm">
                      <div className="relative w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        {/* Realized Bar */}
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.max(0, group.percentual))}%` }}
                        />
                        {/* Meta Tick/Marker */}
                        {metaPct > 0 && (
                          <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                            style={{ left: `${Math.min(100, Math.max(0, metaPct))}%` }}
                            title={`Meta: ${metaPct}%`}
                          />
                        )}
                      </div>
                      {metaPct > 0 && (
                        <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          <span>Realizado: {group.percentual.toFixed(1)}%</span>
                          <span className="text-rose-500 font-black">Meta: {metaPct.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* Action trigger button */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleClass(category, group.classe)}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                  >
                    <span>Ver itens ({group.items.length})</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isClassExpandedItem ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Level 2: List of raw items inside class */}
              {isClassExpandedItem && (
                <div className="pl-6 pr-2 py-3 bg-slate-50/50 dark:bg-slate-800/10 rounded-2xl border border-slate-150 dark:border-slate-800/50 space-y-4 animate-in fade-in duration-300">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    Itens integrantes da classe:
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {group.items.map((item, iIndex) => {
                      const isItemExpanded = isModelExpanded(category, subtipo, item.modelo);
                      return (
                        <div key={`${item.modelo}-${iIndex}`} className="py-3 first:pt-0 last:pb-0 flex flex-col gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="min-w-0">
                              <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                                {item.modelo}
                              </h5>
                              <div className="text-[11px] text-slate-400 font-bold mt-0.5 flex items-center gap-2">
                                <span className="text-slate-600 dark:text-slate-300 font-black">{formatNum(item.pares)} {itemCategory === 'ACESSÓRIO' ? 'unid.' : 'pares'}</span>
                                <span>•</span>
                                <span className="text-emerald-600">{formatBRLValue(item.valor)}</span>
                                <span>•</span>
                                <span className="text-blue-500 font-bold">{item.percentual.toFixed(1)}% do Mix</span>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => toggleModel(category, subtipo, item.modelo)}
                              className="self-start sm:self-center px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border border-slate-200 dark:border-slate-750 shadow-sm"
                            >
                              <span>Ver distribuição por loja</span>
                              <ChevronDown size={12} className={`text-slate-400 transition-transform duration-300 ${isItemExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>

                          {/* Level 3: Store distribution for this item */}
                          {isItemExpanded && (
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 animate-in fade-in duration-300">
                              {renderPremiumStoreDistribution(item, category)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {modelos.length === 0 && (
          <div className="p-8 text-center text-slate-400 italic">Nenhum modelo cadastrado</div>
        )}
      </div>
    );
  };

  const renderCategoryCards = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {['FEMININO', 'MASCULINO', 'INFANTIL', 'ACESSÓRIO'].map((tipoBase) => {
            const stat = filteredTypeStats.find(t => t.tipo === tipoBase) || {
              tipo: tipoBase, pares: 0, valor: 0, percentual: 0, modelos: [],
            };
            const isExpanded = expandedType === stat.tipo;
            
            // Paleta por categoria
            const catStyles = (() => {
              switch (tipoBase) {
                case 'FEMININO':  return { bg: 'bg-pink-50/50 dark:bg-pink-950/10', border: 'border-pink-300 dark:border-pink-800', text: 'text-pink-700 dark:text-pink-400', badge: 'bg-pink-100 text-pink-800', circleBg: 'bg-pink-100 dark:bg-pink-900/40' };
                case 'MASCULINO': return { bg: 'bg-blue-50/50 dark:bg-blue-950/10', border: 'border-blue-300 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', badge: 'bg-blue-100 text-blue-800', circleBg: 'bg-blue-100 dark:bg-blue-900/40' };
                case 'INFANTIL':  return { bg: 'bg-purple-50/50 dark:bg-purple-950/10', border: 'border-purple-300 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-400', badge: 'bg-purple-100 text-purple-800', circleBg: 'bg-purple-100 dark:bg-purple-900/40' };
                case 'ACESSÓRIO': return { bg: 'bg-amber-50/50 dark:bg-amber-950/10', border: 'border-amber-300 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-100 text-amber-800', circleBg: 'bg-amber-100 dark:bg-amber-900/40' };
                default:          return { bg: 'bg-slate-50/50 dark:bg-slate-950/10', border: 'border-slate-300 dark:border-slate-800', text: 'text-slate-700 dark:text-slate-400', badge: 'bg-slate-100 text-slate-800', circleBg: 'bg-slate-100 dark:bg-slate-900/40' };
              }
            })();
            
            const icon = getTypeIcons(stat.tipo);

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
              <div key={stat.tipo} className="flex flex-col gap-2 h-full">
                {/* Category Card Container */}
                <div 
                  onClick={() => handleTypeClick(stat.tipo)}
                  className={`rounded-2xl border transition-all duration-300 p-4 sm:p-5 cursor-pointer flex flex-col xl:flex-row xl:items-center justify-between gap-4 select-none h-full ${catStyles.bg} ${catStyles.border} ${
                    isExpanded ? 'shadow-md border-b-4 scale-[1.01]' : 'shadow-sm hover:shadow opacity-95 hover:opacity-100'
                  }`}
                >
                  {/* Left block: circular icon + info list */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${catStyles.circleBg}`}>
                      {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight ${catStyles.text}`}>
                        {stat.tipo}
                      </h3>
                      {/* Stats in line */}
                      <div className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 mt-0.5">
                        <span className="text-slate-900 dark:text-white font-black">{formatNum(stat.pares)} {stat.tipo === 'ACESSÓRIO' ? 'unid.' : 'pares'}</span>
                        <span className="text-slate-300 hidden sm:inline">•</span>
                        <span className="text-emerald-600 font-semibold w-full sm:w-auto">{formatBRLValue(stat.valor)}</span>
                        <span className="text-slate-300 hidden sm:inline">•</span>
                        <span className="text-blue-500 font-black w-full sm:w-auto">{mixPct.toFixed(1)}% mix</span>
                      </div>

                      {/* Sub-info infantil: menina × menino (with fixed height for symmetry) */}
                      <div className="flex gap-2 mt-1 min-h-[16px]">
                        {tipoBase === 'INFANTIL' && (paresMenina + paresMenino) > 0 ? (
                          <React.Fragment>
                            <span className="text-[10px] font-bold text-pink-500">♀ {paresMenina}p ({((paresMenina / (paresMenina + paresMenino)) * 100).toFixed(0)}%)</span>
                            <span className="text-[10px] font-bold text-blue-500">♂ {paresMenino}p ({((paresMenino / (paresMenina + paresMenino)) * 100).toFixed(0)}%)</span>
                          </React.Fragment>
                        ) : (
                          <span className="text-[10px]">{` `}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right block: big donut */}
                  <div className="flex items-center gap-3 self-end xl:self-auto mt-2 xl:mt-0">
                    {tipoBase === 'INFANTIL' && (paresMenina + paresMenino) > 0 ? (
                      <DonutInfantil paresMenina={paresMenina} paresMenino={paresMenino} small={false} />
                    ) : modoLoja ? (
                      <DonutMeta meta={metaPct} realizado={realizadoPctMeta} cor={donutCor.forte} corClaro={donutCor.claro} label="META" small={false} />
                    ) : (
                      <DonutMeta meta={mixPct} realizado={mixPct} cor={donutCor.forte} corClaro={donutCor.claro} label="MIX" small={false} />
                    )}
                    
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded Model Details full width */}
        {expandedStat && (
          <div className="mt-6 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Lista de Modelos Comprados — {expandedStat.tipo}
              </h4>
            </div>
            {expandedStat.tipo === 'INFANTIL' ? (
              <div className="bg-white dark:bg-slate-900 overflow-auto max-h-[500px]">
                {['FEMININO', 'MASCULINO', 'UNISSEX'].map(subtipo => {
                  const subModelos = expandedStat.modelos.filter(m => m.subtipo === subtipo);
                  if (subModelos.length === 0) return null;
                  return (
                    <div key={subtipo} className="border-b last:border-0 border-slate-100 dark:border-slate-800">
                      <div className="bg-slate-50/50 dark:bg-slate-800/20 px-5 py-2 font-black text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                        {subtipo} INFANTIL
                      </div>
                      {renderPremiumModelList(subModelos, subtipo, expandedStat.tipo)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 overflow-auto max-h-[500px]">
                {renderPremiumModelList(expandedStat.modelos, '', expandedStat.tipo)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderPorLojaTab = () => {
    // Collect model stats for currently selected store (lojaFiltro)
    const storeModels: { category: string; subtipo: string; modelo: string; pares: number; valor: number }[] = [];
    if (lojaFiltro !== null) {
      typeStats.forEach(ts => {
        ts.modelos.forEach(m => {
          const pares = m.pares_por_loja?.[lojaFiltro] || 0;
          const valor = m.valor_por_loja?.[lojaFiltro] || 0;
          if (pares > 0) {
            storeModels.push({
              category: ts.tipo,
              subtipo: m.subtipo || '',
              modelo: m.modelo,
              pares,
              valor
            });
          }
        });
      });
      storeModels.sort((a, b) => b.pares - a.pares);
    }

    return (
      <div className="space-y-6">
        {/* Totais por loja table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <StoreIcon size={18} /> Compras por Loja
            </h2>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded dark:bg-slate-700">
              {lojaFiltro !== null ? 'Loja Selecionada' : 'Todas as Lojas'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white dark:bg-slate-900 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#334155]">
                <tr>
                  <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400">Loja</th>
                  <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400">Cidade</th>
                  <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-right">Pares</th>
                  <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-right">Unid.</th>
                  <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-right">Valor</th>
                  <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-center">Pedidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStoreStats.map(s => (
                  <tr key={s.loja} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3 font-black text-blue-600 dark:text-blue-400">Loja {s.loja}</td>
                    <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-300">{s.cidade}</td>
                    <td className="px-6 py-3 text-right font-black text-slate-900 dark:text-slate-200">{formatNum(s.pares)}</td>
                    <td className="px-6 py-3 text-right font-black text-slate-900 dark:text-slate-200">{formatNum(s.unidades)}</td>
                    <td className="px-6 py-3 text-right text-emerald-600 font-bold">{formatBRLValue(s.valor)}</td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] px-2 py-0.5 rounded">
                        {s.pedidos}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredStoreStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">Nenhum dado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drill-down: itens por loja */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
              📦 Detalhamento de Itens por Loja
            </h2>
          </div>
          
          {lojaFiltro === null ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-xs">
              Selecione uma loja específica no menu de filtros do topo para visualizar o detalhamento de itens e modelos desta filial.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white dark:bg-slate-900 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#334155]">
                  <tr>
                    <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400">Rank</th>
                    <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400">Modelo</th>
                    <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400">Categoria</th>
                    <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-right">Qtd. Compra</th>
                    <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {storeModels.map((item, idx) => (
                    <tr key={`${item.category}-${item.subtipo}-${item.modelo}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-3 font-bold text-slate-500">#{idx + 1}</td>
                      <td className="px-6 py-3 font-black text-slate-900 dark:text-white uppercase text-xs">{item.modelo}</td>
                      <td className="px-6 py-3 font-bold text-slate-500 text-xs">
                        {item.category} {item.subtipo ? `(${item.subtipo})` : ''}
                      </td>
                      <td className="px-6 py-3 text-right font-black text-slate-900 dark:text-slate-200">{formatNum(item.pares)}</td>
                      <td className="px-6 py-3 text-right text-emerald-600 font-bold">{formatBRLValue(item.valor)}</td>
                    </tr>
                  ))}
                  {storeModels.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">Nenhum item comprado nesta filial</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPorMarcaTab = () => {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Tag size={18} /> Compras por Marca
          </h2>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded dark:bg-slate-700">{brandStats.length} marcas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white dark:bg-slate-900 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#334155]">
              <tr>
                <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400">Marca</th>
                <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-right">Pares</th>
                <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-right">Valor</th>
                <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 text-right w-20">% Total</th>
                <th className="px-6 py-3 font-black text-[10px] uppercase tracking-wider text-slate-400 w-24">Barra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {brandStats.map(b => (
                <tr key={b.marca} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3 font-black text-slate-900 dark:text-white uppercase text-[11px]">{b.marca}</td>
                  <td className="px-6 py-3 text-right font-bold text-slate-700 dark:text-slate-300">{formatNum(b.pares)}</td>
                  <td className="px-6 py-3 text-right text-emerald-600 font-bold">{formatBRLValue(b.valor)}</td>
                  <td className="px-6 py-3 text-right font-black text-slate-600 dark:text-slate-400">{b.percentual.toFixed(0)}%</td>
                  <td className="px-6 py-3">
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, b.percentual))}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {brandStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">Nenhum dado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderModelosTab = () => {
    // Flatten all models with their categories
    const allModels: { category: string; subtipo: string; modelo: string; pares: number; valor: number; percentual: number; raw: ModelStat }[] = [];
    filteredTypeStats.forEach(ts => {
      ts.modelos.forEach(m => {
        allModels.push({
          category: ts.tipo,
          subtipo: m.subtipo || '',
          modelo: m.modelo,
          pares: m.pares,
          valor: m.valor,
          percentual: m.percentual,
          raw: m
        });
      });
    });

    // Filter by query
    const filteredAllModels = allModels.filter(m => 
      m.modelo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subtipo.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-6">
        {/* Search header bar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Buscar por modelo, categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div className="text-xs font-bold text-slate-400">
            Exibindo {filteredAllModels.length} de {allModels.length} modelos
          </div>
        </div>

        {/* Display complete model list */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          {renderPremiumModelList(filteredAllModels.map(f => f.raw), '', 'TODOS')}
        </div>
      </div>
    );
  };

  const renderRelatoriosTab = () => {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center max-w-xl mx-auto space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto text-2xl font-bold">
          📊
        </div>
        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
          Central de Relatórios
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
          Consulte relatórios gerados automaticamente, exportações de grades consolidadas e relatórios analíticos de compras.
        </p>
        <div className="pt-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-wider">
            ⚡ Em Breve
          </span>
        </div>
      </div>
    );
  };

  const renderConfigTab = () => {
    const isReadOnly = user?.role?.toLowerCase() === 'manager';
    const storeToUse = lojaFiltro || userStoreNumber || 5;

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-lg">
              ⚙️
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                CONFIGURAÇÃO DE RESTRIÇÕES E ALERTAS
              </h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">
                Defina regras de compra, restrições de marcas e produtos por loja
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-black text-slate-400 uppercase">LOJA ALVO:</span>
            <select
              value={storeToUse}
              onChange={(e) => setLojaFiltro(Number(e.target.value))}
              disabled={userStoreNumber !== null}
              className="bg-transparent text-[11px] font-black text-slate-700 dark:text-slate-300 outline-none cursor-pointer border-none p-0 focus:ring-0"
            >
              {LOJAS.map(num => (
                <option key={num} value={num}>Loja {num}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna 1: Alertas e Restrições da Loja */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
                <span>📍</span> REGRAS E GRADE DA LOJA {storeToUse}
              </h4>
              <AlertasGradePorLoja storeNumber={String(storeToUse)} readOnly={isReadOnly} />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
                <span>🚫</span> RESTRIÇÕES DE MARCA (LOJA {storeToUse})
              </h4>
              <AlertasMarcaStore storeNumber={String(storeToUse)} readOnly={isReadOnly} />
            </div>
          </div>

          {/* Coluna 2: Restrições de Produto da Loja e Globais */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
                <span>❌</span> RESTRIÇÕES DE PRODUTO (LOJA {storeToUse})
              </h4>
              <AlertasProdutoStore storeNumber={String(storeToUse)} readOnly={isReadOnly} />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
                <span>🌎</span> PARÂMETROS E ALERTAS GLOBAIS
              </h4>
              <div className="space-y-6 pt-2">
                <AlertasMarcaGlobal readOnly={isReadOnly} />
                <AlertasProdutoGlobal readOnly={isReadOnly} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      {/* Sidebar Navigation */}
      <BuyOrderDashboardBarra activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Pane */}
      <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Header + filtro */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-blue-600 dark:text-blue-400" size={28} />
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Dashboard de Compras
                {lojaFiltro !== null && <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full">Loja {lojaFiltro}</span>}
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Sessão Ativa: <span className="text-slate-600 dark:text-slate-300">{activeTab.replace('_', ' ').toUpperCase()}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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

            {activeTab === 'meta_mix' && (
              <div className="flex items-center gap-2 pb-1">
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mês:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="bg-transparent text-xs font-black text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                  >
                    {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m, idx) => (
                      <option key={idx} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ano:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent text-xs font-black text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                  >
                    {[2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab contents */}
        <div className="mt-6">
          {activeTab === 'resumo' && renderResumoTab()}
          {activeTab === 'por_loja' && renderPorLojaTab()}
          {activeTab === 'por_marca' && renderPorMarcaTab()}
          {activeTab === 'modelos' && renderModelosTab()}
          {activeTab === 'relatorios' && renderRelatoriosTab()}
          {activeTab === 'meta_mix' && (
            <BuyOrderParams 
              user={user} 
              readOnly={user?.role?.toLowerCase() === 'manager'} 
              realizedSubtypes={realizedSubtypes} 
              selectedStoreNumber={String(lojaFiltro || userStoreNumber || 5)}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          )}
          {activeTab === 'config' && renderConfigTab()}
        </div>

      </div>
    </div>
  );
}