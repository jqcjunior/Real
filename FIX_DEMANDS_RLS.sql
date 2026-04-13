-- FIX: Row Level Security (RLS) for Demands V2 Module
-- This migration updates the RLS policies to use the custom session mechanism (get_current_user_id)
-- and fixes the column names used for role checks.

-- 1. Grant permissions to anon and authenticated roles
GRANT ALL ON TABLE public.demands_v2 TO anon, authenticated;
GRANT ALL ON TABLE public.demands_messages_v2 TO anon, authenticated;
GRANT ALL ON TABLE public.demands_attachments_v2 TO anon, authenticated;
GRANT ALL ON TABLE public.demands_notifications TO anon, authenticated;

-- 2. Update demands_v2 policies
ALTER TABLE public.demands_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin vê todas as demandas" ON public.demands_v2;
DROP POLICY IF EXISTS "Gerente vê demandas da sua loja" ON public.demands_v2;
DROP POLICY IF EXISTS "Gerente cria demandas para sua loja" ON public.demands_v2;

CREATE POLICY "Admin vê todas as demandas" ON public.demands_v2
FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = public.get_current_user_id() 
        AND role_level = 'admin'
    )
);

CREATE POLICY "Gerente vê demandas da sua loja" ON public.demands_v2
FOR SELECT TO public 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = public.get_current_user_id() 
        AND (role_level = 'admin' OR store_id = demands_v2.store_id)
    )
);

CREATE POLICY "Gerente cria demandas para sua loja" ON public.demands_v2
FOR INSERT TO public 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = public.get_current_user_id() 
        AND (role_level = 'admin' OR store_id = demands_v2.store_id)
    )
);

CREATE POLICY "Gerente atualiza demandas da sua loja" ON public.demands_v2
FOR UPDATE TO public 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = public.get_current_user_id() 
        AND (role_level = 'admin' OR store_id = demands_v2.store_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = public.get_current_user_id() 
        AND (role_level = 'admin' OR store_id = demands_v2.store_id)
    )
);

-- 3. Update demands_messages_v2 policies
ALTER TABLE public.demands_messages_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso mensagens por demanda" ON public.demands_messages_v2;

CREATE POLICY "Acesso mensagens por demanda" ON public.demands_messages_v2
FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM public.demands_v2 
        WHERE id = demands_messages_v2.demand_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.demands_v2 
        WHERE id = demands_messages_v2.demand_id
    )
);

-- 4. Update demands_attachments_v2 policies
ALTER TABLE public.demands_attachments_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso anexos por demanda" ON public.demands_attachments_v2;

CREATE POLICY "Acesso anexos por demanda" ON public.demands_attachments_v2
FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM public.demands_v2 
        WHERE id = demands_attachments_v2.demand_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.demands_v2 
        WHERE id = demands_attachments_v2.demand_id
    )
);

-- 5. Update demands_notifications policies
ALTER TABLE public.demands_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuário vê suas notificações" ON public.demands_notifications;

CREATE POLICY "Usuário vê suas notificações" ON public.demands_notifications
FOR ALL TO public 
USING (user_id = public.get_current_user_id())
WITH CHECK (user_id = public.get_current_user_id());
