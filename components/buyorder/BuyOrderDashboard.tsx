import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
  Package, 
  Store as StoreIcon, 
  TrendingUp, 
  CheckCircle, 
  ChevronDown,
  ChevronUp,
  DollarSign,
  Loader2,
  Tags
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Helper Functions (Defined outside to avoid hook issues) ---
const formatValue = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val);
};

const getTypeIcons = (type: string) => {
  const t = (type || '').toUpperCase();
  switch(t) {
    case 'FEMININO': return '👠';
    case 'MASCULINO': return '👔';
    case 'INFANTIL': return '👶';
    case 'ACESSÓRIO': return '💼';
    default: return '📦';
  }
};

// --- Main Component ---
export default function BuyOrderDashboard({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [userStoreNumber, setUserStoreNumber] = useState<number | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [typeStats, setTypeStats] = useState<any[]>([]);
  const [storeStats, setStoreStats] = useState<any[]>([]);
  const [brandStats, setBrandStats] = useState<any[]>([]);
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
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

      const typeMap: Record<string, any> = {};
      const storeMap: Record<number, any> = {};
      const brandMap: Record<string, any> = {};
      let totalValue = 0;
      let totalPairs = 0;

      orders?.forEach(order => {
        const orderValue = order.buy_order_items?.reduce((acc: number, item: any) => acc + (item.total_pares * item.custo), 0) || 0;
        const orderPairs = order.buy_order_items?.reduce((acc: number, item: any) => acc + item.total_pares, 0) || 0;

        const relevantStores = order.buy_order_sub_orders?.flatMap((so: any) => so.lojas_numeros) || [];
        const isSelfOrder = userStoreNumber === null || relevantStores.includes(userStoreNumber);

        if (isSelfOrder) {
          totalValue += orderValue;
          totalPairs += orderPairs;
          brandMap[order.marca] = (brandMap[order.marca] || 0) + orderValue;
          order.buy_order_items?.forEach((item: any) => {
            const val = item.total_pares * item.custo;
            if (!typeMap[item.tipo]) {
              typeMap[item.tipo] = { total: 0, items: {} };
            }
            typeMap[item.tipo].total += val;
            typeMap[item.tipo].items[item.modelo] = (typeMap[item.tipo].items[item.modelo] || 0) + val;
          });
          relevantStores.forEach((sNum: number) => {
              if (userStoreNumber === null || sNum === userStoreNumber) {
                  storeMap[sNum] = (storeMap[sNum] || 0) + (orderValue / Math.max(1, relevantStores.length));
              }
          });
        }
      });

      setSummary({ totalValue, totalPairs, orderCount: orders?.length || 0 });
      setTypeStats(Object.keys(typeMap).map(k => ({ 
          type: k, 
          value: typeMap[k].total,
          items: Object.keys(typeMap[k].items).map(i => ({ name: i, value: typeMap[k].items[i] }))
      })));
      setStoreStats(Object.keys(storeMap).map(k => ({ store: k, value: storeMap[k] })));
      setBrandStats(Object.keys(brandMap).map(k => ({ brand: k, value: brandMap[k] })).sort((a,b) => b.value - a.value).slice(0, 10));

    } catch (err) {
      console.error('❌ Dashboard Error:', err);
    } finally {
      setLoading(false);
    }
  }, [userStoreNumber]);

  useEffect(() => {
    async function fetchStoreNumber() {
      if (!user?.storeId || user.role === 'ADMIN') {
        setUserStoreNumber(null);
        return;
      }
      const { data } = await supabase.from('stores').select('number').eq('id', user.storeId).single();
      if (data?.number) {
        setUserStoreNumber(parseInt(data.number));
      }
    }
    fetchStoreNumber();
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando inteligência de pedidos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400">
              <DollarSign size={24} />
            </div>
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Comprado (Ano)</h3>
          </div>
          <p className="text-3xl font-black italic text-slate-900 dark:text-white">{formatValue(summary?.totalValue || 0)}</p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-600 dark:text-purple-400">
              <Package size={24} />
            </div>
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total de Pares</h3>
          </div>
          <p className="text-3xl font-black italic text-slate-900 dark:text-white">{(summary?.totalPairs || 0).toLocaleString()} <span className="text-sm not-italic opacity-40">UN</span></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl text-green-600 dark:text-green-400">
              <CheckCircle size={24} />
            </div>
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pedidos Confirmados</h3>
          </div>
          <p className="text-3xl font-black italic text-slate-900 dark:text-white">{summary?.orderCount || 0}</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black italic uppercase text-slate-900 dark:text-white flex items-center gap-3">
              <Tags className="text-blue-600" size={24} />
              Distribuição por Tipo
            </h2>
          </div>
          
          <div className="space-y-4 flex-1">
            {typeStats.map((stat) => (
              <div key={stat.type} className="group">
                <button 
                  onClick={() => setExpandedType(expandedType === stat.type ? null : stat.type)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl transition-all hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xl">{getTypeIcons(stat.type)}</span>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.type}</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{formatValue(stat.value)}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div className="hidden md:block">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">
                        {((stat.value / summary?.totalValue) * 100).toFixed(1)}%
                      </p>
                    </div>
                    {expandedType === stat.type ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedType === stat.type && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-white dark:bg-slate-900 border-x border-b border-slate-100 dark:border-slate-800 rounded-b-2xl mx-2"
                    >
                      <div className="p-4 space-y-2">
                        {stat.items.map((item: any) => (
                          <div key={item.name} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0 px-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">{item.name}</span>
                            <span className="text-[11px] font-black text-slate-900 dark:text-white">{formatValue(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 dark:bg-black p-8 rounded-[32px] shadow-2xl text-white flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-3">
              <TrendingUp className="text-blue-400" size={24} />
              Concentração de Marcas
            </h2>
          </div>

          <div className="space-y-6 flex-1">
            {brandStats.map((stat, idx) => (
              <div key={stat.brand} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 w-4 tracking-tighter">#{idx + 1}</span>
                    <span className="text-xs font-black uppercase tracking-widest">{stat.brand}</span>
                  </div>
                  <span className="text-xs font-bold text-blue-400">{formatValue(stat.value)}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: brandStats[0]?.value ? `${(stat.value / brandStats[0].value) * 100}%` : '0%' }}
                    transition={{ duration: 1, delay: idx * 0.1 }}
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
