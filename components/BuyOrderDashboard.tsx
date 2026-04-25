import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Package, Store as StoreIcon, Activity, BarChart3, Tag, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';

interface DashboardSummary {
  total_pares: number;
  valor_total: number;
}

interface TypeStat {
  tipo: string; // The normalized name: FEMININO, MASCULINO, etc.
  pares: number;
  valor: number;
  percentual: number;
  modelos: ModelStat[];
}

interface ModelStat {
  subtipo?: string; // For Infantil: FEMININO / MASCULINO
  modelo: string; // Actually 'tipo' in DB
  pares: number;
  valor: number;
  percentual: number;
}

interface StoreStat {
  loja: string;
  cidade: string;
  pares: number;
  valor: number;
  pedidos: number;
}

interface BrandStat {
  marca: string;
  pares: number;
  valor: number;
  percentual: number;
}

export default function BuyOrderDashboard({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [typeStats, setTypeStats] = useState<TypeStat[]>([]);
  const [storeStats, setStoreStats] = useState<StoreStat[]>([]);
  const [brandStats, setBrandStats] = useState<BrandStat[]>([]);
  
  const [expandedType, setExpandedType] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      
      const { data: orders, error: oError } = await supabase
        .from('buy_orders')
        .select(`
          id,
          marca,
          status,
          created_at,
          buy_order_items ( total_pares, custo, tipo, modelo ),
          buy_order_sub_orders ( lojas_numeros )
        `)
        .eq('status', 'confirmado')
        .gte('created_at', `${currentYear}-01-01T00:00:00.000Z`)
        .lte('created_at', `${currentYear}-12-31T23:59:59.999Z`);

      if (oError) throw oError;

      const { data: storesObj, error: sError } = await supabase.from('stores').select('number, city');
      if (sError) throw sError;
      const cityMap = new Map<string, string>();
      storesObj?.forEach(s => cityMap.set(String(s.number), s.city));

      let totalPares = 0;
      let valorTotal = 0;

      const storeAgg = new Map<string, { pares: number; valor: number; pedidos: Set<number> }>();
      const brandAgg = new Map<string, { pares: number; valor: number }>();
      
      // key: Normalized Department (FEMININO, etc.)
      const typeAgg = new Map<string, { 
        pares: number; 
        valor: number; 
        modelStats: Map<string, { pares: number; valor: number }> 
      }>();

      for (const order of (orders || [])) {
        let orderPares = 0;
        let orderCusto = 0;

        for (const item of (order.buy_order_items || [])) {
          const p = Number(item.total_pares || 0);
          const v = Number(item.custo || 0) * p;
          
          orderPares += p;
          orderCusto += v;

          // Type Aggregation
          // Note: our DB stores 'FEM', 'MASC', 'INF', 'ACESS' in `modelo`
          // And the actual footwear type (Sandália, Tênis) in `tipo`
          let dept = (item.modelo || 'OUTROS').toUpperCase();
          if (dept === 'FEM') dept = 'FEMININO';
          if (dept === 'MASC') dept = 'MASCULINO';
          if (dept === 'INF') dept = 'INFANTIL';
          if (dept === 'ACESS') dept = 'ACESSÓRIO';
          
          let subCat = (item.tipo || 'OUTROS').toUpperCase();
          
          // For Infantil, we split into FEMININO/MASCULINO based on the string
          let mapKey = subCat;
          if (dept === 'INFANTIL') {
            if (subCat.includes('FEM') || subCat.includes('MENINA')) {
              mapKey = 'FEMININO|' + subCat;
            } else if (subCat.includes('MASC') || subCat.includes('MENINO')) {
              mapKey = 'MASCULINO|' + subCat;
            } else {
              mapKey = 'UNISSEX|' + subCat;
            }
          }

          const tAgg = typeAgg.get(dept) || { pares: 0, valor: 0, modelStats: new Map() };
          tAgg.pares += p;
          tAgg.valor += v;
          
          const mAgg = tAgg.modelStats.get(mapKey) || { pares: 0, valor: 0 };
          mAgg.pares += p;
          mAgg.valor += v;
          
          tAgg.modelStats.set(mapKey, mAgg);
          typeAgg.set(dept, tAgg);
        }

        totalPares += orderPares;
        valorTotal += orderCusto;

        // Brand Agg
        const bAgg = brandAgg.get(order.marca) || { pares: 0, valor: 0 };
        bAgg.pares += orderPares;
        bAgg.valor += orderCusto;
        brandAgg.set(order.marca, bAgg);

        // Store Agg
        for (const sub of (order.buy_order_sub_orders || [])) {
          const lojas = sub.lojas_numeros || [];
          for (const lojaRaw of lojas) {
            const loja = String(lojaRaw);
            const sAgg = storeAgg.get(loja) || { pares: 0, valor: 0, pedidos: new Set() };
            sAgg.pares += orderPares;
            sAgg.valor += orderCusto;
            sAgg.pedidos.add(order.id);
            storeAgg.set(loja, sAgg);
          }
        }
      }

      setSummary({ total_pares: totalPares, valor_total: valorTotal });

      const stStats: StoreStat[] = Array.from(storeAgg.entries()).map(([loja, agg]) => ({
        loja,
        cidade: cityMap.get(loja) || 'Desconhecida',
        pares: agg.pares,
        valor: agg.valor,
        pedidos: agg.pedidos.size
      })).sort((a, b) => Number(a.loja) - Number(b.loja));
      setStoreStats(stStats);

      const brStats: BrandStat[] = Array.from(brandAgg.entries()).map(([marca, agg]) => ({
        marca: marca || 'SEM MARCA',
        pares: agg.pares,
        valor: agg.valor,
        percentual: totalPares > 0 ? (agg.pares / totalPares) * 100 : 0
      })).sort((a, b) => b.pares - a.pares).slice(0, 18);
      setBrandStats(brStats);

      const builtTypes: TypeStat[] = Array.from(typeAgg.entries()).map(([tipo, agg]) => {
        const typePares = agg.pares;
        const typeModelos: ModelStat[] = Array.from(agg.modelStats.entries()).map(([key, mAgg]) => {
          let subtipo = undefined;
          let modelo = key;
          if (tipo === 'INFANTIL' && key.includes('|')) {
            const parts = key.split('|');
            subtipo = parts[0];
            modelo = parts[1];
          }
          return {
            subtipo,
            modelo,
            pares: mAgg.pares,
            valor: mAgg.valor,
            percentual: typePares > 0 ? (mAgg.pares / typePares) * 100 : 0
          };
        }).sort((a, b) => b.pares - a.pares);

        return {
          tipo,
          pares: agg.pares,
          valor: agg.valor,
          percentual: totalPares > 0 ? (agg.pares / totalPares) * 100 : 0,
          modelos: typeModelos
        };
      });
      
      const sortOrder = ['FEMININO', 'MASCULINO', 'INFANTIL', 'ACESSÓRIO'];
      builtTypes.sort((a, b) => {
        let idxA = sortOrder.indexOf(a.tipo);
        let idxB = sortOrder.indexOf(b.tipo);
        if (idxA === -1) idxA = 99;
        if (idxB === -1) idxB = 99;
        return idxA - idxB;
      });

      setTypeStats(builtTypes);

    } catch (err) {
      console.error('Erro ao buscar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeClick = (tipo: string) => {
    if (expandedType === tipo) {
      setExpandedType(null);
    } else {
      setExpandedType(tipo);
    }
  };

  const formatBRLValue = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatNum = (val: number) => {
    return val.toLocaleString('pt-BR');
  };

  const getTypeStyles = (tipo: string) => {
    switch(tipo) {
      case 'FEMININO': return 'bg-pink-50 border-pink-500 text-pink-700';
      case 'MASCULINO': return 'bg-blue-50 border-blue-500 text-blue-700';
      case 'INFANTIL': return 'bg-purple-50 border-purple-500 text-purple-700';
      case 'ACESSÓRIO': return 'bg-amber-50 border-amber-500 text-amber-700';
      default: return 'bg-slate-50 border-slate-500 text-slate-700';
    }
  };
  
  const getTypeIcons = (tipo: string) => {
    switch(tipo) {
      case 'FEMININO': return '👗';
      case 'MASCULINO': return '👔';
      case 'INFANTIL': return '👶';
      case 'ACESSÓRIO': return '💼';
      default: return '📦';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
        <Activity className="animate-spin text-blue-600 mb-4" size={32} />
      </div>
    );
  }

  const expandedStat = typeStats.find(t => t.tipo === expandedType);

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <BarChart3 className="text-blue-600 dark:text-blue-400" size={28} />
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
              Dashboard de Compras
            </h1>
          </div>
        </div>

        {/* 1. CARDS DE RESUMO (mesmo tamanho, lado a lado) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col justify-center">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
              <Package size={16} /> Total de Pares
            </div>
            <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">
              {formatNum(summary?.total_pares || 0)} <span className="text-lg font-medium text-slate-400">pares</span>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col justify-center">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
              <DollarSign size={16} /> Total Compra
            </div>
            <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">
              {formatBRLValue(summary?.valor_total || 0)}
            </div>
          </div>
        </div>

        {/* 2. CARDS POR TIPO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {['FEMININO', 'MASCULINO', 'INFANTIL', 'ACESSÓRIO'].map((tipoBase) => {
            const stat = typeStats.find(t => t.tipo === tipoBase) || { tipo: tipoBase, pares: 0, valor: 0, percentual: 0, modelos: [] };
            const isExpanded = expandedType === stat.tipo;
            const style = getTypeStyles(stat.tipo);
            const icon = getTypeIcons(stat.tipo);

            return (
              <div 
                key={stat.tipo}
                onClick={() => handleTypeClick(stat.tipo)}
                className={`rounded-xl border cursor-pointer transition-all duration-200 p-4 ${style} 
                            ${isExpanded ? 'shadow-md scale-[1.02] border-b-4' : 'shadow-sm hover:shadow opacity-90 hover:opacity-100 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200'}`}
              >
                <div className="font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>{icon}</span> {stat.tipo}
                </div>
                <div className="flex flex-col gap-1 mb-3">
                  <div className="font-bold text-lg leading-none">{formatNum(stat.pares)} <span className="text-[10px] font-normal uppercase opacity-70">{stat.tipo === 'ACESSÓRIO' ? 'unid.' : 'pares'}</span></div>
                  <div className="font-bold text-sm leading-none opacity-90">{formatBRLValue(stat.valor)}</div>
                  <div className="font-bold text-lg leading-none opacity-70">{stat.percentual.toFixed(1)}%</div>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 opacity-70">
                  {isExpanded ? <><ChevronDown size={14} /> Fechar</> : <><ChevronRight size={14} /> Detalhes</>}
                </div>
              </div>
            );
          })}
        </div>

        {/* DETALHAMENTO EXPANDIDO */}
        {expandedStat && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className={`rounded-xl shadow-md border ${getTypeStyles(expandedStat.tipo)} p-0 overflow-hidden dark:bg-slate-800 dark:border-slate-700`}>
              <div className="px-6 py-4 border-b border-opacity-20 flex items-center gap-2 font-bold uppercase tracking-wider text-sm dark:text-slate-200">
                {getTypeIcons(expandedStat.tipo)} {expandedStat.tipo} - Modelos Comprados
              </div>
              
              {expandedStat.tipo === 'INFANTIL' ? (
                // Infantil precisa dividir por gênero
                <div className="bg-white dark:bg-slate-900 border-t border-opacity-20">
                  {['FEMININO', 'MASCULINO', 'UNISSEX'].map(subtipo => {
                    const subModelos = expandedStat.modelos.filter(m => m.subtipo === subtipo);
                    if (subModelos.length === 0) return null;
                    return (
                      <div key={subtipo} className="border-b last:border-0 border-slate-100 dark:border-slate-800">
                        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-2 font-black text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          {getTypeIcons(subtipo)} {subtipo} INFANTIL
                        </div>
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-white dark:bg-slate-900">
                            <tr>
                              <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">Modelo</th>
                              <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">Pares</th>
                              <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">Valor</th>
                              <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right w-32">% do Tipo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {subModelos.map(m => (
                              <tr key={m.modelo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-3 font-bold text-slate-900 dark:text-slate-200">{m.modelo}</td>
                                <td className="px-6 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{formatNum(m.pares)}</td>
                                <td className="px-6 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatBRLValue(m.valor)}</td>
                                <td className="px-6 py-3 text-right font-bold text-slate-500">{m.percentual.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              ) : (
                // Outros tipos são tabelas simples
                <div className="bg-white dark:bg-slate-900 p-0 border-t border-opacity-20 overflow-auto max-h-[400px]">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">Modelo</th>
                        <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">{expandedStat.tipo === 'ACESSÓRIO' ? 'Unid.' : 'Pares'}</th>
                        <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">Valor</th>
                        <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right w-32">% do Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {expandedStat.modelos.map(m => (
                        <tr key={m.modelo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-3 font-bold text-slate-900 dark:text-slate-200">{m.modelo}</td>
                          <td className="px-6 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{formatNum(m.pares)}</td>
                          <td className="px-6 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatBRLValue(m.valor)}</td>
                          <td className="px-6 py-3 text-right font-bold text-slate-500">{m.percentual.toFixed(1)}%</td>
                        </tr>
                      ))}
                      {expandedStat.modelos.length === 0 && (
                        <tr><td colSpan={4} className="py-8 text-center text-slate-400 italic">Nenhum dado encontrado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TABELAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          
          {/* Compras por Loja */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[500px]">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <StoreIcon size={18} /> Compras por Loja
              </h2>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
                18 Lojas
              </span>
            </div>
            <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white dark:bg-slate-900 sticky top-0 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#1e293b]">
                  <tr>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Loja</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Cidade</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">Pares</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">Valor</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">Pedidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {storeStats.map((s) => (
                    <tr key={s.loja} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-2.5 font-black text-blue-600 dark:text-blue-400">{s.loja}</td>
                      <td className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-300">{s.cidade}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-slate-900 dark:text-slate-200">{formatNum(s.pares)}</td>
                      <td className="px-5 py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">{formatBRLValue(s.valor)}</td>
                      <td className="px-5 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] px-2 py-0.5 rounded">
                          {s.pedidos}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {storeStats.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">Nenhum dado encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compras por Marca */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[500px]">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Tag size={18} /> Compras por Marca
              </h2>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
                Top 18
              </span>
            </div>
            <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white dark:bg-slate-900 sticky top-0 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#1e293b]">
                  <tr>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Marca</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">Pares</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">Valor</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 w-24">% Total</th>
                    <th className="px-5 py-3 font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 w-24">Barra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {brandStats.map((b) => (
                    <tr key={b.marca} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-2.5 font-bold text-slate-900 dark:text-white uppercase text-[11px]">{b.marca}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">{formatNum(b.pares)}</td>
                      <td className="px-5 py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">{formatBRLValue(b.valor)}</td>
                      <td className="px-5 py-2.5 text-right font-black text-slate-600 dark:text-slate-400">{b.percentual.toFixed(0)}%</td>
                      <td className="px-5 py-2.5">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex items-center justify-start">
                          <div 
                            className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, b.percentual))}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {brandStats.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">Nenhum dado encontrado</td></tr>
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
