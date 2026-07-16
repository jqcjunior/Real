export type NotificationType =
    | 'new_demand'
    | 'new_message'
    | 'assigned'
    | 'status_change'
    | 'sla_warning'
    | 'sla_exceeded'
    | 'new_attachment'
    | 'new_order'
    | 'new_goal'
    | 'new_survey';

export interface NotificationMetadata {
    demand_id?: string;
    user_id: string;
    read_at?: string | null;
}

export interface RawNotification {
    id: string;
    notification_type: NotificationType;
    title: string;
    message: string;
    created_at: string;
    is_read: boolean;
    demand_id?: string;
    user_id: string;
    read_at?: string | null;
}

export interface UnifiedNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    created_at: string;
    read: boolean;
    target_url: string;
    colorClass: string;
    metadata?: NotificationMetadata;
}

export type CentralCategory = 'pedidos' | 'chamados' | 'pesquisas' | 'metas' | 'agenda';
export type CentralPriority = 'critical' | 'high' | 'medium' | 'low';

export interface UnifiedActionItem {
    id: string;
    category: CentralCategory;
    priority: CentralPriority;
    title: string;
    message: string;
    created_at: string;
    target_url: string;
    target_params?: any;
    action_label: string;
    onAction: () => Promise<void>;
    isAcknowledged?: boolean;
    acknowledgedAt?: string;
    metaValues?: {
        metaValor: number;
        paTarget?: number;
        ticketTarget?: number;
        dataInicio?: string;
        dataFim?: string;
        tipo: 'semanal' | 'mensal';
    };
}
