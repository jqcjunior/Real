
-- ===============================================================
-- SISTEMA AVANÇADO DE DIRECIONAMENTO DE PESQUISAS
-- ===============================================================

-- 1. Tabela de Pesquisas
CREATE TABLE IF NOT EXISTS public.surveys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    target_type TEXT NOT NULL CHECK (target_type IN ('internal', 'external')),
    target_category TEXT CHECK (target_category IN ('all_managers', 'all_cashiers', 'all_sellers', 'all_ice_cream', 'specific_stores', 'specific_users')),
    target_store_ids UUID[] DEFAULT '{}', -- NULL ou vazio = todas as lojas (se aplicável)
    target_user_ids UUID[] DEFAULT '{}',  -- Para usuários específicos
    results_visible_to TEXT[] DEFAULT '{admin}', -- ['admin', 'store_manager', 'respondent']
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Perguntas
CREATE TABLE IF NOT EXISTS public.survey_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('text', 'rating', 'multiple_choice', 'boolean')),
    options JSONB DEFAULT '[]', -- Para múltipla escolha
    is_required BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Respostas (Cabeçalho)
CREATE TABLE IF NOT EXISTS public.survey_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.admin_users(id), -- Para pesquisas internas
    invitation_id UUID, -- Para pesquisas externas (referência à survey_invitations)
    store_id UUID REFERENCES public.stores(id), -- Loja de referência
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Detalhes das Respostas
CREATE TABLE IF NOT EXISTS public.survey_answer_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    response_id UUID REFERENCES public.survey_responses(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.survey_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Convites para Pesquisas Externas
CREATE TABLE IF NOT EXISTS public.survey_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    invitation_token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'responded', 'expired')),
    sent_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_answer_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_invitations ENABLE ROW LEVEL SECURITY;

-- Políticas Básicas (Admin tem acesso total)
CREATE POLICY "Admin Full Access Surveys" ON public.surveys FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role_level = 'admin')
);

CREATE POLICY "Admin Full Access Questions" ON public.survey_questions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role_level = 'admin')
);

CREATE POLICY "Admin Full Access Responses" ON public.survey_responses FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role_level = 'admin')
);

CREATE POLICY "Admin Full Access Details" ON public.survey_answer_details FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role_level = 'admin')
);

CREATE POLICY "Admin Full Access Invitations" ON public.survey_invitations FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role_level = 'admin')
);

-- Funções de Segurança e Validação

-- Valida se um usuário pode VER uma pesquisa
CREATE OR REPLACE FUNCTION public.can_user_see_survey(
    p_survey_id UUID,
    p_user_id UUID,
    p_role_level TEXT,
    p_store_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_survey RECORD;
BEGIN
    SELECT * INTO v_survey FROM public.surveys WHERE id = p_survey_id;
    
    IF NOT FOUND THEN RETURN FALSE; END IF;
    
    -- Admin sempre vê
    IF p_role_level = 'admin' THEN RETURN TRUE; END IF;
    
    -- Se a pesquisa não estiver ativa, ninguém (exceto admin) vê
    IF NOT v_survey.is_active THEN RETURN FALSE; END IF;

    -- Pesquisas Externas não são visíveis internamente para resposta (exceto admin)
    IF v_survey.target_type = 'external' THEN RETURN FALSE; END IF;

    -- Lógica de Categoria
    CASE v_survey.target_category
        WHEN 'all_managers' THEN
            IF p_role_level != 'manager' THEN RETURN FALSE; END IF;
        WHEN 'all_cashiers' THEN
            IF p_role_level != 'cashier' THEN RETURN FALSE; END IF;
        WHEN 'all_sellers' THEN
            IF p_role_level != 'seller' THEN RETURN FALSE; END IF;
        WHEN 'all_ice_cream' THEN
            IF p_role_level != 'sorvete' THEN RETURN FALSE; END IF;
        WHEN 'specific_users' THEN
            IF NOT (p_user_id = ANY(v_survey.target_user_ids)) THEN RETURN FALSE; END IF;
        WHEN 'specific_stores' THEN
            IF NOT (p_store_id = ANY(v_survey.target_store_ids)) THEN RETURN FALSE; END IF;
    END CASE;

    -- Filtro de Lojas (se aplicável e não for 'specific_stores' que já checou)
    IF v_survey.target_category IN ('all_managers', 'all_cashiers', 'all_sellers', 'all_ice_cream') THEN
        IF v_survey.target_store_ids IS NOT NULL AND array_length(v_survey.target_store_ids, 1) > 0 THEN
            IF NOT (p_store_id = ANY(v_survey.target_store_ids)) THEN RETURN FALSE; END IF;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Valida se um usuário pode ver RESULTADOS
CREATE OR REPLACE FUNCTION public.can_user_see_results(
    p_survey_id UUID,
    p_user_id UUID,
    p_role_level TEXT,
    p_store_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_survey RECORD;
BEGIN
    SELECT * INTO v_survey FROM public.surveys WHERE id = p_survey_id;
    
    IF NOT FOUND THEN RETURN FALSE; END IF;
    
    -- Admin sempre vê tudo
    IF p_role_level = 'admin' THEN RETURN TRUE; END IF;
    
    -- Gerente da Loja vê se permitido
    IF p_role_level = 'manager' AND 'store_manager' = ANY(v_survey.results_visible_to) THEN
        -- Deve ser da loja alvo ou a pesquisa ser global
        IF v_survey.target_store_ids IS NULL OR array_length(v_survey.target_store_ids, 1) = 0 THEN
            RETURN TRUE;
        ELSIF p_store_id = ANY(v_survey.target_store_ids) THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Respondente vê se permitido (futuro)
    IF 'respondent' = ANY(v_survey.results_visible_to) THEN
        -- Aqui precisaria checar se o p_user_id já respondeu
        -- Por enquanto retornamos false pois exige lógica mais complexa de join
        RETURN FALSE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas de Visualização para Usuários
CREATE POLICY "Users Read Targeted Surveys" ON public.surveys FOR SELECT USING (
    public.can_user_see_survey(id, auth.uid(), 
        (SELECT role_level FROM public.admin_users WHERE id = auth.uid()),
        (SELECT store_id FROM public.admin_users WHERE id = auth.uid())
    )
);

CREATE POLICY "Users Read Targeted Questions" ON public.survey_questions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.surveys 
        WHERE id = survey_questions.survey_id 
        AND public.can_user_see_survey(id, auth.uid(), 
            (SELECT role_level FROM public.admin_users WHERE id = auth.uid()),
            (SELECT store_id FROM public.admin_users WHERE id = auth.uid())
        )
    )
);
