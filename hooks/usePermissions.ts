import { User } from '../types';

export const usePermissions = (currentUser: User | null | undefined) => {
  const roleUpper = (currentUser?.role || '').toUpperCase();
  const isAdmin = roleUpper === 'ADMIN';
  const isManager = roleUpper === 'MANAGER' || roleUpper === 'GERENTE';

  const checkManagerOwnership = (order: { user_id?: string; store_id?: string; buy_order_sub_orders?: any[] }) => {
    // Para ser dono, deve ter sido criado pelo usuário
    if (order.user_id !== currentUser?.id) return false;

    // Se tiver buy_order_sub_orders (do modulo de pedidos), podemos checar a loja lá também
    if (order.buy_order_sub_orders && currentUser?.storeId) {
      return true; 
    }

    // Se tiver store_id do Stand By
    if (order.store_id && currentUser?.storeId) {
        return String(order.store_id) === String(currentUser?.storeId);
    }
    
    // Se só tivermos user_id
    return true;
  };

  const canViewOrder = (order: any) => {
    if (isAdmin) return true;
    if (isManager) return checkManagerOwnership(order);
    return false;
  };

  const canEditOrder = (order: any) => {
    if (['confirmado', 'exportado', 'cancelado'].includes(order.status || '')) {
      return false;
    }

    if (isAdmin) return true;
    if (isManager) return checkManagerOwnership(order);
    return false;
  };

  const canConfirmOrder = (order: any) => {
    if (!['rascunho', 'stand_by', null, undefined, ''].includes(order.status || '')) {
      return false;
    }

    if (isAdmin) return true;
    if (isManager) return checkManagerOwnership(order);
    return false;
  };

  const canCancelOrder = (order: any) => {
    if (isAdmin) return true;

    // Se NÃO for ADMIN → só pode excluir rascunho e stand_by, e apenas os seus próprios pedidos
    const statusValido = ['rascunho', 'stand_by', null, undefined, ''].includes(order.status || '');
    if (!statusValido) return false;

    if (isManager) return checkManagerOwnership(order);
    return false;
  };

  const applyPermissionFilter = (query: any) => {
    if (isAdmin) {
      return query;
    }
    if (isManager && currentUser?.storeId && currentUser?.id) {
      return query
        .eq('store_id', currentUser.storeId)
        .eq('user_id', currentUser.id);
    }
    return query.eq('id', '00000000-0000-0000-0000-000000000000');
  };

  return {
    isAdmin,
    isManager,
    currentUser,
    canViewOrder,
    canEditOrder,
    canConfirmOrder,
    canCancelOrder,
    applyPermissionFilter
  };
};
