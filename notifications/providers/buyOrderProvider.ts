import { supabase } from '../../services/supabaseClient';
import { UnifiedActionItem } from '../types/notificationTypes';

export async function fetchBuyOrderActionItems(
    userRole: string,
    storeNumber: string,
    readOrderIds: string[],
    onReadOrder: (id: string) => Promise<void>
): Promise<UnifiedActionItem[]> {
    try {
        const currentYear = new Date().getFullYear();
        
        // Busca buy_orders recentes e não finalizadas/canceladas com sub_orders em uma única consulta
        const { data: ordersData, error: oError } = await supabase
            .from('buy_orders')
            .select(`
                id, 
                numero_pedido, 
                marca, 
                status, 
                created_at,
                buy_order_sub_orders (
                    sub_order_num,
                    lojas_numeros,
                    total_pares,
                    valor_bruto
                )
            `)
            .gte('created_at', `${currentYear}-01-01T00:00:00.000Z`)
            .not('status', 'in', '("cancelado","exportado")')
            .order('created_at', { ascending: false })
            .limit(30);

        if (oError) {
            console.error('[buyOrderProvider] Erro ao buscar pedidos:', oError);
            return [];
        }

        const orders = ordersData || [];
        const normalizedRole = String(userRole || '').toUpperCase().trim();
        const isAdminOrSuper = normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN';

        const list: UnifiedActionItem[] = [];

        orders.forEach(order => {
            const subOrders = (order.buy_order_sub_orders || []) as any[];
            
            // Filtro por número de loja de forma robusta e compatível
            const num = String(storeNumber || '').trim();
            const numPadded = num.padStart(2, '0');
            const numUnpadded = num.replace(/^0+/, '');

            const matchingSubOrders = subOrders.filter(so => {
                if (!so.lojas_numeros) return false;
                try {
                    const arr = Array.isArray(so.lojas_numeros) ? so.lojas_numeros : JSON.parse(so.lojas_numeros);
                    return arr.some((val: any) => {
                        const valStr = String(val).trim();
                        return valStr === num || valStr === numPadded || valStr === numUnpadded;
                    });
                } catch {
                    const str = String(so.lojas_numeros);
                    return str.includes(num) || str.includes(numPadded) || str.includes(numUnpadded);
                }
            });

            // Se não for admin e não tiver sub_orders para a loja, ignorar este pedido
            if (!isAdminOrSuper && matchingSubOrders.length === 0) {
                return;
            }

            // Define quais sub_orders usar para calcular os totais
            const targetSubs = isAdminOrSuper ? subOrders : matchingSubOrders;
            const totalPares = targetSubs.reduce((sum, s) => sum + Number(s.total_pares || 0), 0);
            const totalValor = targetSubs.reduce((sum, s) => sum + Number(s.valor_bruto || 0), 0);

            // Formata o valor bruto em BRL
            const valorFormatado = totalValor.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });

            const numeroPedido = order.numero_pedido || 'S/N';
            const marca = (order.marca || 'Sem Marca').toUpperCase();

            if (!readOrderIds.includes(order.id)) {
                list.push({
                    id: `order-action-${order.id}`,
                    category: 'pedidos',
                    priority: 'high',
                    title: 'NOVO PEDIDO CADASTRADO',
                    message: `Pedido #${numeroPedido} • ${marca} \n ${totalPares} pares • ${valorFormatado}`,
                    created_at: order.created_at || new Date().toISOString(),
                    target_url: 'buy_orders',
                    target_params: { order_id: order.id },
                    action_label: 'VER PEDIDO',
                    onAction: async () => {
                        await onReadOrder(order.id);
                    }
                });
            }
        });

        return list;
    } catch (err) {
        console.error('[buyOrderProvider] Erro inesperado no buyOrderProvider:', err);
        return [];
    }
}

