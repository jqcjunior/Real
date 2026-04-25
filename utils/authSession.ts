import { supabase } from '../services/supabaseClient';

/**
 * Define sessão do usuário no banco (OBRIGATÓRIO para RLS)
 * Deve ser chamado após login e ao inicializar app
 */
export async function setUserSession(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('set_user_session', {
      user_id: userId
    });
    
    if (error) {
      console.error('❌ Erro ao definir sessão:', error);
      return false;
    }
    
    console.log('✅ Sessão definida:', userId);
    return true;
  } catch (err) {
    console.error('❌ Exceção ao definir sessão:', err);
    return false;
  }
}
