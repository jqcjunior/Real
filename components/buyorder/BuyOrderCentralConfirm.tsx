import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, ClipboardCheck, Package, Clock } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

interface TokenOrder {
  id: string;
  order_id: string;
  numero_pedido: number;
  marca: string;
  fornecedor: string;
  confirmed_at: string | null;
}

interface TokenData {
  id: string;
  token: string;
  status: string;
  expires_at: string;
  total_orders: number;
  confirmed_orders: number;
}

interface Props {
  token: string;
}

export const BuyOrderCentralConfirm: React.FC<Props> = ({ token }) => {
  const [tokenData, setTokenData]   = useState<TokenData | null>(null);
  const [orders, setOrders]         = useState<TokenOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [confirming, setConfirming] = useState<Record<string, boolean>>({});
  const [error, setError]           = useState<string | null>(null);
  const [allDone, setAllDone]       = useState(false);

  const fmt = {
    date: (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  };

  useEffect(() => { loadToken(); }, []);

  const loadToken = async () => {
    setLoading(true);
    try {
      // Buscar token
      const { data: td, error: te } = await supabase
        .from('conferencia_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (te || !td) { setError('Link inválido ou expirado.'); return; }
      if (td.status === 'expired')   { setError('Este link expirou. Aguarde o próximo envio na sexta-feira.'); return; }
      if (td.status === 'completed') { setAllDone(true); setTokenData(td); return; }
      if (new Date(td.expires_at) < new Date()) { setError('Este link expirou. Aguarde o próximo envio na sexta-feira.'); return; }

      setTokenData(td);

      // Buscar pedidos do token
      const { data: ords, error: oe } = await supabase
        .from('conferencia_token_orders')
        .select('*')
        .eq('token_id', td.id)
        .order('numero_pedido', { ascending: false });

      if (oe) throw oe;
      setOrders(ords || []);

      // Verificar se já está tudo confirmado
      const allConfirmed = (ords || []).every(o => !!o.confirmed_at);
      if (allConfirmed && (ords || []).length > 0) {
        await completeToken(td.id);
        setAllDone(true);
      }
    } catch (err: any) {
      setError('Erro ao carregar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const completeToken = async (tokenId: string) => {
    await supabase
      .from('conferencia_tokens')
      .update({ status: 'completed' })
      .eq('id', tokenId);
  };

  const confirmOrder = async (order: TokenOrder) => {
    if (order.confirmed_at) return;
    setConfirming(prev => ({ ...prev, [order.id]: true }));
    try {
      // 1. Marcar como cadastrado em buy_orders
      const { error: e1 } = await supabase
        .from('buy_orders')
        .update({ central_status: 'cadastrado' })
        .eq('id', order.order_id);
      if (e1) throw e1;

      // 2. Registrar confirmação no token_order
      const { error: e2 } = await supabase
        .from('conferencia_token_orders')
        .update({ confirmed_at: new Date().toISOString(), confirmed_by: 'central' })
        .eq('id', order.id);
      if (e2) throw e2;

      // 3. Atualizar contador no token
      const newCount = orders.filter(o => !!o.confirmed_at).length + 1;
      await supabase
        .from('conferencia_tokens')
        .update({ confirmed_orders: newCount })
        .eq('id', tokenData!.id);

      // 4. Atualizar local
      const updatedOrders = orders.map(o =>
        o.id === order.id ? { ...o, confirmed_at: new Date().toISOString() } : o
      );
      setOrders(updatedOrders);
      setTokenData(prev => prev ? { ...prev, confirmed_orders: newCount } : prev);

      // 5. Verificar se todos confirmados → completar token
      const allConfirmed = updatedOrders.every(o => !!o.confirmed_at);
      if (allConfirmed) {
        await completeToken(tokenData!.id);
        setTimeout(() => setAllDone(true), 800);
      }
    } catch (err: any) {
      alert('Erro ao confirmar. Tente novamente.');
    } finally {
      setConfirming(prev => ({ ...prev, [order.id]: false }));
    }
  };

  const pending   = orders.filter(o => !o.confirmed_at);
  const confirmed = orders.filter(o =>  !!o.confirmed_at);
  const progress  = orders.length > 0 ? Math.round((confirmed.length / orders.length) * 100) : 0;

  // ── ESTADOS DE TELA ──────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
        <p className="text-sm font-semibold text-slate-500">Carregando...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-black text-slate-800 mb-2">Link Inválido</h2>
        <p className="text-sm text-slate-500">{error}</p>
        <div className="mt-6 p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-400">Real Calçados — Sistema Real Admin</p>
        </div>
      </div>
    </div>
  );

  if (allDone) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-black text-slate-800 mb-2">Tudo Confirmado!</h2>
        <p className="text-sm text-slate-500 mb-4">
          Todos os pedidos foram confirmados com sucesso. Este link foi encerrado.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-bold text-green-700">
            {tokenData?.total_orders} pedido(s) cadastrado(s) no sistema ✅
          </p>
        </div>
        <div className="mt-6 p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-400">Real Calçados — Sistema Real Admin</p>
        </div>
      </div>
    </div>
  );

  // ── TELA PRINCIPAL ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white px-4 py-6 text-center">
        <h1 className="text-xl font-black uppercase tracking-tight">REAL CALÇADOS</h1>
        <p className="text-xs text-blue-200 mt-1 uppercase tracking-widest">Conferência de Pedidos</p>
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Progresso</span>
            <span className="text-xs font-black text-slate-800">{confirmed.length} de {orders.length} confirmados</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-green-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-red-500 font-bold">{pending.length} pendente(s)</span>
            <span className="text-[10px] text-green-600 font-bold">{confirmed.length} confirmado(s)</span>
          </div>
          {tokenData && (
            <div className="flex items-center gap-1 mt-2">
              <Clock size={11} className="text-slate-400" />
              <span className="text-[10px] text-slate-400">
                Válido até {fmt.date(tokenData.expires_at)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="max-w-lg mx-auto p-4 space-y-3">

        {/* Pendentes */}
        {pending.length > 0 && (
          <>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-2">
              Aguardando confirmação ({pending.length})
            </p>
            {pending.map(order => (
              <div key={order.id} className="bg-white rounded-xl border-2 border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-[#1e3a5f]">#{order.numero_pedido}</span>
                      <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">PENDENTE</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 mt-0.5 truncate">{order.marca}</p>
                    <p className="text-[11px] text-slate-400 truncate">{order.fornecedor}</p>
                  </div>
                  <button
                    onClick={() => confirmOrder(order)}
                    disabled={confirming[order.id]}
                    className="flex items-center gap-1.5 px-4 py-3 bg-green-600 hover:bg-green-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-green-200 shrink-0"
                  >
                    {confirming[order.id]
                      ? <Loader2 size={14} className="animate-spin" />
                      : <CheckCircle2 size={14} />
                    }
                    {confirming[order.id] ? 'Salvando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Confirmados */}
        {confirmed.length > 0 && (
          <>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-4">
              Já confirmados ({confirmed.length})
            </p>
            {confirmed.map(order => (
              <div key={order.id} className="bg-white rounded-xl border border-green-200 p-4 opacity-70">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-500">#{order.numero_pedido}</span>
                      <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold">✅ CADASTRADO</span>
                    </div>
                    <p className="text-sm font-bold text-slate-500 truncate">{order.marca}</p>
                  </div>
                  <CheckCircle2 className="text-green-500 shrink-0" size={24} />
                </div>
              </div>
            ))}
          </>
        )}

        <div className="pt-4 pb-8 text-center">
          <p className="text-[10px] text-slate-400">Real Calçados — Sistema Real Admin</p>
          <p className="text-[10px] text-slate-300 mt-1">Pedidos não confirmados continuarão pendentes na próxima semana</p>
        </div>
      </div>
    </div>
  );
};

export default BuyOrderCentralConfirm;
