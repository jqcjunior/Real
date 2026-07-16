import { supabase } from '../../services/supabaseClient';
import { UnifiedActionItem } from '../types/notificationTypes';
import { ensureSession } from '../../services/authService';

export async function fetchGoalsActionItems(
    storeId: string,
    acknowledgedGoalsMap: Map<string, string>,
    onDismissGoal: (id: string, notificationType: 'mensal' | 'semanal') => Promise<void>
): Promise<UnifiedActionItem[]> {
    if (!storeId) return [];

    try {
        await ensureSession();

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-indexed

        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 7); // Only show weeks ending in the last 7 days or future
        const limitDateStr = limitDate.toISOString().split('T')[0];

        // 1. Busca metas mensais para o ano atual ou futuro
        const { data: goalsData, error: gError } = await supabase
            .from('monthly_goals')
            .select('*')
            .eq('store_id', storeId)
            .gte('year', currentYear);

        if (gError) {
            console.error('[goalsProvider] Erro ao buscar metas mensais: ' + JSON.stringify(gError));
        }

        // 2. Busca semanas recentes ou futuras
        const { data: weeksData, error: wError } = await supabase
            .from('Dashboard_PA_Semanas')
            .select('*')
            .eq('store_id', storeId)
            .gte('data_fim', limitDateStr)
            .order('data_inicio', { ascending: false });

        if (wError) {
            console.error('[goalsProvider] Erro ao buscar semanas: ' + JSON.stringify(wError));
        }

        // Filtro correto de metas mensais (Parte 1: só o mês vigente)
        const storeGoals = (goalsData || []).filter(g => {
            return Number(g.year) === currentYear && Number(g.month) === currentMonth;
        });

        const storeWeeks = weeksData || [];
        const list: UnifiedActionItem[] = [];

        // Pre-carregar valores da semana vigente se existir (Parte 4)
        const todayStr = new Date().toISOString().split('T')[0];
        const currentWeek = storeWeeks.find(w => w.data_inicio <= todayStr && todayStr <= w.data_fim);

        let currentWeekMetaValor = 0;
        let currentWeekPATarget = 0;
        let currentWeekTicketTarget = 0;

        if (currentWeek) {
            try {
                const { data: detalhe, error: errDetalhe } = await supabase.rpc('fn_calc_meta_semanal_detalhado', {
                    p_store_id: storeId,
                    p_semana_id: currentWeek.id
                });
                if (!errDetalhe && detalhe && detalhe.length > 0) {
                    currentWeekMetaValor = Number(detalhe[0].meta_loja || 0);
                }
            } catch (err) {
                console.error('[goalsProvider] Erro ao carregar fn_calc_meta_semanal_detalhado:', err);
            }

            const activeMonthlyGoal = storeGoals[0];
            if (activeMonthlyGoal) {
                currentWeekPATarget = Number(activeMonthlyGoal.pa_target || 0);
                currentWeekTicketTarget = Number(activeMonthlyGoal.ticket_target || 0);
            }
        }

        // 1. Metas Mensais
        storeGoals.forEach(g => {
            const gId = `goal-${g.store_id}-${g.year}-${g.month}`; // Chave composta única de negócio
            const isAcknowledged = acknowledgedGoalsMap.has(gId);
            const acknowledgedAt = acknowledgedGoalsMap.get(gId);

            list.push({
                id: gId,
                category: 'metas',
                priority: 'medium',
                title: 'META MENSAL PUBLICADA',
                message: 'A meta mensal de faturamento foi estabelecida para sua loja.',
                created_at: g.created_at || new Date().toISOString(),
                target_url: 'dashboard_manager',
                action_label: isAcknowledged ? 'Ver Detalhes' : 'Conferir Meta',
                onAction: async () => {
                    await onDismissGoal(gId, 'mensal');
                },
                isAcknowledged,
                acknowledgedAt,
                metaValues: {
                    metaValor: Number(g.revenue_target || 0),
                    tipo: 'mensal'
                }
            });
        });

        // 2. Metas Semanais
        storeWeeks.forEach(w => {
            const wId = `week-goal-${w.id}`;
            const isCurrent = w.data_inicio <= todayStr && todayStr <= w.data_fim;
            const isAcknowledged = acknowledgedGoalsMap.has(wId);
            const acknowledgedAt = acknowledgedGoalsMap.get(wId);

            // NUNCA excluir essa semana (isCurrent === true) da lista mesmo se já tiver acknowledgment registrado.
            // Para as outras semanas (not current), se já reconhecidas (isAcknowledged === true), excluir da lista.
            if (!isCurrent && isAcknowledged) {
                return;
            }

            const metaValues = isCurrent ? {
                metaValor: currentWeekMetaValor,
                paTarget: currentWeekPATarget,
                ticketTarget: currentWeekTicketTarget,
                dataInicio: w.data_inicio,
                dataFim: w.data_fim,
                tipo: 'semanal' as const
            } : undefined;

            list.push({
                id: wId,
                category: 'metas',
                priority: isCurrent ? 'high' : 'medium',
                title: isCurrent ? 'META SEMANAL ALTERADA' : 'META DISPONÍVEL PARA CONFERÊNCIA',
                message: `A meta semanal da semana de ${new Date(w.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')} foi publicada e está disponível para conferência.`,
                created_at: w.created_at || new Date().toISOString(),
                target_url: 'dashboard_manager',
                action_label: isAcknowledged ? 'Ver Detalhes' : 'Ver Detalhes',
                onAction: async () => {
                    await onDismissGoal(wId, 'semanal');
                },
                isAcknowledged,
                acknowledgedAt,
                metaValues
            });
        });

        return list;
    } catch (err) {
        console.error('[goalsProvider] Erro inesperado no goalsProvider:', err);
        return [];
    }
}
