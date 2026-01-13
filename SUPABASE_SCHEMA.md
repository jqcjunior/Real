
# Estrutura de Banco de Dados Idempotente - Real Calçados

Copie e cole os blocos abaixo no SQL Editor do Supabase para garantir que o sistema de menus e permissões funcione corretamente.

---

### 1. Configuração de Permissões de Páginas (Navegação)

```sql
-- Limpeza segura para reconstrução (OPCIONAL - use se os menus estiverem duplicados)
-- truncate table public.page_permissions;

-- Tabela de Permissões (se não existir)
create table if not exists public.page_permissions (
  id uuid default uuid_generate_v4() primary key,
  page_key text unique not null,
  label text not null,
  module_group text not null,
  allow_admin boolean default true,
  allow_manager boolean default false,
  allow_cashier boolean default false,
  sort_order integer default 100,
  created_at timestamp with time zone default now()
);

-- Inserção das Rotas Funcionais
insert into public.page_permissions (page_key, label, module_group, allow_admin, allow_manager, allow_cashier, sort_order)
values 
  ('dashboard', 'Dashboard Performance', 'Inteligência', true, true, false, 10),
  ('metas_registration', 'Registro de Metas', 'Inteligência', true, false, false, 20),
  ('purchases', 'Gestão de Compras', 'Inteligência', true, true, false, 30),
  ('cotas', 'Gestão de Cotas', 'Inteligência', true, true, false, 40),
  
  ('icecream', 'PDV Gelateria', 'Operação', true, true, true, 50),
  ('cash_register', 'Fechamento de Caixa', 'Operação', true, true, true, 60),
  ('financial', 'Financeiro / Recibos', 'Operação', true, true, true, 70),
  ('cash_errors', 'Quebras de Caixa', 'Operação', true, false, true, 80),
  ('agenda', 'Minha Agenda', 'Operação', true, true, true, 90),
  
  ('marketing', 'Studio Real Marketing', 'Marketing', true, true, false, 100),
  
  ('downloads', 'Central Downloads', 'Documentos', true, true, true, 110),
  ('auth_print', 'Autoriz. de Compra', 'Documentos', true, true, true, 120),
  ('termo_print', 'Termo Condicional', 'Documentos', true, true, true, 130),
  
  ('admin_users', 'Gestão de Usuários', 'Administração', true, false, false, 140),
  ('access_control', 'Controle de Acessos', 'Administração', true, false, false, 150),
  ('audit', 'Auditoria de Logs', 'Administração', true, false, false, 160),
  ('settings', 'Configurações', 'Administração', true, false, false, 170)
on conflict (page_key) do update set
  label = excluded.label,
  module_group = excluded.module_group,
  sort_order = excluded.sort_order;
```

### 2. Tabelas da Gelateria (Gestão de Estoque e Vendas)
```sql
-- Tabela de Estoque (Bases de Consumo)
create table if not exists public.ice_cream_stock (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  product_base text not null,
  stock_initial numeric default 0,
  stock_current numeric default 0,
  unit text default 'un',
  created_at timestamp with time zone default now(),
  unique(store_id, product_base)
);

-- Tabela de Itens (Catálogo Comercial)
create table if not exists public.ice_cream_items (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  name text not null,
  category text not null,
  price numeric not null,
  flavor text,
  active boolean default true,
  consumption_per_sale numeric default 1,
  created_at timestamp with time zone default now()
);

-- Tabela de Vendas (PDV)
create table if not exists public.ice_cream_daily_sales (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  item_id uuid references public.ice_cream_items(id),
  product_name text not null,
  category text not null,
  flavor text,
  units_sold integer not null,
  unit_price numeric not null,
  total_value numeric not null,
  payment_method text not null,
  sale_code text,
  status text default 'active',
  cancel_reason text,
  canceled_by text,
  created_at timestamp with time zone default now()
);
```
