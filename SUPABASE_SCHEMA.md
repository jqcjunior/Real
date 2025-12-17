
# Estrutura do Banco de Dados - Real Calçados (Supabase / PostgreSQL)

Copie e cole o código abaixo no **SQL Editor** do Supabase para criar toda a estrutura do sistema.

**ATENÇÃO:** Este script configura o banco de dados para acesso PÚBLICO (permissivo) através da chave anônima, pois o sistema utiliza uma autenticação personalizada na tabela `stores` em vez do Auth nativo do Supabase.

---

```sql
-- 1. Habilita UUIDs
create extension if not exists "uuid-ossp";

-- 2. Limpa tabelas antigas se existirem (CUIDADO: APAGA DADOS)
drop table if exists public.system_logs;
drop table if exists public.marketing_downloads;
drop table if exists public.cash_errors;
drop table if exists public.financial_receipts;
drop table if exists public.financial_card_sales;
drop table if exists public.agenda_tasks;
drop table if exists public.cotas;
drop table if exists public.cota_debts;
drop table if exists public.cota_settings;
drop table if exists public.product_performance;
drop table if exists public.monthly_performance;
drop table if exists public.profiles;
drop table if exists public.stores;

-- 3. Criação das Tabelas

-- Lojas
create table public.stores (
  id uuid default uuid_generate_v4() primary key,
  number text not null,
  name text not null,
  city text not null,
  state text default 'BA',
  manager_name text,
  manager_email text,
  manager_phone text,
  password text default '123',
  status text default 'active',
  role text default 'MANAGER', -- ADMIN, MANAGER, CASHIER
  password_reset_requested boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Perfis (Opcional/Legado)
create table public.profiles (
  id uuid primary key, -- Pode ser UUID gerado manualmente ou auth.uid() se migrar
  email text,
  name text,
  role text default 'MANAGER',
  store_id uuid references public.stores(id),
  photo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Metas e Performance
create table public.monthly_performance (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
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
  delinquency_target numeric default 2.0,
  delinquency_actual numeric default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.product_performance (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  month text not null,
  brand text not null,
  category text,
  pairs_sold integer default 0,
  revenue numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Cotas
create table public.cota_settings (
  store_id uuid references public.stores(id) primary key,
  budget_value numeric default 0,
  manager_percent integer default 30,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.cota_debts (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  month text not null,
  value numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.cotas (
  id text primary key, -- Usando text para aceitar IDs gerados no front por enquanto
  store_id uuid references public.stores(id) not null,
  brand text not null,
  classification text,
  total_value numeric not null,
  shipment_date text not null,
  payment_terms text,
  pairs integer,
  installments jsonb,
  status text default 'pending',
  created_by_role text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Operacional
create table public.agenda_tasks (
  id text primary key,
  user_id text not null, -- Aceita ID string do front
  title text not null,
  description text,
  due_date date,
  priority text default 'medium',
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.financial_card_sales (
  id text primary key,
  store_id uuid references public.stores(id),
  user_id text,
  sale_date date not null,
  brand text not null,
  authorization_code text,
  value numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.financial_receipts (
  id text primary key,
  store_id uuid references public.stores(id),
  issuer_name text,
  payer text,
  recipient text,
  value numeric,
  value_in_words text,
  reference text,
  receipt_date date,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.cash_errors (
  id text primary key,
  store_id uuid references public.stores(id),
  user_id text,
  error_date date not null,
  type text not null,
  value numeric not null,
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.marketing_downloads (
  id text primary key,
  title text not null,
  description text,
  category text not null,
  url text not null,
  file_name text,
  file_size text,
  campaign text,
  created_by text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.system_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id text,
  user_name text,
  user_role text,
  action text not null,
  details text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. CONFIGURAÇÃO DE SEGURANÇA (PERMISSIVA PARA APP CLIENT-SIDE)
-- ATENÇÃO: Habilita RLS mas cria políticas públicas para permitir que o app
-- funcione sem login nativo do Supabase Auth.

alter table public.stores enable row level security;
create policy "Public Access" on public.stores for all using (true) with check (true);

alter table public.monthly_performance enable row level security;
create policy "Public Access" on public.monthly_performance for all using (true) with check (true);

alter table public.product_performance enable row level security;
create policy "Public Access" on public.product_performance for all using (true) with check (true);

alter table public.cota_settings enable row level security;
create policy "Public Access" on public.cota_settings for all using (true) with check (true);

alter table public.cota_debts enable row level security;
create policy "Public Access" on public.cota_debts for all using (true) with check (true);

alter table public.cotas enable row level security;
create policy "Public Access" on public.cotas for all using (true) with check (true);

alter table public.agenda_tasks enable row level security;
create policy "Public Access" on public.agenda_tasks for all using (true) with check (true);

alter table public.financial_card_sales enable row level security;
create policy "Public Access" on public.financial_card_sales for all using (true) with check (true);

alter table public.financial_receipts enable row level security;
create policy "Public Access" on public.financial_receipts for all using (true) with check (true);

alter table public.cash_errors enable row level security;
create policy "Public Access" on public.cash_errors for all using (true) with check (true);

alter table public.marketing_downloads enable row level security;
create policy "Public Access" on public.marketing_downloads for all using (true) with check (true);

alter table public.system_logs enable row level security;
create policy "Public Access" on public.system_logs for all using (true) with check (true);
```
