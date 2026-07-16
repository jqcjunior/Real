-- Fix set_user_session ambiguity by dropping overloaded versions and creating a unique one

-- 1. Remover versões sobrecarregadas problemáticas
DROP FUNCTION IF EXISTS public.set_user_session(text);
DROP FUNCTION IF EXISTS public.set_user_session(uuid);

-- 2. Criar a nova versão com o nome de parâmetro solicitado pelo usuário (p_user_id)
-- para garantir que ela aceite TEXT (que é o que o JS envia)
CREATE OR REPLACE FUNCTION public.set_user_session(p_user_id TEXT)
RETURNS void AS $$
BEGIN
  -- Define a variável de configuração da sessão que o RLS pode ler
  PERFORM set_config('app.current_user_id', p_user_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recarregar o cache do schema do PostgREST
NOTIFY pgrst, 'reload schema';
