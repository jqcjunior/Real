-- ADMIN: Acesso total
INSERT INTO page_permissions (user_id, page_id, can_view_all_stores, allowed_store_ids)
SELECT 
  id,
  'cotas_compra',
  true,
  NULL
FROM admin_users
WHERE role = 'ADMIN'
ON CONFLICT (user_id, page_id) DO UPDATE
SET can_view_all_stores = true;

-- GERENTES: Acesso apenas à sua loja
INSERT INTO page_permissions (user_id, page_id, can_view_all_stores, allowed_store_ids)
SELECT 
  au.id,
  'cotas_compra',
  false,
  ARRAY[s.id]::UUID[]
FROM admin_users au
JOIN stores s ON s.number = au.store_id
WHERE au.role = 'GERENTE'
ON CONFLICT (user_id, page_id) DO UPDATE
SET 
  can_view_all_stores = false,
  allowed_store_ids = EXCLUDED.allowed_store_ids;
