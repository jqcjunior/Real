-- ===============================================================
-- MIGRAÇÃO DE POLÍTICAS RLS - MÓDULO SORVETERIA (REVISADA)
-- ===============================================================

-- ===============================================================
-- 0. FUNÇÕES DE AUTENTICAÇÃO E SESSÃO (PARA RLS CUSTOMIZADO)
-- ===============================================================

-- Função para autenticar usuário e retornar dados básicos
CREATE OR REPLACE FUNCTION public.authenticate_user(p_email text, p_password text)
RETURNS TABLE(user_id uuid, name text, email text, role_level text, store_id uuid, is_valid boolean, error_message text) AS $$
DECLARE
    v_user record;
BEGIN
    -- AUTO-BOOTSTRAP: Se for o email do ambiente e não existir, cria o usuário
    IF lower(p_email) = 'jqcjunior1981@gmail.com' AND NOT EXISTS (SELECT 1 FROM admin_users WHERE lower(email) = 'jqcjunior1981@gmail.com') THEN
        INSERT INTO admin_users (name, email, password, role_level, status)
        VALUES ('Junior (Admin)', 'jqcjunior1981@gmail.com', 'admin', 'admin', 'active');
    END IF;

    SELECT * INTO v_user
    FROM admin_users
    WHERE lower(admin_users.email) = lower(p_email) 
      AND admin_users.password = p_password;

    IF v_user.id IS NULL THEN
        RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::uuid, false, 'E-mail ou senha incorretos.'::text;
    ELSIF v_user.status = 'pending' THEN
        RETURN QUERY SELECT v_user.id, v_user.name, v_user.email, v_user.role_level, v_user.store_id, false, 'Seu acesso ainda está pendente de aprovação.'::text;
    ELSIF v_user.status = 'blocked' THEN
        RETURN QUERY SELECT v_user.id, v_user.name, v_user.email, v_user.role_level, v_user.store_id, false, 'Seu acesso foi bloqueado. Entre em contato com o administrador.'::text;
    ELSIF v_user.status = 'rejected' THEN
        RETURN QUERY SELECT v_user.id, v_user.name, v_user.email, v_user.role_level, v_user.store_id, false, 'Seu acesso foi rejeitado.'::text;
    ELSE
        RETURN QUERY SELECT v_user.id, v_user.name, v_user.email, v_user.role_level, v_user.store_id, true, NULL::text;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para setar o ID do usuário na sessão do Postgres
CREATE OR REPLACE FUNCTION public.set_user_session(user_id uuid) RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para pegar o ID do usuário da sessão de forma resiliente
CREATE OR REPLACE FUNCTION public.get_current_user_id() RETURNS uuid AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::uuid;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 0. GARANTIR QUE admin_users SEJA ACESSÍVEL PARA AS POLÍTICAS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow_Login_Read" ON admin_users;
DROP POLICY IF EXISTS "Admin manage users" ON admin_users;

-- Política para gerenciamento (admins veem tudo, usuários veem a si mesmos)
CREATE POLICY "Admin manage users" ON admin_users FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR id = admin_users.id)
    )
    OR
    NOT EXISTS (SELECT 1 FROM admin_users) -- Permite o primeiro admin
);

-- Garantir permissões básicas para as roles do Supabase
GRANT ALL ON TABLE ice_cream_future_debts TO anon, authenticated;
GRANT ALL ON TABLE admin_users TO anon, authenticated;
GRANT ALL ON TABLE ice_cream_sangria TO anon, authenticated;

-- Função RPC que o sistema parece estar tentando chamar
CREATE OR REPLACE FUNCTION public.update_ice_cream_sangria_admin(
    p_amount numeric,
    p_category_id uuid,
    p_description text,
    p_id uuid,
    p_notes text,
    p_transaction_date date
) RETURNS void AS $$
BEGIN
    UPDATE ice_cream_sangria
    SET amount = p_amount,
        category_id = p_category_id,
        description = p_description,
        notes = p_notes,
        transaction_date = p_transaction_date
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para aprovar usuário
CREATE OR REPLACE FUNCTION public.admin_approve_user(p_user_id uuid)
RETURNS json AS $$
BEGIN
    UPDATE admin_users SET status = 'active' WHERE id = p_user_id;
    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para rejeitar usuário
CREATE OR REPLACE FUNCTION public.admin_reject_user(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS json AS $$
BEGIN
    UPDATE admin_users SET status = 'rejected' WHERE id = p_user_id;
    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. VENDAS (ice_cream_sales)
ALTER TABLE ice_cream_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to sales" ON ice_cream_sales;
DROP POLICY IF EXISTS "Manager can manage store sales" ON ice_cream_sales;
DROP POLICY IF EXISTS "Sorvete can view store sales" ON ice_cream_sales;
DROP POLICY IF EXISTS "Public access to sales" ON ice_cream_sales;

CREATE POLICY "Public access to sales" ON ice_cream_sales FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_sales.store_id)
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_sales.store_id)
    )
);

-- 2. ITENS DE VENDAS (ice_cream_daily_sales)
ALTER TABLE ice_cream_daily_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to daily sales" ON ice_cream_daily_sales;
DROP POLICY IF EXISTS "Manager can manage store daily sales" ON ice_cream_daily_sales;
DROP POLICY IF EXISTS "Sorvete can view store daily sales" ON ice_cream_daily_sales;
DROP POLICY IF EXISTS "Public access to daily sales" ON ice_cream_daily_sales;

CREATE POLICY "Public access to daily sales" ON ice_cream_daily_sales FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_daily_sales.store_id)
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_daily_sales.store_id)
    )
);

-- 3. PAGAMENTOS (ice_cream_daily_sales_payments)
ALTER TABLE ice_cream_daily_sales_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to payments" ON ice_cream_daily_sales_payments;
DROP POLICY IF EXISTS "Manager can manage store payments" ON ice_cream_daily_sales_payments;
DROP POLICY IF EXISTS "Sorvete can view store payments" ON ice_cream_daily_sales_payments;
DROP POLICY IF EXISTS "Public access to payments" ON ice_cream_daily_sales_payments;

CREATE POLICY "Public access to payments" ON ice_cream_daily_sales_payments FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_daily_sales_payments.store_id)
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_daily_sales_payments.store_id)
    )
);

-- 12. DÍVIDAS FUTURAS (ice_cream_future_debts)
ALTER TABLE ice_cream_future_debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to future debts" ON ice_cream_future_debts;
DROP POLICY IF EXISTS "Manager can manage store future debts" ON ice_cream_future_debts;
DROP POLICY IF EXISTS "Public insert for future debts" ON ice_cream_future_debts;

CREATE POLICY "Admin full access to future debts" ON ice_cream_future_debts 
FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_future_debts.store_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_future_debts.store_id)
    )
);

-- 4. PRODUTOS (ice_cream_items)
ALTER TABLE ice_cream_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to products" ON ice_cream_items;
DROP POLICY IF EXISTS "Manager can manage store products" ON ice_cream_items;
DROP POLICY IF EXISTS "Sorvete can view store products" ON ice_cream_items;
DROP POLICY IF EXISTS "Public access to products" ON ice_cream_items;

CREATE POLICY "Public access to products" ON ice_cream_items FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_items.store_id)
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_items.store_id)
    )
);

-- 5. ESTOQUE (ice_cream_stock)
ALTER TABLE ice_cream_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to stock" ON ice_cream_stock;
DROP POLICY IF EXISTS "Manager can manage store stock" ON ice_cream_stock;
DROP POLICY IF EXISTS "Sorvete can view store stock" ON ice_cream_stock;
DROP POLICY IF EXISTS "Public access to stock" ON ice_cream_stock;

CREATE POLICY "Public access to stock" ON ice_cream_stock FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_stock.store_id)
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_stock.store_id)
    )
);

-- 6. MOVIMENTAÇÕES DE ESTOQUE (ice_cream_stock_movements)
ALTER TABLE ice_cream_stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to stock movements" ON ice_cream_stock_movements;
DROP POLICY IF EXISTS "Manager can manage store stock movements" ON ice_cream_stock_movements;
DROP POLICY IF EXISTS "Sorvete can view store stock movements" ON ice_cream_stock_movements;
DROP POLICY IF EXISTS "Public access to stock movements" ON ice_cream_stock_movements;

CREATE POLICY "Public access to stock movements" ON ice_cream_stock_movements FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_stock_movements.store_id)
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_stock_movements.store_id)
    )
);

-- 7. SANGRIAS (ice_cream_sangria)
ALTER TABLE ice_cream_sangria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to sangrias" ON ice_cream_sangria;
DROP POLICY IF EXISTS "Manager can manage store sangrias" ON ice_cream_sangria;
DROP POLICY IF EXISTS "Public access to sangrias" ON ice_cream_sangria;

CREATE POLICY "Public access to sangrias" ON ice_cream_sangria FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_sangria.store_id)
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_sangria.store_id)
    )
);

-- 8. CATEGORIAS DE SANGRIAS (ice_cream_sangria_categoria)
ALTER TABLE ice_cream_sangria_categoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to sangria categories" ON ice_cream_sangria_categoria;
DROP POLICY IF EXISTS "Manager can manage store sangria categories" ON ice_cream_sangria_categoria;
DROP POLICY IF EXISTS "Public access to sangria categories" ON ice_cream_sangria_categoria;

CREATE POLICY "Public access to sangria categories" ON ice_cream_sangria_categoria FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_sangria_categoria.store_id)
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_sangria_categoria.store_id)
    )
);

-- 9. PARTILHA DE LUCROS (store_profit_distribution)
ALTER TABLE store_profit_distribution ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to partners" ON store_profit_distribution;
DROP POLICY IF EXISTS "Manager can manage store partners" ON store_profit_distribution;

CREATE POLICY "Public access to partners" ON store_profit_distribution FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = store_profit_distribution.store_id)
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = store_profit_distribution.store_id)
    )
);

-- 10. COMPRAS (ice_cream_purchases)
ALTER TABLE ice_cream_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to purchases" ON ice_cream_purchases;
DROP POLICY IF EXISTS "Manager can manage store purchases" ON ice_cream_purchases;

CREATE POLICY "Public access to purchases" ON ice_cream_purchases FOR ALL TO public 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_purchases.store_id)
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE id = get_current_user_id() 
        AND (role_level = 'admin' OR store_id = ice_cream_purchases.store_id)
    )
);

-- 11. OUTRAS TABELAS FINANCEIRAS E DE GESTÃO
ALTER TABLE financial_card_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to card sales" ON financial_card_sales FOR ALL TO public 
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = get_current_user_id() AND (role_level = 'admin' OR store_id = financial_card_sales.store_id)));

ALTER TABLE financial_pix_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to pix sales" ON financial_pix_sales FOR ALL TO public 
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = get_current_user_id() AND (role_level = 'admin' OR store_id = financial_pix_sales.store_id)));

ALTER TABLE cash_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to cash errors" ON cash_errors FOR ALL TO public 
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = get_current_user_id() AND (role_level = 'admin' OR store_id = cash_errors.store_id)));

ALTER TABLE cash_register_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to closures" ON cash_register_closures FOR ALL TO public 
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = get_current_user_id() AND (role_level = 'admin' OR store_id = cash_register_closures.store_id)));

ALTER TABLE gestao_compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to gestao compras" ON gestao_compras FOR ALL TO public 
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = get_current_user_id() AND (role_level = 'admin' OR store_id = gestao_compras.store_id)));

ALTER TABLE monthly_performance_actual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to performance" ON monthly_performance_actual FOR ALL TO public 
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = get_current_user_id() AND (role_level = 'admin' OR store_id = monthly_performance_actual.store_id)));

ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to goals" ON monthly_goals FOR ALL TO public 
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = get_current_user_id() AND (role_level = 'admin' OR store_id = monthly_goals.store_id)));

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to stores" ON stores;
CREATE POLICY "Public access to stores" ON stores FOR ALL TO public 
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = get_current_user_id() AND (role_level = 'admin' OR store_id = stores.id)));

-- 13. PERMISSÕES DE PÁGINA (page_permissions)
ALTER TABLE page_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access for permissions" ON page_permissions;
CREATE POLICY "Public read access for permissions" ON page_permissions FOR SELECT TO public USING (true);
CREATE POLICY "Admin manage permissions" ON page_permissions FOR ALL TO public 
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = get_current_user_id() AND role_level = 'admin'));
