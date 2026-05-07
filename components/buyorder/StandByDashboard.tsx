import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { toast } from 'sonner';
import { Clock, AlertTriangle, CheckCircle, XCircle, Search, Edit2 } from 'lucide-react';
import { StandByModal } from './StandByModal';
import { QuotaInsufficientModal } from '../QuotaInsufficientModal';
import { usePermissions } from '../../hooks/usePermissions';

interface StandByOrder {
  id: string;
  numero_pedido: string | null;
  marca: string;
  fornecedor: string;
  representante: string;
  store_id?: string;
  store_number?: string;
  user_id?: string;
  motivo: string;
  data_stand_by: string;
  resposta_esperada: string | null;
  dias_em_standby: number;
  atrasado: boolean;
  colocado_em_standby_por: string;
  created_at: string;
  total_valor_liquido?: number;
}

export default function StandByDashboard({ 
  user,
  onEditOrder
}: { 
  user: any;
  onEditOrder: (orderId: string) => void;
}) {
  const [orders, setOrders] = useState<StandByOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Permissions
  const { isAdmin, isManager, canEditOrder, canConfirmOrder, canCancelOrder, applyPermissionFilter } = usePermissions(user);

  // Modals state
  const [showStandByModal, setShowStandByModal] = useState<string | null>(null);
  const [quotaModalData, setQuotaModalData] = useState<any | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);
  const [cancelingOrder, setCancelingOrder] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('v_orders_stand_by')
        .select('*');

      query = applyPermissionFilter(query);
      query = query.order('data_stand_by', { ascending: false });

      if (searchTerm) {
        query = query.or(`marca.ilike.%${searchTerm}%,fornecedor.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar pedidos em Stand By:', error);
      toast.error('Erro ao carregar pedidos em Stand By');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [searchTerm, user]);

  const handleConfirmOrder = async (order: StandByOrder) => {
    if (!canConfirmOrder({ ...order, status: 'stand_by' })) {
      toast.error('Você não tem permissão para confirmar este pedido.');
      return;
    }

    if (!window.confirm('Ao confirmar, este pedido consumirá a cota disponível e não poderá mais ser editado. Deseja continuar?')) {
      return;
    }

    setConfirmingOrder(order.id);

    try {
      const { data, error } = await supabase.rpc('confirm_order_from_stand_by', {
        p_order_id: order.id,
        p_user_id: user?.id
      });

      if (error) throw error;

      if (!data.success) {
        if (data.error === 'Cota insuficiente') {
          setQuotaModalData({
            available: data.cota_disponivel,
            required: data.valor_pedido,
            deficit: data.deficit,
            buyerType: data.tipo_comprador
          });
          return;
        }

        toast.error(data.error || 'Erro ao confirmar pedido');
        return;
      }

      toast.success(`Pedido confirmado! Cota consumida: R$ ${data.quota_details?.valor_consumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      fetchOrders();

    } catch (err: any) {
      console.error('Erro ao confirmar pedido:', err);
      toast.error(err.message || 'Erro ao confirmar pedido');
    } finally {
      setConfirmingOrder(null);
    }
  };

  const handleCancelOrder = async (order: StandByOrder) => {
    if (!canCancelOrder({ ...order })) {
      toast.error('Você não tem permissão para cancelar este pedido.');
      return;
    }

    if (!window.confirm('Tem certeza que deseja CANCELAR este pedido? Ele será marcado como cancelado.')) {
      return;
    }

    setCancelingOrder(order.id);

    try {
      const { data, error } = await supabase.rpc('return_quota_on_cancel', {
        p_order_id: order.id,
        p_user_id: user?.id
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.message || 'Erro ao cancelar pedido');
        return;
      }

      await supabase.rpc('release_quota_extra_on_cancel', { p_order_id: order.id });

      toast.success(data.message || 'Pedido cancelado.');
      fetchOrders();

    } catch (err: any) {
      console.error('Erro ao cancelar pedido:', err);
      toast.error(err.message || 'Erro ao cancelar pedido');
    } finally {
      setCancelingOrder(null);
    }
  };

  // Render order card
  const renderOrderCard = (order: StandByOrder, showStoreInfo: boolean = false) => {
    const canEdit = canEditOrder({ ...order, status: 'stand_by' });
    const canConfirm = canConfirmOrder({ ...order, status: 'stand_by' });
    const canCancel = canCancelOrder({ ...order });

    return (
      <div 
        key={order.id} 
        className={`bg-white rounded-xl shadow-sm border transition-all hover:shadow-md overflow-hidden flex flex-col ${
          order.atrasado ? 'border-red-300' : 'border-slate-200'
        }`}
      >
        <div className={`px-5 py-3 border-b flex justify-between items-center ${
          order.atrasado ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <span className="font-black text-slate-800 uppercase print:text-[10px]">
              {order.marca}
            </span>
            {order.numero_pedido && (
               <span className="text-xs font-medium text-slate-500 hidden sm:inline-block">
                 #{order.numero_pedido}
               </span>
            )}
            {showStoreInfo && isAdmin && order.store_number && (
               <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-sm ml-2">
                 Loja {order.store_number}
               </span>
            )}
          </div>
          
          {order.atrasado ? (
            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
              <AlertTriangle size={12} />
              Atrasado
            </span>
          ) : (
            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
              {order.dias_em_standby} {order.dias_em_standby === 1 ? 'dia' : 'dias'}
            </span>
          )}
        </div>

        <div className="p-5 flex-1 flex flex-col">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Fornecedor</p>
              <p className="text-xs font-medium text-slate-700 truncate">{order.fornecedor}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Criado em</p>
              <p className="text-xs font-medium text-slate-700">
                {new Date(order.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 mb-4 flex-1">
            <p className="text-[10px] font-bold text-amber-800 uppercase mb-1 flex items-center gap-1">
              <Clock size={12} /> Motivo do Stand By
            </p>
            <p className="text-xs text-amber-900 leading-relaxed italic">
              "{order.motivo}"
            </p>
            
            <div className="mt-3 flex items-center justify-between pt-3 border-t border-amber-200/50">
               {order.resposta_esperada ? (
                 <div className="flex items-center gap-1.5">
                   <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                   <span className="text-[10px] font-medium text-amber-800">
                     Esperado para: <strong className={order.atrasado ? 'text-red-600' : ''}>{new Date(order.resposta_esperada).toLocaleDateString('pt-BR')}</strong>
                   </span>
                 </div>
               ) : (
                 <span className="text-[10px] font-medium text-amber-600 opacity-70">Sem data definida</span>
               )}
               
               <span className="text-[9px] text-amber-700/70 font-medium">
                 Por: {order.colocado_em_standby_por}
               </span>
            </div>
          </div>

          <div className="flex gap-2 mt-auto pt-2">
            {canEdit && (
              <button
                onClick={() => onEditOrder(order.id)}
                className="flex-1 flex justify-center items-center gap-1.5 py-2 px-3 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-xs font-bold"
              >
                <Edit2 size={14} /> Editar
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => handleCancelOrder(order)}
                disabled={cancelingOrder === order.id}
                className="flex justify-center items-center gap-1 py-2 px-3 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-xs font-bold disabled:opacity-50"
                title="Cancelar Pedido"
              >
                {cancelingOrder === order.id ? (
                  <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <XCircle size={14} /> 
                )}
              </button>
            )}
            {canConfirm && (
              <button
                onClick={() => handleConfirmOrder(order)}
                disabled={confirmingOrder === order.id}
                className="flex-[2] flex justify-center items-center gap-1.5 py-2 px-3 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors text-xs font-bold shadow-sm disabled:opacity-50"
              >
                {confirmingOrder === order.id ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle size={14} /> 
                )}
                Confirmar
              </button>
            )}
            {!canEdit && !canConfirm && !canCancel && (
               <button className="flex-1 py-2 px-3 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold cursor-not-allowed border border-slate-200">
                 🔒 Sem permissão
               </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Group orders by store if Admin
  const ordersByStore = isAdmin 
    ? orders.reduce((acc, order) => {
        const storeId = order.store_number || 'Desconhecida';
        if (!acc[storeId]) acc[storeId] = [];
        acc[storeId].push(order);
        return acc;
      }, {} as Record<string, StandByOrder[]>)
    : null;

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 border-l border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
              <Clock size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tight text-slate-900">
                Pedidos em Stand By
              </h1>
              {isAdmin && (
                <p className="text-sm font-semibold text-amber-600 flex items-center gap-1">
                  <span>👑 Visão Consolidada Administrativa</span>
                </p>
              )}
              {isManager && (
                <p className="text-sm font-semibold text-blue-600 flex items-center gap-1">
                  <span>👤 Loja {user?.storeId} - Seus pedidos aguardando confirmação</span>
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar marca ou fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border-none focus:ring-0 text-sm w-full md:w-64 bg-transparent outline-none"
              />
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="px-4 py-2 bg-amber-50 text-amber-700 text-sm font-bold rounded-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {orders.length}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
             <div className="bg-slate-50 p-4 rounded-full mb-4">
                <Clock size={40} className="text-slate-300" />
             </div>
             <h3 className="text-lg font-bold text-slate-700 mb-1">
               {isAdmin ? "Nenhum pedido em Stand By no momento" : "Você não tem pedidos em Stand By"}
             </h3>
             <p className="text-slate-500 text-sm max-w-sm">
                Os pedidos salvos em Stand By aparecerão aqui e não consomem cota até serem confirmados.
             </p>
          </div>
        ) : (
          isAdmin && ordersByStore ? (
            <div className="space-y-8">
              {Object.entries(ordersByStore).map(([storeId, storeOrders]) => (
                <div key={storeId} className="bg-white border text-left border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 m-0">🏪 Loja {storeId}</h3>
                    <span className="bg-blue-500 text-white px-3 py-1 text-xs font-bold rounded-full">{storeOrders.length} pedidos</span>
                  </div>
                  <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-slate-50">
                    {storeOrders.map(order => renderOrderCard(order, false))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {orders.map((order) => renderOrderCard(order, true))}
            </div>
          )
        )}
      </div>

      {quotaModalData && (
        <QuotaInsufficientModal
          available={quotaModalData.available}
          required={quotaModalData.required}
          deficit={quotaModalData.deficit}
          buyerType={quotaModalData.buyerType}
          onClose={() => setQuotaModalData(null)}
        />
      )}
    </div>
  );
}
