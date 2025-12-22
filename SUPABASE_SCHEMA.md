
# Estrutura de Banco de Dados Idempotente - Real Calçados

Copie e cole os blocos abaixo no SQL Editor do Supabase. Esta versão utiliza `ON CONFLICT` para evitar erros caso você execute o script novamente.

---

### 1. Tabelas Base e Extensões
```sql
create extension if not exists "uuid-ossp";

create table if not exists public.stores (
  id uuid default uuid_generate_v4() primary key,
  number text unique not null,
  name text not null,
  city text not null,
  manager_name text,
  manager_email text unique,
  manager_phone text,
  password text,
  status text default 'active',
  role text default 'MANAGER',
  password_reset_requested boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.admin_users (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  email text unique not null,
  password text not null,
  status text default 'active',
  role_level text default 'admin',
  last_activity timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.page_permissions (
  id uuid default uuid_generate_v4() primary key,
  page_key text unique not null,
  label text not null,
  module_group text not null,
  icon_name text,
  allow_admin boolean default true,
  allow_manager boolean default false,
  allow_cashier boolean default false,
  sort_order integer default 0
);
```

---

### 2. Módulos de Operação (Metas, Cotas, Sorvete)
```sql
create table if not exists public.monthly_performance (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) on delete cascade,
  month text not null,
  revenue_target numeric default 0,
  revenue_actual numeric default 0,
  items_target integer default 0,
  items_actual integer default 0,
  pa_target numeric default 0,
  pa_actual numeric default 0,
  ticket_target numeric default 0,
  ticket_actual numeric default 0,
  pu_target numeric default 0,
  pu_actual numeric default 0,
  delinquency_target numeric default 0,
  delinquency_actual numeric default 0,
  created_at timestamp with time zone default now(),
  unique(store_id, month)
);

create table if not exists public.cota_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  budget_value numeric not null default 0,
  manager_percent numeric not null default 30,
  updated_at timestamp with time zone default now()
);

create table if not exists public.cota_debts (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) on delete cascade,
  month text not null,
  value numeric not null default 0,
  created_at timestamp with time zone default now(),
  unique(store_id, month)
);

create table if not exists public.cotas (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) on delete cascade,
  brand text not null,
  classification text,
  total_value numeric not null,
  shipment_date text not null,
  payment_terms text,
  pairs integer default 0,
  installments jsonb not null,
  created_by_role text,
  status text default 'pending',
  created_at timestamp with time zone default now()
);
```

---

### 3. Dados Iniciais (Seguro contra Duplicidade)
```sql
-- Inserir permissões apenas se não existirem
insert into public.page_permissions (page_key, label, module_group, allow_admin, allow_manager, allow_cashier, sort_order)
values 
('dashboard', 'Dashboard Principal', 'Inteligência', true, true, false, 1),
('metas_registration', 'Definição de Metas', 'Inteligência', true, false, false, 2),
('cotas', 'Gestão de Cotas', 'Operação', true, true, false, 3),
('icecream', 'Gelateria', 'Operação', true, true, true, 4)
on conflict (page_key) do nothing;

-- Inserir administrador padrão apenas se não existir
insert into public.admin_users (name, email, password, role_level)
values ('Administrador', 'admin@real.com', 'admin123', 'super_admin')
on conflict (email) do nothing;
```
