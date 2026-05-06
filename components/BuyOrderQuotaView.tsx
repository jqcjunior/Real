import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

interface CotaMes {
  mes: number;
  mes_nome: string;
  ano: number;
  cota_inicial: number;
  despesas_comprometidas: number;
  cota_limpa: number;
  pedidos_mes: number;
  disponivel_real: number;
}

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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [modoComprador, setModoComprador] = useState<'GERENTE' | 'COMPRADOR'>('COMPRADOR');
  const [cotasMeses, setCotasMeses] = useState<CotaMes[]>([]);
  const [resumoAnual, setResumoAnual] = useState<any[]>([]);
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
      carregarResumoAnual();
    }
  }, [selectedStore, selectedYear, modoComprador]);

  const carregarCotasMeses = async () => {
    if (!selectedStore) return;

    setLoading(true);
    try {
      // Primeiro, verificar quais meses estão cadastrados para esta loja
      const { data: mesesCadastrados, error: errorMeses } = await supabase
        .from('buyorder_parameters_store')
        .select('month')
        .eq('store_number', selectedStore)
        .eq('year', selectedYear)
        .order('month');

      if (errorMeses) throw errorMeses;

      if (!mesesCadastrados || mesesCadastrados.length === 0) {
        setCotasMeses([]);
        toast.warning(`Nenhum mês cadastrado para loja ${selectedStore} em ${selectedYear}`);
        return;
      }

      // Buscar cotas de cada mês cadastrado
      const cotasTemp: CotaMes[] = [];

      for (const mesObj of mesesCadastrados) {
        const mes = mesObj.month;

        const { data, error } = await supabase
          .rpc('get_cota_disponivel_mes', {
            p_store_number: selectedStore,
            p_year: selectedYear,
            p_month: mes,
            p_tipo_comprador: modoComprador.toLowerCase()
          });

        if (error) {
          console.error(`Erro ao buscar mês ${mes}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          const d = data[0];
          cotasTemp.push({
            mes: mes,
            mes_nome: monthNames[mes - 1],
            ano: selectedYear,
            cota_inicial: Number(d.cota_inicial || 0),
            despesas_comprometidas: Number(d.despesas_comprometidas || 0),
            cota_limpa: Number(d.cota_limpa || 0),
            pedidos_mes: Number(d.pedidos_mes || 0),
            disponivel_real: Number(d.disponivel_real || 0)
          });
        }
      }

      setCotasMeses(cotasTemp);
    } catch (err) {
      console.error('Erro ao carregar cotas:', err);
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
    await carregarResumoAnual();
    toast.success('Cotas sincronizadas!');
    setSyncing(false);
  };

  const carregarResumoAnual = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_capacidade_compra_anual', {
          p_store_number: selectedStore,
          p_year: selectedYear,
          p_tipo_comprador: modoComprador.toLowerCase(),
          p_qtd_parcelas: 3
        });

      if (error) throw error;
      setResumoAnual(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar resumo:', err);
    }
  };

  const buscarPedidosMes = async (mes: number, ano: number) => {
    try {
      const { data, error } = await supabase
        .rpc('get_pedidos_mes_detalhado', {
          p_store_number: selectedStore,
          p_year: ano,
          p_month: mes,
          p_tipo_comprador: modoComprador.toLowerCase()
        });

    if (error) {
      console.error('Erro RPC:', error);
      throw error;
    }

    setModalDetalhes({
      aberto: true,
      mes,
      ano,
      pedidos: data || []
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

            {/* Seletor de Ano */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
              <option value="2028">2028</option>
            </select>

            {/* Modo Comprador/Gerente */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
              <button
                onClick={() => setModoComprador('COMPRADOR')}
                className={`px-5 py-2 rounded-lg font-black text-xs uppercase transition-all ${
                  modoComprador === 'COMPRADOR'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                🛒 COMPRADOR
              </button>
              <button
                onClick={() => setModoComprador('GERENTE')}
                className={`px-5 py-2 rounded-lg font-black text-xs uppercase transition-all ${
                  modoComprador === 'GERENTE'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                👨💼 GERENTE
              </button>
            </div>

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
        <div className="flex flex-col xl:flex-row gap-4">
          
          {/* CARD RESUMO - Mesma altura que grid de cards */}
          <div className="w-full xl:w-80 xl:flex-shrink-0">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-5 border-2 border-blue-300 dark:border-blue-700 shadow-lg flex flex-col h-full">
              
              <h3 className="text-base font-black text-blue-900 dark:text-blue-300 uppercase mb-4 flex items-center gap-2">
                📊 RESUMO ANO FISCAL
              </h3>
              
              {/* Lista de meses - ocupa espaço disponível */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-1.5">
                  {resumoAnual.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/60 dark:hover:bg-slate-700/50 transition-all"
                    >
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300 w-24">
                        {item.mes_nome}/{selectedYear}
                      </span>
                      <span className={`text-sm font-black ${
                        parseFloat(item.disponivel) > 10000 ? 'text-green-600' :
                        parseFloat(item.disponivel) > 5000 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {formatarMoeda(parseFloat(item.disponivel))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capacidade de Compra - fixo no rodapé */}
              {resumoAnual.length > 0 && (
                <div className="mt-5 pt-4 border-t-2 border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase mb-1">
                    🎯 CAPACIDADE COMPRA
                  </p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mb-2">
                    (Próximos 3 meses)
                  </p>
                  <p className="text-3xl font-black text-blue-900 dark:text-blue-200">
                    {formatarMoeda(
                      parseFloat(
                        resumoAnual.find(r => r.mes === new Date().getMonth() + 1)?.capacidade_compra || 0
                      )
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* GRID 12 CARDS - 2 linhas x 6 colunas */}
          <div className="flex-1">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 content-start">
              {cotasMeses.map((cota, idx) => {
                const percentualDisp = calcularPercentualDisponivel(parseFloat(cota.disponivel_real.toString()), parseFloat(cota.cota_limpa.toString()));
                const isAlerta = percentualDisp < 30;
                const isAviso = percentualDisp >= 30 && percentualDisp < 60;

                return (
                  <div 
                    key={`${cota.ano}-${cota.mes}`}
                    className={`bg-white dark:bg-slate-800 rounded-xl p-3 border-2 shadow-sm transition-all hover:shadow-lg ${
                      isAlerta ? 'border-red-300 dark:border-red-700' :
                      isAviso ? 'border-yellow-300 dark:border-yellow-700' :
                      'border-green-300 dark:border-green-700'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase">
                          {cota.ano}
                        </p>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          {cota.mes_nome}
                        </h3>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-[9px] font-black ${
                        isAlerta ? 'bg-red-100 text-red-700' :
                        isAviso ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {percentualDisp}%
                      </div>
                    </div>

                    {/* Valores */}
                    <div className="space-y-1.5">
                      
                      {/* Cota Limpa */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-0.5">
                          Cota Limpa
                        </p>
                        <p className="text-xs font-black text-slate-900 dark:text-white">
                          {formatarMoeda(parseFloat(cota.cota_limpa.toString()))}
                        </p>
                      </div>

                      {/* Despesas */}
                      {parseFloat(cota.despesas_comprometidas.toString()) > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-1.5 border border-red-200 dark:border-red-700">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-red-600 dark:text-red-400 uppercase">
                              Desp
                            </span>
                            <span className="text-[10px] font-black text-red-600">
                              -{formatarMoeda(parseFloat(cota.despesas_comprometidas.toString()))}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Pedidos */}
                      {parseFloat(cota.pedidos_mes.toString()) > 0 && (
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-1.5 border border-orange-200 dark:border-orange-700">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-orange-600 dark:text-orange-400 uppercase">
                              Ped
                            </span>
                            <span className="text-[10px] font-black text-orange-600">
                              -{formatarMoeda(parseFloat(cota.pedidos_mes.toString()))}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Disponível */}
                      <div className="pt-1.5 mt-1.5 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[8px] font-black text-slate-500 uppercase">
                            Disp
                          </span>
                          {parseFloat(cota.disponivel_real.toString()) > 0 ? (
                            <TrendingUp size={11} className="text-green-500" />
                          ) : (
                            <TrendingDown size={11} className="text-red-500" />
                          )}
                        </div>
                        <p className={`text-base font-black ${
                          parseFloat(cota.disponivel_real.toString()) > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatarMoeda(parseFloat(cota.disponivel_real.toString()))}
                        </p>
                      </div>
                    </div>

                    {/* Botões compactos */}
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      <button
                        className="py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[9px] font-bold transition-all"
                        onClick={() => buscarPedidosMes(cota.mes, cota.ano)}
                        title="Ver Detalhes"
                      >
                        📋
                      </button>
                      <button
                        className="py-1 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-[9px] font-bold transition-all"
                        onClick={() => {
                          // ... handle simulação ...
                        }}
                        title="Simular Compra"
                      >
                        🧮
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

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