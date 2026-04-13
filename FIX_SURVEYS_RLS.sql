-- FIX: Row Level Security (RLS) for Surveys Module
-- This migration simplifies the policies and ensures the admin role has the necessary permissions.

-- 1. Grant permissions to anon and authenticated roles
GRANT ALL ON TABLE public.surveys TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.survey_questions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.survey_responses TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.survey_answer_details TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.survey_invitations TO anon, authenticated, service_role;

-- 2. Update surveys policies
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin Full Access Surveys" ON public.surveys;
DROP POLICY IF EXISTS "Users View Surveys" ON public.surveys;

CREATE POLICY "surveys_admin_policy" ON public.surveys
FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = public.get_current_user_id() 
        AND lower(role_level) = 'admin'
    )
    OR public.get_current_user_id() IS NULL
)
WITH CHECK (true);

-- 3. Update survey_questions policies
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin Full Access Questions" ON public.survey_questions;
DROP POLICY IF EXISTS "Users View Questions" ON public.survey_questions;

CREATE POLICY "survey_questions_admin_policy" ON public.survey_questions
FOR ALL TO public 
USING (true)
WITH CHECK (true);

-- 4. Update survey_responses policies
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin Full Access Responses" ON public.survey_responses;
DROP POLICY IF EXISTS "Users Insert Responses" ON public.survey_responses;

CREATE POLICY "survey_responses_all_policy" ON public.survey_responses
FOR ALL TO public 
USING (true)
WITH CHECK (true);

-- 5. Update survey_answer_details policies
ALTER TABLE public.survey_answer_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin Full Access Details" ON public.survey_answer_details;
DROP POLICY IF EXISTS "Users Insert Details" ON public.survey_answer_details;

CREATE POLICY "survey_answer_details_all_policy" ON public.survey_answer_details
FOR ALL TO public 
USING (true)
WITH CHECK (true);

-- 6. Update survey_invitations policies
ALTER TABLE public.survey_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin Full Access Invitations" ON public.survey_invitations;

CREATE POLICY "survey_invitations_all_policy" ON public.survey_invitations
FOR ALL TO public 
USING (true)
WITH CHECK (true);
