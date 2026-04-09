import { supabase } from './supabaseClient';

export async function loginUser(email: string, password: string) {
  // 1. Autenticar usuário
  const { data, error } = await supabase.rpc('authenticate_user', {
    p_email: email,
    p_password: password
  });

  if (error || !data || !data[0]?.is_valid) {
    throw new Error('Credenciais inválidas');
  }

  const user = data[0];

  // 2. SETAR SESSÃO (CRÍTICO!)
  await supabase.rpc('set_user_session', {
    user_id: user.user_id
  });

  // 3. Salvar no localStorage
  localStorage.setItem('user', JSON.stringify(user));

  return user;
}

export async function ensureSession() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return;

  try {
    const user = JSON.parse(userStr);
    if (user?.user_id) {
      await supabase.rpc('set_user_session', {
        user_id: user.user_id
      });
    }
  } catch (e) {
    console.error('Erro ao restaurar sessão:', e);
    localStorage.removeItem('user');
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
