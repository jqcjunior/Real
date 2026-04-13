-- ===============================================================
-- FINAL FIX: RLS AND SEQUENCES (CONSOLIDATED)
-- ===============================================================

-- 1. FIX DEMANDS_V2 TICKET GENERATION (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix text;
    next_val integer;
BEGIN
    year_prefix := to_char(now(), 'YYYY');
    -- SECURITY DEFINER allows this count to work even if RLS is enabled
    SELECT count(*) + 1 INTO next_val FROM public.demands_v2 WHERE ticket_number LIKE 'DEM-' || year_prefix || '-%';
    NEW.ticket_number := 'DEM-' || year_prefix || '-' || lpad(next_val::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FIX FINANCIAL RECEIPTS SEQUENCE
CREATE SEQUENCE IF NOT EXISTS public.financial_receipts_number_seq START 1;

-- Function to get next receipt number
CREATE OR REPLACE FUNCTION public.fn_get_next_receipt_number(p_token text DEFAULT NULL)
RETURNS json AS $$
DECLARE
    v_next_val integer;
BEGIN
    v_next_val := nextval('public.financial_receipts_number_seq');
    RETURN json_build_object(
        'success', true,
        'next_number', v_next_val,
        'formatted', lpad(v_next_val::text, 4, '0')
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC PARA CRIAR DEMANDA (Bypass RLS issues)
CREATE OR REPLACE FUNCTION public.fn_create_demand_v2(
    p_store_id uuid,
    p_title text,
    p_description text,
    p_priority text,
    p_category text,
    p_created_by uuid,
    p_status text DEFAULT 'aberta'
)
RETURNS json AS $$
DECLARE
    v_new_id uuid;
BEGIN
    INSERT INTO public.demands_v2 (
        store_id,
        title,
        description,
        priority,
        category,
        created_by,
        status
    ) VALUES (
        p_store_id,
        p_title,
        p_description,
        p_priority,
        p_category,
        p_created_by,
        p_status
    ) RETURNING id INTO v_new_id;

    RETURN json_build_object(
        'success', true,
        'id', v_new_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ROBUST RLS POLICIES FOR DEMANDS_V2
ALTER TABLE public.demands_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "demands_v2_select_policy" ON public.demands_v2;
DROP POLICY IF EXISTS "demands_v2_insert_policy" ON public.demands_v2;
DROP POLICY IF EXISTS "demands_v2_update_policy" ON public.demands_v2;

CREATE POLICY "demands_v2_select_policy" ON public.demands_v2 FOR SELECT TO public USING (true);
CREATE POLICY "demands_v2_insert_policy" ON public.demands_v2 FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "demands_v2_update_policy" ON public.demands_v2 FOR UPDATE TO public USING (true);

-- 5. GRANT PERMISSIONS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON SEQUENCE public.financial_receipts_number_seq TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_next_receipt_number(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_create_demand_v2(uuid, text, text, text, text, uuid, text) TO anon, authenticated, service_role;

-- 6. RPC PARA RESOLVER DEMANDA
CREATE OR REPLACE FUNCTION public.fn_resolve_demand_v2(
    p_demand_id uuid,
    p_user_id uuid,
    p_user_name text,
    p_user_role text
)
RETURNS json AS $$
DECLARE
    v_created_at timestamptz;
    v_resolution_time integer;
BEGIN
    -- Get creation time
    SELECT created_at INTO v_created_at FROM public.demands_v2 WHERE id = p_demand_id;
    
    -- Calculate resolution time in minutes
    v_resolution_time := EXTRACT(EPOCH FROM (now() - v_created_at)) / 60;

    -- Update demand
    UPDATE public.demands_v2 SET
        status = 'resolvida',
        resolved_at = now(),
        resolved_by = p_user_id,
        updated_at = now(),
        resolution_time_minutes = v_resolution_time
    WHERE id = p_demand_id;

    -- Insert resolution message
    INSERT INTO public.demands_messages_v2 (
        demand_id,
        sender_id,
        sender_name,
        sender_role,
        message,
        message_type
    ) VALUES (
        p_demand_id,
        p_user_id,
        p_user_name,
        p_user_role,
        'RESOLVEU O CHAMADO',
        'status_change'
    );

    RETURN json_build_object(
        'success', true
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.fn_resolve_demand_v2(uuid, uuid, text, text) TO anon, authenticated, service_role;

-- 7. RPC PARA ATRIBUIR DEMANDA
CREATE OR REPLACE FUNCTION public.fn_assign_demand_v2(
    p_demand_id uuid,
    p_assigned_to uuid,
    p_user_id uuid,
    p_user_name text,
    p_user_role text
)
RETURNS json AS $$
DECLARE
    v_assigned_name text;
BEGIN
    -- Get assigned user name
    SELECT name INTO v_assigned_name FROM public.admin_users WHERE id = p_assigned_to;

    -- Update demand
    UPDATE public.demands_v2 SET
        assigned_to = p_assigned_to,
        updated_at = now()
    WHERE id = p_demand_id;

    -- Insert assignment message
    INSERT INTO public.demands_messages_v2 (
        demand_id,
        sender_id,
        sender_name,
        sender_role,
        message,
        message_type
    ) VALUES (
        p_demand_id,
        p_user_id,
        p_user_name,
        p_user_role,
        'DIRECIONOU O CHAMADO PARA: ' || v_assigned_name,
        'assignment'
    );

    -- Create notification
    INSERT INTO public.demands_notifications (
        demand_id,
        user_id,
        notification_type,
        title,
        message
    ) VALUES (
        p_demand_id,
        p_assigned_to,
        'assigned',
        'Novo Chamado Atribuído',
        'Você foi designado para o chamado: ' || (SELECT title FROM public.demands_v2 WHERE id = p_demand_id)
    );

    RETURN json_build_object(
        'success', true
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.fn_assign_demand_v2(uuid, uuid, uuid, text, text) TO anon, authenticated, service_role;
