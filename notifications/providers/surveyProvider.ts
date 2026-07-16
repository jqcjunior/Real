import { supabase } from '../../services/supabaseClient';
import { UnifiedActionItem } from '../types/notificationTypes';
import { User } from '../../types';
import { ensureSession } from '../../services/authService';

export async function fetchSurveyActionItems(
    userId: string,
    isUserIdValid: boolean,
    user: User | null
): Promise<UnifiedActionItem[]> {
    if (!isUserIdValid || !userId || !user) return [];

    try {
        await ensureSession(userId);

        const { data: surveysData, error: sError } = await supabase
            .from('surveys')
            .select('*')
            .eq('is_active', true)
            .eq('target_type', 'internal')
            .eq('notify_pending', true);

        if (sError || !surveysData) {
            console.error('[surveyProvider] Erro ao buscar pesquisas:', sError);
            return [];
        }

        let surveysVisiveis = surveysData;

        // Filtro de loja e cargo
        surveysVisiveis = surveysVisiveis.filter(survey => {
            const userStoreId = user.storeId || user.store_id;
            if (userStoreId && survey.target_store_ids && survey.target_store_ids.length > 0) {
                if (!survey.target_store_ids.includes(userStoreId)) {
                    return false;
                }
            }

            const normalizedRole = String(user.role || '').toUpperCase().trim();
            if (normalizedRole !== 'ADMIN' && normalizedRole !== 'SUPER_ADMIN') {
                const roleLevel = String(user.role || '').toLowerCase().trim();
                if (survey.target_category === 'all_managers') {
                    if (roleLevel !== 'manager') return false;
                }
                if (survey.target_category === 'all_cashiers') {
                    if (roleLevel !== 'cashier') return false;
                }
                if (survey.target_category === 'all_sellers') {
                    if (roleLevel !== 'seller' && roleLevel !== 'vendedor') return false;
                }
                if (survey.target_category === 'specific_users') {
                    if (!survey.target_user_ids?.includes(userId)) return false;
                }
            }
            return true;
        });

        const { data: responses, error: rError } = await supabase
            .from('survey_responses')
            .select('survey_id')
            .eq('user_id', userId);

        if (rError) {
            console.error('[surveyProvider] Erro ao buscar respostas de pesquisas:', rError);
            return [];
        }

        const respondedSurveyIds = responses?.map(r => r.survey_id) || [];
        const finalPending = surveysVisiveis.filter(s => !respondedSurveyIds.includes(s.id));

        const list: UnifiedActionItem[] = [];

        finalPending.forEach(survey => {
            list.push({
                id: `survey-action-${survey.id}`,
                category: 'pesquisas',
                priority: 'medium',
                title: 'PESQUISA DE OPINIÃO PENDENTE',
                message: `Você possui uma pesquisa de opinião ativa para responder: ${survey.title}`,
                created_at: survey.created_at || new Date().toISOString(),
                target_url: 'my_surveys',
                action_label: 'Responder Pesquisa',
                onAction: async () => {}
            });
        });

        return list;
    } catch (err) {
        console.error('[surveyProvider] Erro inesperado no surveyProvider:', err);
        return [];
    }
}
