import { supabase } from '../../services/supabaseClient';
import { UnifiedActionItem, RawNotification } from '../types/notificationTypes';
import { ensureSession } from '../../services/authService';

export async function fetchDemandActionItems(
    userId: string,
    isUserIdValid: boolean,
    userRole: string,
    onMarkAsRead: (id: string) => Promise<boolean>
): Promise<UnifiedActionItem[]> {
    if (!isUserIdValid || !userId) return [];
    
    try {
        await ensureSession(userId);

        const { data: notificationsData, error: nError } = await supabase
            .from('demands_notifications')
            .select('*')
            .eq('user_id', userId)
            .eq('is_read', false)
            .order('created_at', { ascending: false });

        if (nError || !notificationsData) {
            console.error('[demandProvider] Erro ao buscar notificações: ' + JSON.stringify(nError));
            return [];
        }

        const notifications = notificationsData as RawNotification[];
        if (notifications.length === 0) return [];

        const demandIds = notifications
            .map(n => n.demand_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0);

        // Fetch demands structured data
        const demandsMap = new Map<string, { id: string; created_by: string; status: string; assigned_to?: string | null }>();
        if (demandIds.length > 0) {
            const { data: demandsData, error: dError } = await supabase
                .from('demands_v2')
                .select('id, created_by, status, assigned_to')
                .in('id', demandIds);

            if (!dError && demandsData) {
                demandsData.forEach(d => demandsMap.set(d.id, d));
            }
        }

        // Fetch messages to determine the sender of the last action
        const latestMessagesMap = new Map<string, { sender_id: string; message_type: string }>();
        if (demandIds.length > 0) {
            const { data: messagesData, error: mError } = await supabase
                .from('demands_messages_v2')
                .select('demand_id, sender_id, message_type')
                .in('demand_id', demandIds)
                .order('created_at', { ascending: false });

            if (!mError && messagesData) {
                messagesData.forEach(msg => {
                    if (!latestMessagesMap.has(msg.demand_id)) {
                        latestMessagesMap.set(msg.demand_id, msg);
                    }
                });
            }
        }

        const list: UnifiedActionItem[] = [];
        const normalizedRole = String(userRole || '').toUpperCase().trim();
        const isAdminOrTech = normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN' || normalizedRole === 'TÉCNICO';

        notifications.forEach(notif => {
            const demandId = notif.demand_id;
            if (!demandId) return;

            const dem = demandsMap.get(demandId);
            if (!dem) return; // Ignore if demand doesn't exist anymore

            const latestMsg = latestMessagesMap.get(demandId);

            // 1. "Nunca notificar ações realizadas pelo próprio usuário"
            if (latestMsg && latestMsg.sender_id === userId) {
                return;
            }

            const type = notif.notification_type;

            if (isAdminOrTech) {
                // Admin and Tech rules
                let pLevel: 'critical' | 'high' | 'medium' | 'low' = 'medium';
                if (type === 'sla_warning' || type === 'sla_exceeded') {
                    pLevel = 'critical';
                } else if (type === 'new_demand' || type === 'assigned') {
                    pLevel = 'high';
                }

                list.push({
                    id: `demand-action-${notif.id}`,
                    category: 'chamados',
                    priority: pLevel,
                    title: notif.title || 'Chamado Atualizado',
                    message: notif.message || '',
                    created_at: notif.created_at || new Date().toISOString(),
                    target_url: 'demands',
                    action_label: 'Ver Chamado',
                    onAction: async () => {
                        await onMarkAsRead(notif.id);
                    }
                });
            } else {
                // Manager rules:
                // O gerente somente deverá receber notificação quando:
                // * alguém responder seu chamado (new_message ou new_attachment);
                // * seu chamado for finalizado (status_change para resolvida ou cancelada).
                const isMyDemand = dem.created_by === userId || dem.assigned_to === userId;
                if (!isMyDemand) return;

                const isReply = type === 'new_message' || type === 'new_attachment';
                const isFinalized = type === 'status_change' && (dem.status === 'resolvida' || dem.status === 'cancelada');

                if (isReply || isFinalized) {
                    const pLevel: 'critical' | 'high' | 'medium' | 'low' = isFinalized ? 'high' : 'medium';

                    list.push({
                        id: `demand-action-${notif.id}`,
                        category: 'chamados',
                        priority: pLevel,
                        title: notif.title || 'Chamado Atualizado',
                        message: notif.message || '',
                        created_at: notif.created_at || new Date().toISOString(),
                        target_url: 'demands',
                        action_label: 'Ver Chamado',
                        onAction: async () => {
                            await onMarkAsRead(notif.id);
                        }
                    });
                }
            }
        });

        return list;
    } catch (err) {
        console.error('[demandProvider] Erro inesperado no demandProvider:', err);
        return [];
    }
}
