import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Loader2, RefreshCw, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../types';
import ResumoAnoFiscal, { QuotaMes, gerarMesesRolling } from './ResumoAnoFiscal.tsx';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

interface Loja {
  number: string;
  name: string;
  city: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function BuyOrderQuotaView({ user }: { user: User }) {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  
  // Rolling 12 months data
  const [cotasMeses, setCotasMeses] = useState<QuotaMes[]>([]);
  const [modalDetalhes, setModalDetalhes] = useState<{
    aberto: boolean;
    mes: number;
    ano: number;
    pedidos: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const monthNames = [
    'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
    'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // CARREGAR LOJAS COM CONTROLE DE PERMISSÕES
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    carregarLojas();
  }, []);

  const carregarLojas = async () => {
    try {
      // 1. Buscar permissões do usuário para esta página
      const { data: permissions, error: permError } = await supabase
        .from('user_store_permissions')
        .select('can_view_all_stores, allowed_store_ids')
        .eq('user_id', user.id)
        .eq('page_id', 'cotas_compra')
        .single();

      if (permError) {
        console.error('Erro ao buscar permissões:', permError);
        toast.error('Erro ao verificar permissões de acesso');
        return;
      }

      let lojasData = [];

      // 2. Carregar lojas baseado nas permissões
      if (permissions?.can_view_all_stores) {
        // ADMIN/COMPRADOR: Todas as lojas
        const { data, error } = await supabase
          .from('stores')
          .select('number, name, city')
          .eq('status', 'active');

        if (error) throw error;
        lojasData = data || [];

      } else if (permissions?.allowed_store_ids && permissions.allowed_store_ids.length > 0) {
        // GERENTE: Apenas lojas permitidas
        const { data, error } = await supabase
          .from('stores')
          .select('number, name, city')
          .in('id', permissions.allowed_store_ids)
          .eq('status', 'active');

        if (error) throw error;
        lojasData = data || [];

      } else {
        // SEM PERMISSÃO
        toast.error('Você não tem permissão para acessar este módulo');
        setLojas([]);
        return;
      }

      // 3. Ordenar lojas numericamente
      const lojasOrdenadas = lojasData.sort((a, b) => {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
      });

      setLojas(lojasOrdenadas);
      
      // 4. Selecionar primeira loja disponível
      if (lojasOrdenadas.length > 0) {
        setSelectedStore(lojasOrdenadas[0].number);
      }

    } catch (err) {
      console.error('Erro ao carregar lojas:', err);
      toast.error('Erro ao carregar lojas');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CARREGAR COTAS DOS MESES
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (selectedStore) {
      carregarCotasMeses();
    }
  }, [selectedStore]);

  const carregarCotasMeses = async () => {
    if (!selectedStore) return;

    setLoading(true);
    try {
      const dataBase = new Date();
      const ptMonth = dataBase.getMonth() + 1;
      const ptYear = dataBase.getFullYear();
      
      console.log('DEBUG RPC PARAMS', {
        selectedStore,
        ptMonth,
        ptYear,
        types: {
          selectedStore: typeof selectedStore,
          ptMonth: typeof ptMonth,
          ptYear: typeof ptYear
        }
      });

      if (!selectedStore || !ptMonth || !ptYear) {
        console.error('Parâmetros inválidos RPC', {
          selectedStore,
          ptMonth,
          ptYear
        });
        setLoading(false);
        return;
      }
      
      // Buscar dados da VIEW correta
      const { data, error } = await supabase
        .from('v_cotas_mes_correto')
        .select('*')
        .eq('store_number', selectedStore)
        .eq('year', ptYear)
        .gte('month', ptMonth)
        .order('year', { ascending: true })
        .order('month', { ascending: true })
        .limit(12);

      if (error) {
        console.error('VIEW ERROR:', error);
        throw error;
      }

      if (data) {
        setCotasMeses(data.map((d: any) => {
          const toNumber = (v: any) => {
            if (v === null || v === undefined || v === '') return 0;
            const n = typeof v === 'string' ? parseFloat(v) : v;
            return isNaN(n) ? 0 : n;
          };

          const cotaMaioLivre = toNumber(d.cota_maio_livre);
          const cotaComprador = toNumber(d.cota_comprador);
          const cotaGerente = toNumber(d.cota_gerente);

          return {
            mes: d.month,
            ano: d.year,
            
            // TOPO DO CARD - PARÂMETROS BASE
            cota_mensal: toNumber(d.cota_bruta),
            despesas_comprometidas: toNumber(d.despesas_comprometidas),
            cota_do_mes: toNumber(d.cota_limpa_parametro),  // ✅ CORRETO! (14.957)
            
            // CARD COTA FUTURO - OTB
            cota_futuro_total: cotaMaioLivre,  // ✅ Este é o OTB (35.226)
            cota_comprador_valor: cotaComprador,
            cota_gerente_valor: cotaGerente,
            
            // PORCENTAGENS
            percentual_comprador: cotaMaioLivre > 0 ? (cotaComprador / cotaMaioLivre * 100) : 0,
            percentual_gerente: cotaMaioLivre > 0 ? (cotaGerente / cotaMaioLivre * 100) : 0,
            
            // Saldo Reserva (com pedidos descontados)
            saldo_reserva_gerente: toNumber(d.saldo_reserva_gerente),
            saldo_reserva_comprador: toNumber(d.saldo_reserva_comprador),
            
            // OTB (já calculado)
            otb_maximo_compravel_comprador: toNumber(d.cota_comprador),
            otb_maximo_compravel_gerente: toNumber(d.cota_gerente),
            
            // Pedidos do mês
            pedidos_futuros_comprador: toNumber(d.pedidos_comprador_mes),
            pedidos_futuros_gerente: toNumber(d.pedidos_gerente_mes),
            qtd_pedidos_comprador: toNumber(d.pedidos_comprador_mes) > 0 ? 1 : 0,
            qtd_pedidos_gerente: toNumber(d.pedidos_gerente_mes) > 0 ? 1 : 0,
            
            // Legados (manter compatibilidade)
            cota_disponivel: cotaMaioLivre,
            cota_limpa_parametro: toNumber(d.cota_limpa_parametro),
            cota_utilizada: toNumber(d.pedidos_gerente_mes) + toNumber(d.pedidos_comprador_mes),
            pedidos_confirmados: toNumber(d.pedidos_gerente_mes) + toNumber(d.pedidos_comprador_mes),
            qtd_pedidos: (toNumber(d.pedidos_gerente_mes) > 0 ? 1 : 0) + (toNumber(d.pedidos_comprador_mes) > 0 ? 1 : 0)
          };
        }));
      }
    } catch (err: any) {
      console.error('Erro ao carregar cotas:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        full: err
      });
      toast.error('Erro ao carregar cotas dos meses');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SINCRONIZAR (RECARREGAR)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSincronizar = async () => {
    setSyncing(true);
    await carregarCotasMeses();
    toast.success('Cotas sincronizadas!');
    setSyncing(false);
  };

  const buscarPedidosMes = async (mes: number, ano: number) => {
    try {
      // Find orders for BOTH gerente and comprador
      const { data: dataComp, error: errComp } = await supabase
        .rpc('get_pedidos_mes_detalhado', {
          p_store_number: selectedStore,
          p_year: ano,
          p_month: mes,
          p_tipo_comprador: 'comprador'
        });

      const { data: dataGer, error: errGer } = await supabase
        .rpc('get_pedidos_mes_detalhado', {
          p_store_number: selectedStore,
          p_year: ano,
          p_month: mes,
          p_tipo_comprador: 'gerente'
        });

      if (errComp || errGer) {
        console.error('Erro RPC:', errComp || errGer);
        throw errComp || errGer;
      }

      const allPedidos = [...(dataComp || []), ...(dataGer || [])];

      setModalDetalhes({
        aberto: true,
        mes,
        ano,
        pedidos: allPedidos
      });
    } catch (err: any) {
      console.error('Erro ao buscar pedidos:', err);
      toast.error('Erro: ' + (err.message || 'Desconhecido'));
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITÁRIOS
  // ═══════════════════════════════════════════════════════════════════════════

  const formatarMoeda = (valor: number) => 
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const calcularPercentualDisponivel = (disponivel: number, cotaLimpa: number) => {
    if (cotaLimpa === 0) return 100;
    const percentual = (disponivel / cotaLimpa) * 100;
    return Math.max(0, Math.min(100, Math.round(percentual)));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const lojaSelecionada = lojas.find(l => l.number === selectedStore);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      
      {/* ═════════════════ HEADER ═════════════════ */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Título */}
          <div>
            <h1 className="text-2xl font-black uppercase text-slate-900 dark:text-white">
              🏪 COTA DE COMPRA
            </h1>
            {lojaSelecionada && (
              <p className="text-sm font-bold text-slate-500 mt-1">
                LOJA {lojaSelecionada.number} - {lojaSelecionada.name} • {lojaSelecionada.city}
              </p>
            )}
          </div>

          {/* Controles */}
          <div className="flex flex-wrap gap-3">
            
            {/* Seletor de Loja */}
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Selecione a loja</option>
              {lojas.map(loja => (
                <option key={loja.number} value={loja.number}>
                  Loja {loja.number} - {loja.name}
                </option>
              ))}
            </select>

            {/* Botão Sincronizar */}
            <button
              onClick={handleSincronizar}
              disabled={syncing}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm uppercase transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              SINCRONIZAR
            </button>
          </div>
        </div>
      </div>

      {/* ═════════════════ LOADING ═════════════════ */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={48} className="animate-spin text-blue-500" />
          <p className="text-sm font-bold text-slate-500 uppercase">
            Carregando cotas...
          </p>
        </div>
      ) : cotasMeses.length === 0 ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-8 text-center border-2 border-yellow-200 dark:border-yellow-800">
          <AlertCircle size={48} className="mx-auto mb-4 text-yellow-600" />
          <h3 className="text-lg font-black text-yellow-900 dark:text-yellow-200 uppercase mb-2">
            Nenhum mês cadastrado
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Configure os parâmetros desta loja no módulo de Administração de Parâmetros
          </p>
        </div>
      ) : (
        <ResumoAnoFiscal 
          quotas={cotasMeses} 
          storeNumber={selectedStore} 
          onVerPedidos={buscarPedidosMes} 
        />
      )}

      {modalDetalhes?.aberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">
                    📋 PEDIDOS - {monthNames[modalDetalhes.mes - 1]}/{modalDetalhes.ano}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Vencimentos neste mês • Loja {selectedStore}
                  </p>
                </div>
                <button
                  onClick={() => setModalDetalhes(null)}
                  className="p-2 hover:bg-white/50 dark:hover:bg-slate-700 rounded-lg transition-all"
                >
                  <X size={24} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {!modalDetalhes.pedidos || modalDetalhes.pedidos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} className="text-slate-400" />
                  </div>
                  <p className="text-lg font-bold text-slate-500 dark:text-slate-400">
                    Nenhum pedido com vencimento neste mês
                  </p>
                  <p className="text-sm text-slate-400 mt-2">
                    Os pedidos aparecem apenas nos meses onde há vencimentos
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {modalDetalhes.pedidos.map((pedido, idx) => (
                    <div
                      key={idx}
                      className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-5 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all"
                    >
                      {/* Header do Pedido */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-black">
                              #{pedido.numero_pedido}
                            </span>
                            <span className="text-lg font-black text-slate-900 dark:text-white">
                              {pedido.marca}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            👤 {pedido.comprador}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Valor Total
                          </p>
                          <p className="text-lg font-black text-slate-900 dark:text-white">
                            {formatarMoeda(pedido.valor_total)}
                          </p>
                        </div>
                      </div>

                      {/* Divisor */}
                      <div className="border-t-2 border-dashed border-slate-300 dark:border-slate-600 my-3"></div>

                      {/* Footer do Pedido */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                            💰 Abate neste mês:
                          </span>
                          <span className="text-xl font-black text-orange-600">
                            {formatarMoeda(pedido.valor_mes)}
                          </span>
                        </div>
                        
                        <div>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                            📅 VENCIMENTOS:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(pedido.vencimentos || []).map((venc: string, i: number) => {
                              const date = new Date(venc);
                              const isEsteMes = 
                                date.getMonth() + 1 === modalDetalhes.mes && 
                                date.getFullYear() === modalDetalhes.ano;
                              
                              return (
                                <span
                                  key={i}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                    isEsteMes
                                      ? 'bg-orange-500 text-white shadow-md'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {new Date(venc).toLocaleDateString('pt-BR')}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {modalDetalhes.pedidos && modalDetalhes.pedidos.length > 0 && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Total de Pedidos
                    </p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                      {modalDetalhes.pedidos.length}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Total Abatido no Mês
                    </p>
                    <p className="text-2xl font-black text-orange-600">
                      {formatarMoeda(
                        modalDetalhes.pedidos.reduce((sum, p) => sum + Number(p.valor_mes || 0), 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}