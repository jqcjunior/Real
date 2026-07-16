import { supabase } from '../services/supabaseClient';

/**
 * Define sessão do usuário no banco (RLS)
 */
export async function setUserSession(userId: string): Promise<boolean> {
    if (!userId) {
        console.error('❌ setUserSession: userId nulo');
        return false;
    }

    try {
        const { error } = await supabase.rpc('set_user_session', {
            p_user_id: String(userId) // ✅ usar p_user_id consistente com a DB
        });
        
        if (error) {
            console.error('❌ Erro ao definir sessão:', error);
            return false;
        }
        
        return true;
    } catch (err: any) {
        console.error('❌ Exceção em setUserSession:', err);
        return false;
    }
}
