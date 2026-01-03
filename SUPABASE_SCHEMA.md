
# Estrutura de Banco de Dados Idempotente - Real Calçados

Copie e cole os blocos abaixo no SQL Editor do Supabase para garantir que o PDV funcione corretamente.

---

### 1. Tabelas de Vendas e Finanças (Gelateria)
```sql
-- Atualização Crítica: Adição de Colunas para Rastreamento e Status
ALTER TABLE public.ice_cream_daily_sales
ADD COLUMN IF NOT EXISTS sale_code TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
ADD COLUMN IF NOT EXISTS canceled_by TEXT;

-- Tabela de Vendas (Caso ainda não exista)
create table if not exists public.ice_cream_daily_sales (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references public.ice_cream_items(id),
  product_name text not null,
  category text not null,
  flavor text,
  ml text,
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

-- Tabela de Finanças/Despesas
create table if not exists public.ice_cream_finances (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  type text not null, -- 'entry', 'exit'
  category text not null,
  value numeric not null,
  employee_name text,
  description text,
  created_at timestamp with time zone default now()
);
```

### 2. Tabelas Base (Lojas e Permissões)
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
