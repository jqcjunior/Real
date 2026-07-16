import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { toast } from 'sonner';
import { User, Store, AgendaItem } from '../types';
import { ensureSession } from '../services/authService';

// Re-export all type definitions to maintain absolute backwards compatibility
export * from '../notifications/types/notificationTypes';

import { 
    UnifiedActionItem, 
    CentralCategory, 
    RawNotification, 
    UnifiedNotification,
    NotificationType
} from '../notifications/types/notificationTypes';

import { fetchDemandActionItems } from '../notifications/providers/demandProvider';
import { fetchAgendaActionItems } from '../notifications/providers/agendaProvider';
import { fetchSurveyActionItems } from '../notifications/providers/surveyProvider';
import { fetchGoalsActionItems } from '../notifications/providers/goalsProvider';
import { fetchBuyOrderActionItems } from '../notifications/providers/buyOrderProvider';
import { runSystemTaskScheduler } from '../notifications/scheduler/systemTaskScheduler';

// ═══════════════════════════════════════════════════════════════════════════
// CENTRAL INTERPRETATION LAYER (Keep for backward compatibility / reference)
// ═══════════════════════════════════════════════════════════════════════════

export const getNotificationDestination = (type: NotificationType): string => {
    switch (type) {
        case 'new_demand':
        case 'new_message':
        case 'assigned':
        case 'status_change':
        case 'sla_warning':
        case 'sla_exceeded':
        case 'new_attachment':
            return 'demands';
        case 'new_order':
            return 'buy_orders';
        case 'new_goal':
            return 'dashboard_manager';
        case 'new_survey':
            return 'my_surveys';
        default:
            return 'demands';
    }
};

export const getNotificationColor = (type: NotificationType): string => {
    switch (type) {
        case 'new_order':
            return 'bg-amber-600';
        case 'new_goal':
            return 'bg-emerald-600';
        case 'new_survey':
            return 'bg-purple-600';
        case 'new_demand':
        case 'new_message':
        case 'assigned':
        case 'status_change':
        case 'sla_warning':
        case 'sla_exceeded':
        case 'new_attachment':
        default:
            return 'bg-blue-600';
    }
};

export const standardizeNotification = (raw: RawNotification): UnifiedNotification => {
    const type = raw.notification_type || 'new_demand';
    return {
        id: raw.id,
        type,
        title: raw.title || '',
        message: raw.message || '',
        created_at: raw.created_at || new Date().toISOString(),
        read: raw.is_read || false,
        target_url: getNotificationDestination(type),
        colorClass: getNotificationColor(type),
        metadata: {
            demand_id: raw.demand_id,
            user_id: raw.user_id,
            read_at: raw.read_at,
        }
    };
};

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: useNotifications
// ═══════════════════════════════════════════════════════════════════════════

export function useNotifications(
    user: User | null,
    stores: Store[],
    agenda: AgendaItem[],
    can: (perm: string) => boolean
) {
    const [rawNotifications, setRawNotifications] = useState<RawNotification[]>([]);
    const [locallyCompletedTaskIds, setLocallyCompletedTaskIds] = useState<Set<string>>(new Set());

    // State arrays for modular action items
    const [demandActions, setDemandActions] = useState<UnifiedActionItem[]>([]);
    const [agendaActions, setAgendaActions] = useState<UnifiedActionItem[]>([]);
    const [surveyActions, setSurveyActions] = useState<UnifiedActionItem[]>([]);
    const [goalsActions, setGoalsActions] = useState<UnifiedActionItem[]>([]);
    const [buyOrderActions, setBuyOrderActions] = useState<UnifiedActionItem[]>([]);

    const userId = user?.id || user?.user_id || '';
    const isUserIdValid = userId && typeof userId === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);

    // Pre-calculate and stabilize primitive identifiers to prevent duplicate queries on array/object reference updates
    const userStore = useMemo(() => {
        if (!user || !stores) return null;
        return stores.find(s => s.id === user.storeId || s.id === user.store_id);
    }, [user, stores]);

    const storeId = userStore?.id || '';
    const storeNumber = userStore?.number || '';
    const userRole = user?.role || '';
    const isAdmin = userRole.toUpperCase() === 'ADMIN' || userRole.toUpperCase() === 'SUPER_ADMIN';
    const roleUpper = String(userRole || '').toUpperCase().trim();
    const isGestor = roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN' || roleUpper === 'MANAGER';

    // Lists of local dismiss/read states to maintain client persistence
    const [readOrderIds, setReadOrderIds] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem(`read_orders_user_${userId}`);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const [acknowledgedGoalsMap, setAcknowledgedGoalsMap] = useState<Map<string, string>>(() => {
        try {
            const stored = localStorage.getItem(`ack_goals_map_user_${userId}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                return new Map(Object.entries(parsed));
            }
        } catch {
            // ignore
        }
        return new Map();
    });

    // For backwards compatibility
    const dismissedGoalIds = useMemo(() => Array.from(acknowledgedGoalsMap.keys()), [acknowledgedGoalsMap]);

    useEffect(() => {
        if (!userId) return;
        try {
            const oStored = localStorage.getItem(`read_orders_user_${userId}`);
            setReadOrderIds(oStored ? JSON.parse(oStored) : []);
            
            const gStored = localStorage.getItem(`ack_goals_map_user_${userId}`);
            if (gStored) {
                const parsed = JSON.parse(gStored);
                setAcknowledgedGoalsMap(new Map(Object.entries(parsed)));
            } else {
                setAcknowledgedGoalsMap(new Map());
            }
        } catch {
            // ignore
        }
    }, [userId]);

    // Load acknowledged goals from DB on mount/userId change
    useEffect(() => {
        if (!isUserIdValid || !userId) return;
        const fetchAcks = async () => {
            try {
                const { data, error } = await supabase
                    .from('goal_notification_acknowledgments')
                    .select('notification_id, acknowledged_at')
                    .eq('user_id', userId);
                if (error) {
                    console.error("Erro ao carregar goal_notification_acknowledgments:", error);
                    return;
                }
                if (data) {
                    const nextMap = new Map<string, string>();
                    data.forEach(r => {
                        nextMap.set(r.notification_id, r.acknowledged_at);
                    });
                    setAcknowledgedGoalsMap(nextMap);
                    try {
                        const obj = Object.fromEntries(nextMap.entries());
                        localStorage.setItem(`ack_goals_map_user_${userId}`, JSON.stringify(obj));
                    } catch {}
                }
            } catch (err) {
                console.error("Erro ao buscar acks de meta:", err);
            }
        };
        fetchAcks();
    }, [userId, isUserIdValid]);

    // 1. Run System Task Scheduler (idempotent, server-side persistence)
    useEffect(() => {
        if (!isUserIdValid || !user) return;
        runSystemTaskScheduler(userId, user.role || '');
    }, [userId, isUserIdValid, user]);

    // 2. Load demands/notifications in background with Real-time Channel
    useEffect(() => {
        if (!isUserIdValid) return;

        const fetchDemandNotifications = async () => {
            try {
                await ensureSession(userId);

                const { data, error } = await supabase
                    .from('demands_notifications')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('is_read', false)
                    .order('created_at', { ascending: false });
                
                if (error) {
                    console.error("Erro ao carregar notificações de chamados:", error);
                    return;
                }

                if (data) {
                    setRawNotifications(data as RawNotification[]);
                }
            } catch (err) {
                console.error("Erro no fluxo de carregar notificações de chamados:", err);
            }
        };

        fetchDemandNotifications();

        const channel = supabase
            .channel('demand-notifications-realtime')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'demands_notifications', 
                    filter: `user_id=eq.${userId}` 
                }, 
                (payload) => {
                    const newNotif = payload.new as RawNotification;
                    setRawNotifications(prev => {
                        if (prev.some(n => n.id === newNotif.id)) return prev;
                        const updated = [...prev, newNotif];
                        return updated.sort((a, b) => 
                            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                        );
                    });

                    const type = newNotif.notification_type;
                    if (type === 'new_order' || type === 'new_goal' || type === 'new_survey') {
                        toast(newNotif.title, {
                            description: newNotif.message,
                            duration: 6000,
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, isUserIdValid]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Callbacks to Dismiss and Complete Actions
    // ═══════════════════════════════════════════════════════════════════════════

    const handleMarkAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
        try {
            if (isUserIdValid) {
                await ensureSession(userId);
            }

            let query = supabase
                .from('demands_notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);

            if (isUserIdValid) {
                query = query.eq('user_id', userId);
            }

            const { error } = await query;
            
            if (error) {
                console.error("Erro ao marcar notificação como lida no Supabase:", error);
                toast.error("Erro ao marcar notificação como lida.");
                return false;
            }

            setRawNotifications(prev => prev.filter(n => n.id !== notificationId));
            return true;
        } catch (err) {
            console.error("Erro inesperado ao marcar notificação como lida:", err);
            return false;
        }
    }, [userId, isUserIdValid]);

    const handleMarkTaskAsCompleted = useCallback(async (taskId: string): Promise<boolean> => {
        try {
            if (isUserIdValid) {
                await ensureSession(userId);
            }

            const { error } = await supabase
                .from('agenda_tasks')
                .update({ is_completed: true })
                .eq('id', taskId);

            if (error) {
                console.error("Erro ao marcar tarefa como concluída no Supabase:", error);
                toast.error("Erro ao marcar tarefa como concluída.");
                return false;
            }
            setLocallyCompletedTaskIds(prev => new Set(prev).add(taskId));
            return true;
        } catch (err) {
            console.error("Erro inesperado ao marcar tarefa como concluída:", err);
            return false;
        }
    }, [userId, isUserIdValid]);

    const handleDismissGoal = useCallback(async (gId: string, notificationType: 'mensal' | 'semanal') => {
        const nowIso = new Date().toISOString();
        
        // Optimistic update of state
        setAcknowledgedGoalsMap(prev => {
            const next = new Map(prev);
            next.set(gId, nowIso);
            try {
                const obj = Object.fromEntries(next.entries());
                localStorage.setItem(`ack_goals_map_user_${userId}`, JSON.stringify(obj));
            } catch {}
            return next;
        });

        // Insert into database with ON CONFLICT
        try {
            if (isUserIdValid) {
                await ensureSession(userId);
            }
            const { error } = await supabase
                .from('goal_notification_acknowledgments')
                .upsert({
                    notification_id: gId,
                    notification_type: notificationType,
                    store_id: storeId || null,
                    user_id: userId,
                    acknowledged_at: nowIso
                }, {
                    onConflict: 'notification_id,user_id'
                });

            if (error) {
                console.error("Erro ao salvar acknowledgment de meta no Supabase:", error);
            }
        } catch (err) {
            console.error("Erro ao salvar acknowledgment:", err);
        }
    }, [userId, isUserIdValid, storeId]);

    const handleReadOrder = useCallback(async (orderId: string) => {
        const updated = [...readOrderIds, orderId];
        setReadOrderIds(updated);
        localStorage.setItem(`read_orders_user_${userId}`, JSON.stringify(updated));
    }, [readOrderIds, userId]);

    // ═══════════════════════════════════════════════════════════════════════════
    // DELEGATE TO PROVIDERS (Decoupled, Modular execution)
    // ═══════════════════════════════════════════════════════════════════════════

    // A. Demands/Tickets actions (reactive to real-time notification changes)
    useEffect(() => {
        if (!isUserIdValid || !userId || !user) return;
        const loadDemands = async () => {
            const items = await fetchDemandActionItems(userId, isUserIdValid, user.role || '', handleMarkAsRead);
            setDemandActions(items);
        };
        loadDemands();
    }, [userId, isUserIdValid, user, rawNotifications, handleMarkAsRead]);

    // B. Agenda actions (reactive to parent state/agenda updates)
    useEffect(() => {
        if (!userId) return;
        const loadAgenda = async () => {
            const items = await fetchAgendaActionItems(
                userId,
                agenda,
                locallyCompletedTaskIds,
                async (tid) => {
                    await handleMarkTaskAsCompleted(tid);
                }
            );
            setAgendaActions(items);
        };
        loadAgenda();
    }, [userId, agenda, locallyCompletedTaskIds, handleMarkTaskAsCompleted]);

    // C. Survey actions
    useEffect(() => {
        if (!isUserIdValid || !userId || !user) return;
        const loadSurveys = async () => {
            const items = await fetchSurveyActionItems(userId, isUserIdValid, user);
            setSurveyActions(items);
        };
        loadSurveys();
    }, [userId, isUserIdValid, user]);

    // D. Goals actions
    useEffect(() => {
        if (!storeId || !isGestor) {
            setGoalsActions([]);
            return;
        }

        const loadGoals = async () => {
            const items = await fetchGoalsActionItems(
                storeId,
                acknowledgedGoalsMap,
                handleDismissGoal
            );
            setGoalsActions(items);
        };
        loadGoals();
    }, [storeId, acknowledgedGoalsMap, handleDismissGoal, isGestor]);

    // E. Buy Orders actions
    useEffect(() => {
        if (!isGestor) {
            setBuyOrderActions([]);
            return;
        }

        const loadBuyOrders = async () => {
            const items = await fetchBuyOrderActionItems(
                userRole,
                storeNumber,
                readOrderIds,
                handleReadOrder
            );
            setBuyOrderActions(items);
        };
        loadBuyOrders();
    }, [userRole, storeNumber, readOrderIds, handleReadOrder, isGestor]);

    // ═══════════════════════════════════════════════════════════════════════════
    // ORCHESTRATE & UNIFY PENDENCIES
    // ═══════════════════════════════════════════════════════════════════════════

    const activePendencies = useMemo(() => {
        const list = [
            ...demandActions,
            ...agendaActions,
            ...surveyActions,
            ...goalsActions,
            ...buyOrderActions
        ];

        const priorityWeight = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1
        };

        return list.sort((a, b) => {
            const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
            if (diff !== 0) return diff;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [demandActions, agendaActions, surveyActions, goalsActions, buyOrderActions]);

    const groupedPendencies = useMemo(() => {
        const groups: Record<CentralCategory, UnifiedActionItem[]> = {
            pedidos: [],
            chamados: [],
            pesquisas: [],
            metas: [],
            agenda: []
        };

        activePendencies.forEach(item => {
            if (groups[item.category]) {
                groups[item.category].push(item);
            }
        });

        return groups;
    }, [activePendencies]);

    const summary = useMemo(() => {
        let critical = 0;
        let important = 0;
        let info = 0;

        activePendencies.forEach(item => {
            if (item.priority === 'critical') {
                critical++;
            } else if (item.priority === 'high') {
                important++;
            } else {
                info++;
            }
        });

        return { critical, important, info };
    }, [activePendencies]);

    const centralTitle = useMemo(() => {
        const role = String(user?.role || '').toUpperCase().trim();
        if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'Central do Administrador';
        if (role === 'MANAGER') return 'Central do Gerente';
        return 'Central de Notificações';
    }, [user]);

    const pendingAccessRequests = useMemo(() => {
        if (!can('ALWAYS')) return [];
        return stores.filter(s => s.status === 'pending');
    }, [stores, can]);

    const totalNotifications = useMemo(() => {
        return activePendencies.length + pendingAccessRequests.length;
    }, [activePendencies.length, pendingAccessRequests.length]);

    const standardizedNotifications = useMemo(() => {
        return rawNotifications.map(standardizeNotification);
    }, [rawNotifications]);

    return {
        notifications: standardizedNotifications,
        pendingAccessRequests,
        totalNotifications,
        handleMarkAsRead,
        handleMarkTaskAsCompleted,
        
        // Central Operational properties
        pendencies: activePendencies,
        groupedPendencies,
        summary,
        centralTitle
    };
}
