import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  DollarSign, 
  ChevronDown, 
  ChevronUp, 
  Store, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Filter,
  User as UserIcon,
  CreditCard,
  History,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, UserRole } from '../types';

// ──────────────────────────────────────────────────────────────────────────────
// TIPOS
// ──────────────────────────────────────────────────────────────────────────────

interface QuotaData {
  id: string;
  store_number: number;
  year: number;
  month: number;
  
  comprador_inicial: number;
  comprador_comprometido: number;
  comprador_disponivel: number;
  
  gerente_inicial: number;
  gerente_comprometido: number;
  gerente_disponivel: number;
}

interface TransactionDetail {
  numero_pedido: number | string;
  marca: string;
  created_at: string;
  prazos: number[];
  vencimentos: string[];
  valor_abatido: number;
  tipo_comprador: 'GERENTE' | 'COMPRADOR';
}

interface StoreItem {
  number: number;
  name: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ──────────────────────────────────────────────────────────────────────────────

export default function BuyOrderQuotaView({ user }: { user: User }) {
  const [loading, setLoading] = useState(true);
  const [quotas, setQuotas] = useState<QuotaData[]>([]);
  const [selectedStore, setSelectedStore] = useState<number>(Number(user.storeId) || 5);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [roleMode, setRoleMode] = useState<'COMPRADOR' | 'GERENTE'>(
    (user.role === UserRole.MANAGER) ? 'GERENTE' : 'COMPRADOR'
  );
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, TransactionDetail[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  const isAdmin = user.role === UserRole.ADMIN;

  // 1. Carregar Lojas (se admin)
  useEffect(() => {
    async function fetchStores() {
      if (!isAdmin) return;
      const { data } = await supabase
        .from('v_stores_quota_config')
        .select('store_number')
        .eq('month', 1) // Apenas para listar lojas únicas
        .order('store_number');
      
      if (data) {
        setStores(data.map(s => ({ number: s.store_number, name: `Loja ${s.store_number}` })));
      }
    }
    fetchStores();
  }, [isAdmin]);

  // 2. Query Principal: Buscar Cotas Futuras
  const fetchQuotas = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const { data, error } = await supabase.rpc('get_buy_order_quotas_future', {
        p_store_number: String(selectedStore),
        p_tipo_comprador: roleMode
      });

      if (error) throw error;
      
      if (data) {
        const mapped = data.map((row: any) => ({
          ...row,
          comprador_inicial: roleMode === 'COMPRADOR' ? row.cota_inicial : 0,
          comprador_comprometido: roleMode === 'COMPRADOR' ? row.cota_comprometida : 0,
          comprador_disponivel: roleMode === 'COMPRADOR' ? row.cota_disponivel : 0,
          gerente_inicial: roleMode === 'GERENTE' ? row.cota_inicial : 0,
          gerente_comprometido: roleMode === 'GERENTE' ? row.cota_comprometida : 0,
          gerente_disponivel: roleMode === 'GERENTE' ? row.cota_disponivel : 0
        }));
        setQuotas(mapped);
      } else {
        setQuotas([]);
      }
    } catch (err) {
      console.error('Erro ao buscar cotas:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    fetchQuotas();
    const interval = setInterval(fetchQuotas, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [fetchQuotas]);

  // 3. Detalhamento (pedidos por mês)
  const toggleDetails = async (year: number, month: number) => {
    const key = `${year}-${month}-${roleMode}`;
    if (expandedMonth === key) {
      setExpandedMonth(null);
      return;
    }

    setExpandedMonth(key);
    if (details[key]) return; // Já carregado

    setLoadingDetails(key);
    try {
      const { data, error } = await supabase.rpc('get_buy_order_quota_transactions_details', {
        p_store_number: String(selectedStore),
        p_year: year,
        p_month: month,
        p_tipo_comprador: roleMode
      });

      if (error) throw error;
      setDetails(prev => ({ ...prev, [key]: data || [] }));
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
    } finally {
      setLoadingDetails(null);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // HELPERS VISUAIS
  // ────────────────────────────────────────────────────────────────────────────

  const formatarMoeda = (valor: number) => 
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getMonthName = (m: number) => {
    const names = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    return names[m - 1];
  };

  const getStatusConfig = (percentual: number) => {
    if (percentual >= 50) return { color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: <CheckCircle2 className="w-4 h-4" />, border: 'border-emerald-200 dark:border-emerald-800' };
    if (percentual >= 25) return { color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: <AlertCircle className="w-4 h-4" />, border: 'border-amber-200 dark:border-amber-800' };
    if (percentual >= 10) return { color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20', icon: <AlertCircle className="w-4 h-4" />, border: 'border-rose-200 dark:border-rose-800' };
    return { color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-900/30', icon: <AlertCircle className="w-4 h-4" />, border: 'border-red-300 dark:border-red-900' };
  };

  const currentMonthIdx = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      {/* HEADER */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <DollarSign size={120} className="text-slate-900 dark:text-white" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-slate-400">
                <Store size={18} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Cota de Compra</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                LOJA <span className="text-blue-600 dark:text-blue-400">{selectedStore}</span>
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <Calendar size={14} />
                  {getMonthName(currentMonthIdx)} / {currentYear}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  <UserIcon size={14} />
                  {roleMode}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {isAdmin && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Filter size={14} className="ml-2 text-slate-400" />
                  <select 
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(Number(e.target.value))}
                    className="bg-transparent border-none outline-none text-xs font-black uppercase text-slate-700 dark:text-slate-200 py-1.5 px-2"
                  >
                    {stores.length > 0 ? (
                      stores.map(s => <option key={s.number} value={s.number}>{s.name}</option>)
                    ) : (
                      <option value={selectedStore}>Loja {selectedStore}</option>
                    )}
                  </select>
                </div>
              )}
              
              <div className="flex gap-2">
                {(['COMPRADOR', 'GERENTE'] as const).map(role => (
                  <button
                    key={role}
                    onClick={() => setRoleMode(role)}
                    disabled={!isAdmin && roleMode !== role}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${
                      roleMode === role 
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg scale-[1.02]' 
                      : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    } ${(!isAdmin && roleMode !== role) ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    MODO {role}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && quotas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="text-blue-500 animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando com o banco...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {quotas.map((quota, idx) => {
                const isComprador = roleMode === 'COMPRADOR';
                const inicial = isComprador ? quota.comprador_inicial : quota.gerente_inicial;
                const comprometido = isComprador ? quota.comprador_comprometido : quota.gerente_comprometido;
                const disponivel = isComprador ? quota.comprador_disponivel : quota.gerente_disponivel;
                const percentual = inicial > 0 ? (disponivel / inicial) * 100 : 0;
                
                const status = getStatusConfig(percentual);
                const monthKey = `${quota.year}-${quota.month}-${roleMode}`;
                const isExpanded = expandedMonth === monthKey;

                return (
                  <motion.div
                    key={`${quota.year}-${quota.month}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    layout
                    className={`group bg-white dark:bg-slate-900 rounded-3xl border ${isExpanded ? 'border-blue-300 ring-4 ring-blue-500/5' : 'border-slate-200 dark:border-slate-800'} transition-all hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none overflow-hidden flex flex-col`}
                  >
                    {/* CARD HEADER */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{quota.year}</p>
                          <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase">{getMonthName(quota.month)}</h3>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${status.bg} ${status.color} text-[10px] font-black uppercase tracking-wider`}>
                          {status.icon}
                          {percentual.toFixed(0)}% Disp.
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cota Limpa</span>
                          <span className="text-sm font-black text-slate-700 dark:text-slate-200">{formatarMoeda(inicial)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comprometido</span>
                          <span className="text-sm font-black text-rose-500">{formatarMoeda(comprometido)}</span>
                        </div>
                        <div className={`p-4 rounded-2xl ${status.bg} border-l-4 border-l-current ${status.color}`}>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-70">Disponível Real</span>
                            <span className="text-2xl font-black tracking-tight">{formatarMoeda(disponivel)}</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => toggleDetails(quota.year, quota.month)}
                        className={`w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          isExpanded 
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' 
                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                        }`}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Ocultar Detalhes' : 'Ver Detalhamento'}
                      </button>
                    </div>

                    {/* EXPANDABLE SECTION */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
                        >
                          <div className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                              <History size={14} className="text-slate-400" />
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pedidos que vencem em {getMonthName(quota.month)}</span>
                            </div>

                            {loadingDetails === monthKey ? (
                              <div className="py-8 flex justify-center">
                                <Loader2 size={18} className="animate-spin text-blue-500" />
                              </div>
                            ) : details[monthKey]?.length ? (
                              <div className="space-y-3">
                                {details[monthKey].map((detail, dIdx) => (
                                  <div key={dIdx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm transition-all hover:scale-[1.01]">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Package size={14} className="text-blue-500" />
                                        <span className="text-xs font-black text-slate-700 dark:text-white uppercase">{detail.marca}</span>
                                      </div>
                                      <span className="text-sm font-black text-rose-500">{formatarMoeda(detail.valor_abatido)}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-slate-700/30">
                                      <span className="text-[9px] font-black text-slate-400 uppercase">PED: <span className="text-slate-600 dark:text-slate-300">#{detail.numero_pedido}</span></span>
                                      <span className="text-[9px] font-black text-slate-400 uppercase">GERADO: <span className="text-slate-600 dark:text-slate-300">{new Date(detail.created_at).toLocaleDateString('pt-BR')}</span></span>
                                    </div>
                                  </div>
                                ))}
                                <div className="mt-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Comprometido do Mês</span>
                                  <span className="text-lg font-black text-rose-500">{formatarMoeda(comprometido)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="py-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Nenhum abatimento registrado</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        
        {!loading && quotas.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500">
              <Package size={32} />
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase mb-2">Sem cota inicial configurada</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium capitalize">
                Não localizamos configurações de cota para a Loja {selectedStore} nos próximos meses. 
                {isAdmin ? " Verifique as configurações globais ou por loja." : " Entre em contato com seu administrador."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
