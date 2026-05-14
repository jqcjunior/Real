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
            user_id: String(userId) // ✅ user_id (NÃO p_user_id)
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
