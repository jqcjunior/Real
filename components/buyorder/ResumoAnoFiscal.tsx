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

const getOrderType = (status: string): 'Confirmado' | 'Futuro' => {
  const s = String(status).toLowerCase();
  if (s === 'exportado' || s === 'confirmado') {
    return 'Confirmado';
  }
  return 'Futuro';
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

  // Gerar lista de 12 meses de referência rolando a partir do mês atual
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

  // Central de Cotas 90/120/150 — header range
  const dateRangeLabel = useMemo(() => {
    if (rollingMonths.length === 0) return '';
    const start = rollingMonths[0];
    const end = rollingMonths[11];
    return `${MONTH_NAMES[start.mes - 1]}/${String(start.ano).slice(-2)} — ${MONTH_NAMES[end.mes - 1]}/${String(end.ano).slice(-2)}`;
  }, [rollingMonths]);

  // Carregar dados — mês atual até 3 anos para garantir cobertura de target +3, +4, +5 meses
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
        
        // Buscamos dados do ano corrente, do ano seguinte e do ano sequente
        // para dar cobertura total a qualquer soma de +3, +4, +5 meses relativos aos 12 meses do rollingMonths
        const promises = [
          supabase.rpc('get_cotas_painel', {
            p_ano: currentYear,
            p_mes_inicio: currentMonth,
            p_mes_fim: 12,
            p_store_number: selectedStore
          }),
          supabase.rpc('get_cotas_painel', {
            p_ano: currentYear + 1,
            p_mes_inicio: 1,
            p_mes_fim: 12,
            p_store_number: selectedStore
          }),
          supabase.rpc('get_cotas_painel', {
            p_ano: currentYear + 2,
            p_mes_inicio: 1,
            p_mes_fim: 12,
            p_store_number: selectedStore
          })
        ];
        
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

  // Abrir modal de detalhe — calcula os 3 meses subsequentes e busca seus pedidos agrupando-os
  const openDetalhe = async (ano: number, mes: number) => {
    // Meses subsequentes (+3, +4, +5) relativos ao mês selecionado
    const targets = [];
    for (const offset of [3, 4, 5]) {
      let tMes = mes + offset;
      let tAno = ano;
      while (tMes > 12) {
        tMes -= 12;
        tAno += 1;
      }
      targets.push({ mes: tMes, ano: tAno });
    }

    setDetalheModal({ store: selectedStore, ano, mes });
    setDetalheLoading(true);
    
    try {
      if (typeof ensureSession === 'function') {
        await ensureSession();
      }
      
      const promises = targets.map(t => 
        supabase.rpc('get_cotas_detalhe_loja', {
          p_store_number: selectedStore,
          p_ano: t.ano,
          p_mes: t.mes
        })
      );
      
      const results = await Promise.all(promises);
      
      // Mesclar todos os resultados de volta e rotular o mês impactado
      const combined = results.flatMap((res, idx) => {
        const targetDate = targets[idx];
        const dataArray = res.data || [];
        return dataArray.map((item: any) => ({
          ...item,
          mes_impactado: `${MONTH_NAMES[targetDate.mes - 1]}/${String(targetDate.ano).slice(-2)}`,
          tipo: getOrderType(item.status)
        }));
      });
      
      setDetalheData(combined);
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

  // Processamento com a METODOLOGIA 90 / 120 / 150 dias
  const finalPainelData = useMemo(() => {
    return rollingMonths.map(({ mes, ano }) => {
      // Meses de referência compostos pelos vencimentos dos 3 meses subsequentes
      const targets = [];
      for (const offset of [3, 4, 5]) {
        let tMes = mes + offset;
        let tAno = ano;
        while (tMes > 12) {
          tMes -= 12;
          tAno += 1;
        }
        targets.push({ mes: tMes, ano: tAno });
      }

      // Consolidar valores das 3 datas alvo
      let sumCota = 0;
      let sumReal = 0;
      let sumPrevisao = 0;

      targets.forEach(t => {
        const match = painelData.find(item => item.mes === t.mes && item.ano === t.ano);
        if (match) {
          sumCota += toNumber(match.valor_cota);
          sumReal += toNumber(match.pedidos_real);
          sumPrevisao += toNumber(match.pedidos_previsao);
        }
      });

      const comprometido = sumReal + sumPrevisao;
      const saldo = sumCota - comprometido;
      const percentual = sumCota > 0 ? (comprometido / sumCota) * 100 : 0;

      // Texto representativo da composição (ex: OUT/26 + NOV/26 + DEZ/26)
      const composicao = targets
        .map(t => `${MONTH_NAMES[t.mes - 1]}/${String(t.ano).slice(-2)}`)
        .join(' + ');

      return {
        mes,
        ano,
        composicao,
        valor_cota: sumCota,
        pedidos_real: sumReal,
        pedidos_previsao: sumPrevisao,
        comprometido,
        saldo,
        percentual
      };
    });
  }, [rollingMonths, painelData]);

  // Totais consolidados para exibição nos cards superiores agregando os 12 meses sob nova regra
  const totalCota = useMemo(() => finalPainelData.reduce((sum, item) => sum + item.valor_cota, 0), [finalPainelData]);
  const totalReal = useMemo(() => finalPainelData.reduce((sum, item) => sum + item.pedidos_real, 0), [finalPainelData]);
  const totalPrevisao = useMemo(() => finalPainelData.reduce((sum, item) => sum + item.pedidos_previsao, 0), [finalPainelData]);
  const totalComprometido = useMemo(() => finalPainelData.reduce((sum, item) => sum + item.comprometido, 0), [finalPainelData]);
  const totalSaldo = useMemo(() => finalPainelData.reduce((sum, item) => sum + item.saldo, 0), [finalPainelData]);

  // Visualizadores das propriedades de cores de status
  const getStatusProps = (saldo: number, cota: number) => {
    if (saldo < 0) {
      return {
        text: 'Sem Saldo',
        badgeClass: 'bg-red-50 text-red-700 border border-red-200 font-extrabold text-[9px] uppercase px-2 py-0.5 rounded-lg tracking-widest',
        textClass: 'text-red-650'
      };
    }
    if (cota > 0 && saldo <= cota * 0.10) {
      return {
        text: 'Abaixo 10%',
        badgeClass: 'bg-yellow-50 text-yellow-700 border border-yellow-200 font-extrabold text-[9px] uppercase px-2 py-0.5 rounded-lg tracking-widest',
        textClass: 'text-amber-500'
      };
    }
    return {
      text: 'Disponível',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[9px] uppercase px-2 py-0.5 rounded-lg tracking-widest',
      textClass: 'text-emerald-700 font-bold'
    };
  };

  const storeObj = activeStores.find(s => s.number === selectedStore);
  const cityName = STORE_CITIES[selectedStore] || storeObj?.city || '—';

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Central de Cotas 90/120/150
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Metodologia de Vencimentos Futuros · {cityName}
          </p>
        </div>
      </div>

      {/* PILLS COMPACTAS (LOJAS COM SELETOR COMPATIVEL COM ADMINS E GERENTES) */}
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

      {/* SUBSTITUIÇÃO DOS 3 CARDS SUPERIORES POR 4 CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: COTA TOTAL */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] p-[12px] px-[14px] flex flex-col justify-between shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
            Cota Total
          </div>
          <div className="text-[18px] md:text-[20px] font-mono font-bold text-[#1e293b] mt-1.5 label-card-total">
            {formatBRL(totalCota)}
          </div>
          <span className="text-[10px] text-[#94a3b8] mt-1 font-semibold">Soma global de 12 meses</span>
        </div>

        {/* Card 2: PEDIDOS CONFIRMADOS */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] p-[12px] px-[14px] flex flex-col justify-between shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#059669]">
            Pedidos Confirmados
          </div>
          <div className="text-[18px] md:text-[20px] font-mono font-bold text-[#059669] mt-1.5 label-card-real">
            {formatBRL(totalReal)}
          </div>
          <span className="text-[10px] text-[#94a3b8] mt-1 font-semibold">Real (Exportados/Confirmados)</span>
        </div>

        {/* Card 3: PEDIDOS FUTUROS */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] p-[12px] px-[14px] flex flex-col justify-between shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-blue-500">
            Pedidos Futuros
          </div>
          <div className="text-[18px] md:text-[20px] font-mono font-bold text-blue-500 mt-1.5 label-card-previsao">
            {formatBRL(totalPrevisao)}
          </div>
          <span className="text-[10px] text-[#94a3b8] mt-1 font-semibold">Futuros (Rascunho/Stand-by)</span>
        </div>

        {/* Card 4: SALDO GERAL */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] p-[12px] px-[14px] flex flex-col justify-between shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#64748b]">
            Saldo Geral
          </div>
          <div className={`text-[18px] md:text-[20px] font-mono font-bold mt-1.5 label-card-saldo ${totalSaldo > 0 ? 'text-[#059669]' : totalSaldo < 0 ? 'text-red-600' : 'text-slate-500'}`}>
            {formatBRL(totalSaldo)}
          </div>
          <span className="text-[10px] text-[#94a3b8] mt-1 font-semibold">Orçamento geral livre</span>
        </div>
      </div>

      {/* TABELA PRINCIPAL DO PLANO DE CONTROLE FINANCEIRO */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Calculando planejamento de cotas...</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 text-center">Mês Referência</th>
                  <th className="px-5 py-3 text-center">Meses que compõem a cota</th>
                  <th className="px-5 py-3 text-right">Valor da Cota</th>
                  <th className="px-5 py-3 text-right">Pedidos Confirmados</th>
                  <th className="px-5 py-3 text-right">Pedidos Futuros</th>
                  <th className="px-5 py-3 text-right">Comprometido</th>
                  <th className="px-5 py-3 text-right">Saldo Disponível</th>
                  <th className="px-5 py-3 text-right">% Utilizado</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {finalPainelData.map((item) => {
                  const hasNegativeSaldo = item.saldo < 0;
                  const statusProps = getStatusProps(item.saldo, item.valor_cota);

                  // Linha em tom de vermelho macio quando o saldo < 0 para destaque imediato
                  const rowBgClass = hasNegativeSaldo
                    ? 'bg-red-50/70 hover:bg-red-100 text-red-950 transition-colors'
                    : 'hover:bg-slate-50/50 transition-colors';

                  return (
                    <tr
                      key={`${item.mes}-${item.ano}`}
                      onClick={() => openDetalhe(item.ano, item.mes)}
                      className={`cursor-pointer ${rowBgClass}`}
                    >
                      <td className="px-5 py-4 text-center font-black tracking-tight text-slate-800">
                        {MONTH_NAMES[item.mes - 1]}/{String(item.ano).slice(-2)}
                      </td>
                      <td className="px-5 py-4 text-center text-slate-400 font-bold tracking-tight text-[11px]">
                        {item.composicao}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-medium text-slate-900">
                        {formatBRL(item.valor_cota)}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-emerald-700 font-semibold">
                        {formatBRL(item.pedidos_real)}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-blue-600 font-semibold">
                        {formatBRL(item.pedidos_previsao)}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-slate-850">
                        {formatBRL(item.comprometido)}
                      </td>
                      <td className={`px-5 py-4 text-right font-mono font-black ${statusProps.textClass}`}>
                        {formatBRL(item.saldo)}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-extrabold text-slate-900">
                        {item.valor_cota > 0 ? `${Math.round(item.percentual)}%` : '0%'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={statusProps.badgeClass}>
                          {statusProps.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* LINHA DE RESUMO GERAL AO FINAL DA PLANILHA */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-[#e2e8f0] text-xs font-black text-slate-800">
                  <td className="px-5 py-4 text-center uppercase tracking-wider font-extrabold" colSpan={2}>Total</td>
                  <td className="px-5 py-4 text-right font-mono font-extrabold">{formatBRL(totalCota)}</td>
                  <td className="px-5 py-4 text-right font-mono font-extrabold text-emerald-700">{formatBRL(totalReal)}</td>
                  <td className="px-5 py-4 text-right font-mono font-extrabold text-blue-650">{formatBRL(totalPrevisao)}</td>
                  <td className="px-5 py-4 text-right font-mono font-extrabold text-slate-900">{formatBRL(totalComprometido)}</td>
                  <td className={`px-5 py-4 text-right font-mono font-extrabold ${totalSaldo < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatBRL(totalSaldo)}</td>
                  <td className="px-5 py-4 text-right font-mono font-extrabold text-slate-900">
                    {totalCota > 0 ? `${Math.round((totalComprometido / totalCota) * 100)}%` : '0%'}
                  </td>
                  <td className="px-5 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DE COMPROMETIMENTO DA COTA MENSAL */}
      {detalheModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-[800px] w-full max-h-[80vh] overflow-hidden flex flex-col shadow-xl animate-in fade-in duration-150">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                  Loja {detalheModal.store} · Detalhes de Cota {MONTH_NAMES[detalheModal.mes - 1]}/{detalheModal.ano}
                </h3>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-0.5 tracking-wider">
                  Pedidos que vencem nos 3 meses subsequentes da cota (+90 / +120 / +150 dias)
                </p>
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
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calculando vencimentos impactados...</p>
                </div>
              ) : detalheData.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Nenhum vencimento subsequente comprometendo esta cota</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                        <th className="px-3 py-2.5">Pedido</th>
                        <th className="px-3 py-2.5">Marca</th>
                        <th className="px-3 py-2.5">Fornecedor</th>
                        <th className="px-3 py-2.5 text-right">Valor Parcela</th>
                        <th className="px-3 py-2.5 text-center">Status do Pedido</th>
                        <th className="px-3 py-2.5 text-center">Tipo de Cota</th>
                        <th className="px-3 py-2.5 text-center">Mês Impactado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {detalheData.map((ped, i) => {
                        let statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
                        if (ped.status === 'exportado') statusColor = 'bg-blue-50 text-blue-600';
                        if (ped.status === 'confirmado') statusColor = 'bg-green-50 text-emerald-600';
                        if (ped.status === 'stand_by') statusColor = 'bg-yellow-50 text-yellow-600';

                        const isConfirmado = ped.tipo === 'Confirmado';
                        const typeBadgeClass = isConfirmado
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200';
                        
                        return (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 font-bold text-blue-600">#{ped.numero_pedido}</td>
                            <td className="px-3 py-2 font-bold text-slate-800 uppercase">{ped.marca || '—'}</td>
                            <td className="px-3 py-2 font-semibold text-[#64748b]">{ped.fornecedor || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{formatBRL(toNumber(ped.valor_parcela))}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${statusColor}`}>
                                {ped.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${typeBadgeClass}`}>
                                {ped.tipo}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-slate-650 font-mono">
                              {ped.mes_impactado}
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
                Total Subsequente Comprometido: <span className="font-mono text-xs font-black text-slate-800">{formatBRL(detalheData.reduce((sum, p) => sum + toNumber(p.valor_parcela), 0))}</span>
              </span>
              <span className="font-bold text-[#64748b] uppercase tracking-wider">
                {detalheData.length} parcelas registradas
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default ResumoAnoFiscal;
