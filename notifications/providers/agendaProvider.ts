import { UnifiedActionItem } from '../types/notificationTypes';
import { AgendaItem } from '../../types';

export async function fetchAgendaActionItems(
    userId: string,
    agenda: AgendaItem[],
    locallyCompletedTaskIds: Set<string>,
    onCompleteTask: (taskId: string) => Promise<void>
): Promise<UnifiedActionItem[]> {
    if (!userId) return [];

    try {
        const userAgendaTasks = (agenda || []).filter(t => String((t as any).userId || (t as any).user_id) === String(userId));
        const pendingAgenda = userAgendaTasks.filter(t => !t.isCompleted && !locallyCompletedTaskIds.has(t.id));

        const list: UnifiedActionItem[] = [];

        pendingAgenda.forEach(task => {
            let pLevel: 'critical' | 'high' | 'medium' | 'low' = 'medium';
            const priority = String(task.priority || '').toLowerCase();
            if (priority === 'highest' || priority === 'critical') {
                pLevel = 'critical';
            } else if (priority === 'high') {
                pLevel = 'high';
            } else if (priority === 'low' || priority === 'lowest') {
                pLevel = 'low';
            }

            list.push({
                id: `task-action-${task.id}`,
                category: 'agenda',
                priority: pLevel,
                title: task.title,
                message: `${task.description || 'Compromisso operacional agendado.'} Prazo: ${task.dueDate} às ${task.dueTime}`,
                created_at: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
                target_url: 'agenda',
                action_label: 'Concluir',
                onAction: async () => {
                    await onCompleteTask(task.id);
                }
            });
        });

        return list;
    } catch (err) {
        console.error('[agendaProvider] Erro ao carregar ações de agenda:', err);
        return [];
    }
}
