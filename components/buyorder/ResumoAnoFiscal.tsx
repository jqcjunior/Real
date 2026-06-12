import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ensureSession } from '../../services/authService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export interface QuotaMes {
  mes: number;
  ano: number;
  cota_mensal: number;
  cota_utilizada: number;
  cota_disponivel: number;
  cota_gerente_valor: number;
  cota_comprador_valor: number;
  despesas_comprometidas: number;
  pedidos_confirmados: number;
  qtd_pedidos: number;
}

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const STORE_CITIES: Record<string, string> = {
  "5":"Petrolina", "8":"Catu", "9":"P.Seguro", "26":"Cruz Almas",
  "31":"Euclides", "34":"Brumado", "40":"Jequié", "43":"Ipiaú",
  "44":"Livramento", "45":"Brumado", "50":"Euclides", "56":"T.Freitas",
  "72":"Eunápolis", "88":"Jequié", "96":"Itapetinga", "100":"L.Freitas",
  "102":"Itamaraju", "109":"C.Jacuípe"
};

const formatK = (v: number): string => {
  if (!v) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(0) + "K";
  return sign + abs.toFixed(0);
};

const formatBRL = (v: number): string => {
  const s = v < 0 ? "−R$ " : "R$ ";
  return s + Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 0, maximumFractionDigits: 0
  });
};

const toNumber = (v: any): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const formatarData = (dStr: string) => {
  if (!dStr) return '—';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
};

interface ResumoAnoFiscalProps {
  user: any;
  stores: any[];
  supabase: any; // cliente Supabase
}

export const ResumoAnoFiscal: React.FC<ResumoAnoFiscalProps> = ({ user, stores, supabase }) => {
  // States
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [painelData, setPainelData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalheModal, setDetalheModal] = useState<{store: string, ano: number, mes: number} | null>(null);
  const [detalheData, setDetalheData] = useState<any[]>([]);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [storeSemaphores, setStoreSemaphores] = useState<Record<string, string>>({});

  // Lojas ativas ordenadas
  const activeStores = useMemo(() =>
    (stores || [])
      .filter(s => s.status === 'active' || !s.status)
      .sort((a, b) => parseInt(a.number) - parseInt(b.number)),
    [stores]
  );

  const isAdmin = useMemo(() => {
    return user?.role === 'admin' || user?.role === 'super_admin';
  }, [user]);

  // Setar loja inicial ou da permissão do usuário
  useEffect(() => {
    if (isAdmin && activeStores.length > 0) {
      setSelectedStore(activeStores[0].number);
    } else if (user?.storeId) {
      const userStore = activeStores.find(s => s.id === user.storeId);
      if (userStore) {
        setSelectedStore(userStore.number);
      } else if (activeStores.length > 0) {
        setSelectedStore(activeStores[0].number);
      }
    } else if (activeStores.length > 0) {
      setSelectedStore(activeStores[0].number);
    }
  }, [activeStores, user, isAdmin]);

  // Carregar semáforos no primeiro carregamento
  useEffect(() => {
    async function loadSemaphores() {
      try {
        if (typeof ensureSession === 'function') {
          await ensureSession();
        }
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const { data } = await supabase.rpc('get_cotas_painel', {
          p_ano: currentYear,
          p_mes_inicio: currentMonth,
          p_mes_fim: currentMonth,
          p_store_number: null
        });
        if (data) {
          const semMap: Record<string, string> = {};
          data.forEach((item: any) => {
            semMap[item.store_number] = item.semaforo;
          });
          setStoreSemaphores(semMap);
        }
      } catch (err) {
        console.error('Erro ao carregar semáforos dos pills:', err);
      }
    }
    loadSemaphores();
  }, [supabase]);

  // Gerar lista de 12 meses rolling
  const rollingMonths = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const list = [];
    let m = currentMonth;
    let y = currentYear;
    for (let i = 0; i < 12; i++) {
      list.push({ mes: m, ano: y });
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return list;
  }, []);

  // Central de Cotas — header range
  const dateRangeLabel = useMemo(() => {
    if (rollingMonths.length === 0) return '';
    const start = rollingMonths[0];
    const end = rollingMonths[11];
    return `${MONTH_NAMES[start.mes - 1]}/${String(start.ano).slice(-2)} — ${MONTH_NAMES[end.mes - 1]}/${String(end.ano).slice(-2)}`;
  }, [rollingMonths]);

  // Carregar dados — mês atual rolando 12 meses à frente
  useEffect(() => {
    if (!selectedStore) return;
    
    async function load() {
      setLoading(true);
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      try {
        if (typeof ensureSession === 'function') {
          await ensureSession();
        }
        
        const promises = [
          supabase.rpc('get_cotas_painel', {
            p_ano: currentYear,
            p_mes_inicio: currentMonth,
            p_mes_fim: 12,
            p_store_number: selectedStore
          }),
        ];
        
        if (currentMonth > 1) {
          promises.push(
            supabase.rpc('get_cotas_painel', {
              p_ano: currentYear + 1,
              p_mes_inicio: 1,
              p_mes_fim: currentMonth - 1,
              p_store_number: selectedStore
            })
          );
        }
        
        const results = await Promise.all(promises);
        
        const err = results.find(r => r.error);
        if (err) throw err.error;
        
        const combined = results.flatMap(r => r.data || []);
        setPainelData(combined);
      } catch (err: any) {
        console.error('Erro ao buscar dados do painel:', err);
        toast.error('Erro ao carregar dados do painel: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    
    load();
  }, [selectedStore, supabase]);

  // Abrir modal de detalhe
  const openDetalhe = async (ano: number, mes: number) => {
    setDetalheModal({ store: selectedStore, ano, mes });
    setDetalheLoading(true);
    try {
      if (typeof ensureSession === 'function') {
        await ensureSession();
      }
      const { data } = await supabase.rpc('get_cotas_detalhe_loja', {
        p_store_number: selectedStore,
        p_ano: ano,
        p_mes: mes
      });
      setDetalheData(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar detalhes da loja:', err);
      toast.error('Erro ao carregar detalhes: ' + err.message);
    } finally {
      setDetalheLoading(false);
    }
  };

  const getSemaphoreColor = (sem: string) => {
    if (sem === 'verde') return 'bg-green-500';
    if (sem === 'amarelo') return 'bg-yellow-500';
    if (sem === 'vermelho') return 'bg-red-500';
    return 'bg-slate-300';
  };

  const getUsageStyling = (pct: number) => {
    if (pct >= 100) {
      return {
        border: 'border-[#ef4444] border-[1.5px]',
        progressBg: 'bg-[#ef4444]',
        badgeBg: 'bg-red-50 text-[#ef4444]',
        dot: '🔴',
      };
    } else if (pct >= 80) {
      return {
        border: 'border-[#f59e0b] border-[1.5px]',
        progressBg: 'bg-[#f59e0b]',
        badgeBg: 'bg-amber-50 text-[#f59e0b]',
        dot: '🟡',
      };
    } else {
      return {
        border: 'border-[#e2e8f0]',
        progressBg: 'bg-[#16a34a]',
        badgeBg: 'bg-green-50 text-[#16a34a]',
        dot: '🟢',
      };
    }
  };

  // Cálculos para os 3 cards do topo
  const storeObj = activeStores.find(s => s.number === selectedStore);
  const cityName = STORE_CITIES[selectedStore] || storeObj?.city || '—';

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentMonthData = painelData.find(d => d.mes === currentMonth && d.ano === currentYear);
  const currentCota = currentMonthData ? toNumber(currentMonthData.valor_cota) : 0;
  const currentMonthDisp = currentMonthData ? toNumber(currentMonthData.disponivel_projetado) : 0;
  const currentMonthName = MONTH_NAMES[currentMonth - 1];

  const totalComprometido = useMemo(() => {
    return painelData.reduce((sum, item) => sum + toNumber(item.utilizado_total), 0);
  }, [painelData]);

  const totalDisponivel = useMemo(() => {
    return painelData.reduce((sum, item) => sum + toNumber(item.disponivel_projetado), 0);
  }, [painelData]);

  const dispValueColorOverall = totalDisponivel > 0 ? 'text-[#16a34a]' : totalDisponivel < 0 ? 'text-[#dc2626]' : 'text-[#94a3b8]';

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Central de Cotas
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {dateRangeLabel}
          </p>
        </div>
      </div>

      {/* PILLS COMPACTAS (LOJAS) */}
      {isAdmin ? (
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 border border-slate-100 rounded-xl max-h-24 overflow-y-auto">
          {activeStores.map((store) => {
            const isSelected = store.number === selectedStore;
            const semState = storeSemaphores[store.number] || 'cinza';
            const dotColor = getSemaphoreColor(semState);
            return (
              <button
                key={store.id || store.number}
                onClick={() => setSelectedStore(store.number)}
                className={`relative px-3 py-1 text-[11px] font-black rounded-lg transition-all border ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
                style={{ padding: '4px 8px', borderRadius: '6px' }}
              >
                {store.number}
                <span 
                  className={`absolute top-0.5 right-0.5 w-1 h-1 rounded-full border border-white ${dotColor}`}
                />
              </button>
            );
          })}
        </div>
      ) : (
        selectedStore && (
          <div className="text-xs font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg inline-block">
            Loja {selectedStore} · {cityName}
          </div>
        )
      )}

      {/* CARDS RESUMO (3 CARDS NO TOPO) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Loja · Cidade */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] p-[12px] px-[14px] flex flex-col justify-between shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
            Loja {selectedStore}
          </div>
          <div className="text-[18px] md:text-[20px] font-mono font-bold text-[#1e293b] mt-1 truncate">
            {cityName}
          </div>
          <span className="text-[10px] text-[#94a3b8] mt-1 font-semibold">{formatBRL(currentCota)}/mês</span>
        </div>

        {/* Card 2: Comprometido Anual */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] p-[12px] px-[14px] flex flex-col justify-between shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
            Comprometido Anual
          </div>
          <div className="text-[18px] md:text-[20px] font-mono font-bold text-[#1e293b] mt-1">
            {formatBRL(totalComprometido)}
          </div>
          <span className="text-[10px] text-[#94a3b8] mt-1 font-semibold">Acumulado em 12 meses</span>
        </div>

        {/* Card 3: Disponível Atual */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] p-[12px] px-[14px] flex flex-col justify-between shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
            Disponível Atual ({currentMonthName})
          </div>
          <div className={`text-[18px] md:text-[20px] font-mono font-bold mt-1 ${currentMonthDisp > 0 ? 'text-[#16a34a]' : currentMonthDisp < 0 ? 'text-[#dc2626]' : 'text-[#94a3b8]'}`}>
            {formatBRL(currentMonthDisp)}
          </div>
          <span className="text-[10px] text-[#94a3b8] mt-1 font-semibold">Disponível projetado para compras</span>
        </div>
      </div>

      {/* GRID DE MESES - ROLLING 12 MESES */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando painel de cotas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {rollingMonths.map(({ mes, ano }) => {
            const monthData = painelData.find(item => item.mes === mes && item.ano === ano) || {
              mes,
              ano,
              valor_cota: 0,
              despesas_legacy: 0,
              pedidos_real: 0,
              pedidos_previsao: 0,
              utilizado_real: 0,
              utilizado_previsao: 0,
              utilizado_total: 0,
              disponivel_real: 0,
              disponivel_projetado: 0,
              pct_utilizado: 0,
              semaforo: 'cinza',
              qtd_pedidos: 0
            };

            const pct_utilizado = toNumber(monthData.pct_utilizado);
            const styling = getUsageStyling(pct_utilizado);
            const dispValue = toNumber(monthData.disponivel_projetado);
            let dispValueColor = 'text-[#94a3b8]';
            if (dispValue > 0) dispValueColor = 'text-[#16a34a]';
            else if (dispValue < 0) dispValueColor = 'text-[#dc2626]';

            return (
              <div 
                key={`${mes}-${ano}`}
                onClick={() => openDetalhe(ano, mes)}
                className={`border rounded-[10px] p-4 bg-white hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${styling.border}`}
              >
                {/* Topo */}
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>{MONTH_NAMES[mes - 1]}/{String(ano).slice(-2)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${styling.badgeBg}`}>
                    {Math.round(pct_utilizado)}% {styling.dot}
                  </span>
                </div>

                {/* Centro - Valor Disponível Destaque */}
                <div className="my-3.5 flex flex-col">
                  <span className="text-[9px] text-[#94a3b8] font-bold uppercase tracking-wide">Disponível</span>
                  <span className={`text-xl font-mono font-bold tracking-tight ${dispValueColor}`}>
                    {formatK(dispValue)}
                  </span>
                </div>

                {/* Barra de progresso: 3px, verde/amarelo/vermelho */}
                <div className="w-full bg-slate-100 rounded-full h-[3px] overflow-hidden mb-2">
                  <div 
                    className={`h-full ${styling.progressBg} transition-all duration-300`} 
                    style={{ width: `${Math.min(pct_utilizado, 100)}%` }}
                  />
                </div>

                {/* Rodapé: ocultar no mobile (< 600px -> hidden sm:flex) */}
                <div className="hidden sm:flex flex-col gap-0.5 text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Desp:</span>
                    <span className="font-mono text-slate-600 font-bold">{formatK(toNumber(monthData.despesas_legacy))}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Ped:</span>
                    <span className="font-mono text-slate-600 font-bold">{formatK(toNumber(monthData.pedidos_real))}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL "VER PEDIDOS DO MÊS" */}
      {detalheModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-[600px] w-full max-h-[80vh] overflow-hidden flex flex-col shadow-xl animate-in fade-in duration-150">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase">
                  Loja {detalheModal.store} — {MONTH_NAMES[detalheModal.mes - 1]}/{detalheModal.ano}
                </h3>
              </div>
              <button
                onClick={() => setDetalheModal(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {detalheLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-500 mb-2" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buscando detalhes...</p>
                </div>
              ) : detalheData.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Nenhum pedido neste mês</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                        <th className="px-3 py-2.5">Pedido</th>
                        <th className="px-3 py-2.5">Marca</th>
                        <th className="px-3 py-2.5">Fornecedor</th>
                        <th className="px-3 py-2.5 text-right">Parcela</th>
                        <th className="px-3 py-2.5 text-center">Vencimento</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {detalheData.map((ped, i) => {
                        let statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
                        if (ped.status === 'exportado') statusColor = 'bg-blue-50 text-blue-600';
                        if (ped.status === 'confirmado') statusColor = 'bg-green-50 text-green-600';
                        if (ped.status === 'stand_by') statusColor = 'bg-yellow-50 text-yellow-600';
                        
                        return (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 font-bold text-blue-600">#{ped.numero_pedido}</td>
                            <td className="px-3 py-2 font-bold text-slate-800 uppercase">{ped.marca || '—'}</td>
                            <td className="px-3 py-2 font-semibold text-[#64748b]">{ped.fornecedor || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{formatBRL(toNumber(ped.valor_parcela))}</td>
                            <td className="px-3 py-2 text-center font-semibold text-slate-500">{formatarData(ped.data_vencimento)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${statusColor}`}>
                                {ped.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 px-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">
                Total: <span className="font-mono text-xs font-bold text-slate-800">{formatBRL(detalheData.reduce((sum, p) => sum + toNumber(p.valor_parcela), 0))}</span>
              </span>
              <span className="font-bold text-[#64748b] uppercase tracking-wider">
                {detalheData.length} pedido{detalheData.length !== 1 ? 's' : ''}
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default ResumoAnoFiscal;
