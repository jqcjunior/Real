import { supabase } from './supabaseClient';

export async function loginUser(email: string, password: string) {
  // 1. Autenticar usuário
  const { data, error } = await supabase.rpc('authenticate_user', {
    p_email: email.trim(),
    p_password: password.trim()
  });

  if (error) {
    console.error('Login RPC Error:', error);
    throw new Error(error.message || 'Erro de conexão com o banco.');
  }

  if (!data || !data[0]?.is_valid) {
    throw new Error(data?.[0]?.error_message || 'Credenciais inválidas ou conta pendente.');
  }

  const user = data[0];
  const userId = user.user_id || user.id || user.userId;

  if (!userId) {
    throw new Error('Erro interno: ID do usuário não encontrado');
  }
  
  // 2. SETAR SESSÃO (CRÍTICO!)
  try {
    const { error: sessionError } = await supabase.rpc('set_user_session', {
      p_user_id: String(userId) // ✅ SEMPRE string
    });
    
    if (sessionError) {
      console.warn('⚠️ Erro RLS não bloqueante no loginUser:', sessionError);
    }
  } catch (err) {
    console.warn('⚠️ Exceção ao estabelecer sessão (não bloqueante):', err);
  }

  // 3. ✅ CORRIGIDO: Salvar no localStorage (NÃO sessionStorage)
  localStorage.setItem('realcalcados_user', JSON.stringify({ ...user, id: userId }));

  return { ...user, id: userId };
}

/**
 * ✅ CORRIGIDO: Reestabelecer sessão a partir do localStorage
 */
export async function ensureSession() {
  const userStr = localStorage.getItem('realcalcados_user'); // ✅ CORRIGIDO

  if (!userStr) {
    console.warn('⚠️ ensureSession: Nenhum usuário encontrado no localStorage');
    return;
  }

  try {
    const user = JSON.parse(userStr);
    const userId = user?.user_id || user?.id || user?.userId;
    
    if (!userId) {
      console.error('❌ ensureSession: Usuário sem ID válido');
      localStorage.removeItem('realcalcados_user'); // Limpa dados corrompidos
      return;
    }

    const { error } = await supabase.rpc('set_user_session', {
      p_user_id: String(userId)
    });

    if (error) {
      console.error('❌ Erro ao reestabelecer sessão:', error);
      // Não limpa o localStorage aqui - pode ser erro temporário
    } else {
      console.log('✅ Sessão reestabelecida para:', userId);
    }
  } catch (e) {
    console.error('❌ Erro ao restaurar sessão:', e);
    localStorage.removeItem('realcalcados_user');
  }
}

export async function secureQuery() {
  await ensureSession();
  return supabase;
}

export const authService = {
  loginUser,
  ensureSession,
  secureQuery
};

export default authService;