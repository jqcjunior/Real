-- ===============================================================
-- MIGRAÇÃO DE POLÍTICAS RLS - MÓDULO SORVETERIA
-- ===============================================================

-- 1. VENDAS (ice_cream_sales)
ALTER TABLE ice_cream_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to sales" ON ice_cream_sales;
DROP POLICY IF EXISTS "Manager can manage store sales" ON ice_cream_sales;
DROP POLICY IF EXISTS "Sorvete can view store sales" ON ice_cream_sales;

CREATE POLICY "Admin full access to sales" ON ice_cream_sales FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store sales" ON ice_cream_sales FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_sales.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_sales.store_id));
CREATE POLICY "Sorvete can view store sales" ON ice_cream_sales FOR SELECT TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'sorvete' AND admin_users.store_id = ice_cream_sales.store_id));

-- 2. ITENS DE VENDAS (ice_cream_daily_sales)
ALTER TABLE ice_cream_daily_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to daily sales" ON ice_cream_daily_sales;
DROP POLICY IF EXISTS "Manager can manage store daily sales" ON ice_cream_daily_sales;
DROP POLICY IF EXISTS "Sorvete can view store daily sales" ON ice_cream_daily_sales;

CREATE POLICY "Admin full access to daily sales" ON ice_cream_daily_sales FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store daily sales" ON ice_cream_daily_sales FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_daily_sales.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_daily_sales.store_id));
CREATE POLICY "Sorvete can view store daily sales" ON ice_cream_daily_sales FOR SELECT TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'sorvete' AND admin_users.store_id = ice_cream_daily_sales.store_id));

-- 3. PAGAMENTOS (ice_cream_daily_sales_payments)
ALTER TABLE ice_cream_daily_sales_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to payments" ON ice_cream_daily_sales_payments;
DROP POLICY IF EXISTS "Manager can manage store payments" ON ice_cream_daily_sales_payments;
DROP POLICY IF EXISTS "Sorvete can view store payments" ON ice_cream_daily_sales_payments;

CREATE POLICY "Admin full access to payments" ON ice_cream_daily_sales_payments FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store payments" ON ice_cream_daily_sales_payments FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_daily_sales_payments.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_daily_sales_payments.store_id));
CREATE POLICY "Sorvete can view store payments" ON ice_cream_daily_sales_payments FOR SELECT TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'sorvete' AND admin_users.store_id = ice_cream_daily_sales_payments.store_id));

-- 4. PRODUTOS (ice_cream_products)
ALTER TABLE ice_cream_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to products" ON ice_cream_products;
DROP POLICY IF EXISTS "Manager can manage store products" ON ice_cream_products;

CREATE POLICY "Admin full access to products" ON ice_cream_products FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store products" ON ice_cream_products FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_products.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_products.store_id));

-- 5. ESTOQUE (ice_cream_stock_items)
ALTER TABLE ice_cream_stock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to stock" ON ice_cream_stock_items;
DROP POLICY IF EXISTS "Manager can manage store stock" ON ice_cream_stock_items;
DROP POLICY IF EXISTS "Sorvete can view store stock" ON ice_cream_stock_items;

CREATE POLICY "Admin full access to stock" ON ice_cream_stock_items FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store stock" ON ice_cream_stock_items FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_stock_items.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_stock_items.store_id));
CREATE POLICY "Sorvete can view store stock" ON ice_cream_stock_items FOR SELECT TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'sorvete' AND admin_users.store_id = ice_cream_stock_items.store_id));

-- 6. MOVIMENTAÇÕES DE ESTOQUE (ice_cream_stock_movements)
ALTER TABLE ice_cream_stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to stock movements" ON ice_cream_stock_movements;
DROP POLICY IF EXISTS "Manager can manage store stock movements" ON ice_cream_stock_movements;
DROP POLICY IF EXISTS "Sorvete can view store stock movements" ON ice_cream_stock_movements;

CREATE POLICY "Admin full access to stock movements" ON ice_cream_stock_movements FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store stock movements" ON ice_cream_stock_movements FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_stock_movements.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_stock_movements.store_id));
CREATE POLICY "Sorvete can view store stock movements" ON ice_cream_stock_movements FOR SELECT TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'sorvete' AND admin_users.store_id = ice_cream_stock_movements.store_id));

-- 7. SANGRIAS (ice_cream_sangria)
ALTER TABLE ice_cream_sangria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to sangrias" ON ice_cream_sangria;
DROP POLICY IF EXISTS "Manager can manage store sangrias" ON ice_cream_sangria;

CREATE POLICY "Admin full access to sangrias" ON ice_cream_sangria FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store sangrias" ON ice_cream_sangria FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_sangria.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_sangria.store_id));

-- 8. CATEGORIAS DE SANGRIAS (ice_cream_sangria_categories)
ALTER TABLE ice_cream_sangria_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to sangria categories" ON ice_cream_sangria_categories;
DROP POLICY IF EXISTS "Manager can manage store sangria categories" ON ice_cream_sangria_categories;

CREATE POLICY "Admin full access to sangria categories" ON ice_cream_sangria_categories FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store sangria categories" ON ice_cream_sangria_categories FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_sangria_categories.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_sangria_categories.store_id));

-- 9. PARTILHA DE LUCROS (store_profit_distribution)
ALTER TABLE store_profit_distribution ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to partners" ON store_profit_distribution;
DROP POLICY IF EXISTS "Manager can manage store partners" ON store_profit_distribution;

CREATE POLICY "Admin full access to partners" ON store_profit_distribution FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store partners" ON store_profit_distribution FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = store_profit_distribution.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = store_profit_distribution.store_id));

-- 10. COMPRAS (ice_cream_purchases)
ALTER TABLE ice_cream_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to purchases" ON ice_cream_purchases;
DROP POLICY IF EXISTS "Manager can manage store purchases" ON ice_cream_purchases;

CREATE POLICY "Admin full access to purchases" ON ice_cream_purchases FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store purchases" ON ice_cream_purchases FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_purchases.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_purchases.store_id));

-- 11. AVARIAS (ice_cream_wastage)
ALTER TABLE ice_cream_wastage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to wastage" ON ice_cream_wastage;
DROP POLICY IF EXISTS "Manager can manage store wastage" ON ice_cream_wastage;

CREATE POLICY "Admin full access to wastage" ON ice_cream_wastage FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store wastage" ON ice_cream_wastage FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_wastage.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_wastage.store_id));

-- 12. DÍVIDAS FUTURAS (ice_cream_future_debts)
ALTER TABLE ice_cream_future_debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to future debts" ON ice_cream_future_debts;
DROP POLICY IF EXISTS "Manager can manage store future debts" ON ice_cream_future_debts;

CREATE POLICY "Admin full access to future debts" ON ice_cream_future_debts FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'admin'));
CREATE POLICY "Manager can manage store future debts" ON ice_cream_future_debts FOR ALL TO public USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_future_debts.store_id)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid() AND admin_users.role_level = 'manager' AND admin_users.store_id = ice_cream_future_debts.store_id));
