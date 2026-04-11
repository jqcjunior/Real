-- MIGRATION: SISTEMA DE DEMANDAS V2.0

-- 1. Tabelas Principais
CREATE TABLE IF NOT EXISTS public.demands_v2 (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number text UNIQUE,
    store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    category text,
    priority text CHECK (priority IN ('urgente', 'alta', 'media', 'baixa')) DEFAULT 'media',
    status text CHECK (status IN ('aberta', 'em_andamento', 'pausada', 'resolvida', 'cancelada')) DEFAULT 'aberta',
    sla_hours integer,
    sla_deadline timestamptz,
    created_by uuid REFERENCES public.admin_users(id),
    assigned_to uuid REFERENCES public.admin_users(id),
    resolved_by uuid REFERENCES public.admin_users(id),
    unread_count integer DEFAULT 0,
    total_messages integer DEFAULT 0,
    total_attachments integer DEFAULT 0,
    response_time_minutes integer,
    resolution_time_minutes integer,
    is_archived boolean DEFAULT false,
    archive_semester text, -- ex: "2026-S1"
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    paused_at timestamptz,
    resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.demands_messages_v2 (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    demand_id uuid REFERENCES public.demands_v2(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.admin_users(id),
    sender_name text,
    sender_role text,
    message text NOT NULL,
    message_type text CHECK (message_type IN ('comment', 'status_change', 'assignment')) DEFAULT 'comment',
    is_read boolean DEFAULT false,
    read_at timestamptz,
    read_by uuid REFERENCES public.admin_users(id),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demands_attachments_v2 (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    demand_id uuid REFERENCES public.demands_v2(id) ON DELETE CASCADE,
    message_id uuid REFERENCES public.demands_messages_v2(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_size integer,
    file_type text,
    is_compressed boolean DEFAULT false,
    original_size integer,
    compression_ratio numeric(4,2),
    image_width integer,
    image_height integer,
    uploaded_from_mobile boolean DEFAULT false,
    should_be_deleted_at timestamptz,
    is_deleted boolean DEFAULT false,
    deleted_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demands_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    demand_id uuid REFERENCES public.demands_v2(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.admin_users(id) ON DELETE CASCADE,
    notification_type text CHECK (notification_type IN ('new_message', 'assigned', 'sla_warning', 'new_attachment')),
    title text,
    message text,
    is_read boolean DEFAULT false,
    read_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 2. Funções e Triggers

-- Gerar Ticket Number (DEM-2026-0001)
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix text;
    next_val integer;
BEGIN
    year_prefix := to_char(now(), 'YYYY');
    SELECT count(*) + 1 INTO next_val FROM public.demands_v2 WHERE ticket_number LIKE 'DEM-' || year_prefix || '-%';
    NEW.ticket_number := 'DEM-' || year_prefix || '-' || lpad(next_val::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generate_ticket_number
BEFORE INSERT ON public.demands_v2
FOR EACH ROW EXECUTE FUNCTION public.generate_ticket_number();

-- Calcular SLA Deadline
CREATE OR REPLACE FUNCTION public.calculate_sla_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.priority = 'urgente' THEN 
        NEW.sla_hours := 4;
    ELSIF NEW.priority = 'alta' THEN 
        NEW.sla_hours := 24;
    ELSIF NEW.priority = 'media' THEN 
        NEW.sla_hours := 72;
    ELSE 
        NEW.sla_hours := 168;
    END IF;
    
    NEW.sla_deadline := now() + (NEW.sla_hours || ' hours')::interval;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calculate_sla_deadline
BEFORE INSERT ON public.demands_v2
FOR EACH ROW EXECUTE FUNCTION public.calculate_sla_deadline();

-- Incrementar contadores e atualizar timestamps
CREATE OR REPLACE FUNCTION public.update_demand_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.demands_v2 
        SET total_messages = total_messages + 1,
            unread_count = unread_count + 1,
            updated_at = now()
        WHERE id = NEW.demand_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_demand_stats
AFTER INSERT ON public.demands_messages_v2
FOR EACH ROW EXECUTE FUNCTION public.update_demand_stats();

-- Set Attachment Deletion Date (6 meses)
CREATE OR REPLACE FUNCTION public.set_attachment_deletion_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_compressed = true THEN
        NEW.should_be_deleted_at := now() + interval '6 months';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_set_attachment_deletion_date
BEFORE INSERT ON public.demands_attachments_v2
FOR EACH ROW EXECUTE FUNCTION public.set_attachment_deletion_date();

-- 3. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_demands_store_status ON public.demands_v2(store_id, status) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_demands_assigned ON public.demands_v2(assigned_to) WHERE status IN ('aberta', 'em_andamento', 'pausada');
CREATE INDEX IF NOT EXISTS idx_demands_unread ON public.demands_v2(unread_count) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_demands_priority_created ON public.demands_v2(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_demands_archive_semester ON public.demands_v2(archive_semester);
CREATE INDEX IF NOT EXISTS idx_messages_demand_desc ON public.demands_messages_v2(demand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.demands_notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_attachments_cleanup ON public.demands_attachments_v2(should_be_deleted_at) WHERE is_deleted = false;

-- 4. Row Level Security (RLS)
ALTER TABLE public.demands_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demands_messages_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demands_attachments_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demands_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para demands_v2
CREATE POLICY "Admin vê todas as demandas" ON public.demands_v2
FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "Gerente vê demandas da sua loja" ON public.demands_v2
FOR SELECT USING (store_id IN (SELECT store_id FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "Gerente cria demandas para sua loja" ON public.demands_v2
FOR INSERT WITH CHECK (store_id IN (SELECT store_id FROM public.admin_users WHERE id = auth.uid()));

-- Políticas para demands_messages_v2
CREATE POLICY "Acesso mensagens por demanda" ON public.demands_messages_v2
FOR ALL USING (EXISTS (SELECT 1 FROM public.demands_v2 WHERE id = demands_messages_v2.demand_id));

-- 5. Funções de Manutenção

-- Cleanup Old Attachments (> 6 meses e comprimidos)
CREATE OR REPLACE FUNCTION public.cleanup_old_attachments()
RETURNS void AS $$
BEGIN
    UPDATE public.demands_attachments_v2
    SET is_deleted = true,
        deleted_at = now(),
        file_url = 'DELETED' -- Opcional: remover URL ou manter para log
    WHERE should_be_deleted_at < now()
      AND is_deleted = false;
END;
$$ LANGUAGE plpgsql;

-- Auto Archive Old Demands (Resolvidas > 1 ano)
CREATE OR REPLACE FUNCTION public.auto_archive_old_demands()
RETURNS void AS $$
BEGIN
    UPDATE public.demands_v2
    SET is_archived = true,
        archive_semester = to_char(resolved_at, 'YYYY') || '-S' || CASE WHEN extract(month from resolved_at) <= 6 THEN '1' ELSE '2' END
    WHERE status IN ('resolvida', 'cancelada')
      AND resolved_at < now() - interval '1 year'
      AND is_archived = false;
END;
$$ LANGUAGE plpgsql;

-- 6. View com Estatísticas
CREATE OR REPLACE VIEW public.demands_v2_with_stats AS
SELECT 
    d.*,
    s.name as store_name,
    s.number as store_number,
    u.name as creator_name,
    a.name as assigned_name
FROM public.demands_v2 d
JOIN public.stores s ON d.store_id = s.id
LEFT JOIN public.admin_users u ON d.created_by = u.id
LEFT JOIN public.admin_users a ON d.assigned_to = a.id;
