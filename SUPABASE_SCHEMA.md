
# Estrutura do Banco de Dados - Real Calçados (Supabase / PostgreSQL)

Copie e cole o código abaixo no **SQL Editor** do Supabase para criar toda a estrutura do sistema.

## 1. Tabelas Principais (Stores & Profiles)

```sql
-- Habilita UUIDs
create extension if not exists "uuid-ossp";

-- Tabela de Lojas
create table public.stores (
  id uuid default uuid_generate_v4() primary key,
  number text not null, -- Ex: "1", "2"
  name text not null,
  city text not null,
  state text default 'BA',
  manager_name text,
  manager_email text,
  manager_phone text,
  status text default 'active', -- active, inactive, pending
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabela de Perfis de Usuário (Vinculada ao Auth do Supabase)
-- Nota: O ID aqui deve ser o mesmo ID da tabela auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  role text not null default 'MANAGER', -- ADMIN, MANAGER, CASHIER
  store_id uuid references public.stores(id),
  photo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

## 2. Performance e Metas

```sql
-- Metas Mensais e Resultados
create table public.monthly_performance (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  month text not null, -- Formato: "YYYY-MM"
  
  -- Metas (Financeiro)
  revenue_target numeric default 0,
  revenue_actual numeric default 0,
  
  -- Metas (Físico)
  items_target integer default 0,
  items_actual integer default 0,
  
  -- KPIs (Alvos e Realizados)
  pa_target numeric default 0,
  pa_actual numeric default 0, -- items_per_ticket
  ticket_target numeric default 0,
  ticket_actual numeric default 0, -- average_ticket
  pu_target numeric default 0,
  pu_actual numeric default 0, -- unit_price_average
  delinquency_target numeric default 2.0,
  delinquency_actual numeric default 0,
  
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Performance de Produtos (Marcas/Categorias)
create table public.product_performance (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  month text not null, -- Formato: "YYYY-MM"
  brand text not null,
  category text,
  pairs_sold integer default 0,
  revenue numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

## 3. Gestão de Cotas (Compras)

```sql
-- Configuração de Orçamento por Loja
create table public.cota_settings (
  store_id uuid references public.stores(id) primary key,
  budget_value numeric default 0,
  manager_percent integer default 30, -- Ex: 30% para o gerente
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Dívidas / Previsão de Saída (Passivo)
create table public.cota_debts (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  month text not null, -- "YYYY-MM"
  value numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Pedidos / Cotas Lançadas
create table public.cotas (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  brand text not null,
  classification text, -- Ex: "Feminino - Sandália"
  total_value numeric not null,
  shipment_date text not null, -- "YYYY-MM"
  payment_terms text, -- "30/60/90"
  pairs integer,
  
  -- Armazena as parcelas como JSON para flexibilidade
  -- Ex: [{"month": "2023-11", "value": 1000}, {"month": "2023-12", "value": 1000}]
  installments jsonb, 
  
  status text default 'pending', -- pending, validated
  created_by_role text, -- ADMIN ou MANAGER
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

## 4. Operacional e Financeiro

```sql
-- Agenda de Tarefas
create table public.agenda_tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  description text,
  due_date date,
  priority text default 'medium',
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Vendas em Cartão
create table public.financial_card_sales (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id),
  user_id uuid references public.profiles(id),
  sale_date date not null,
  brand text not null, -- Visa, Master, etc
  authorization_code text,
  value numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Recibos Emitidos
create table public.financial_receipts (
  id uuid default uuid_generate_v4() primary key,
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

-- Quebra de Caixa (Erros)
create table public.cash_errors (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id),
  user_id uuid references public.profiles(id),
  error_date date not null,
  type text not null, -- surplus (sobra) ou shortage (falta)
  value numeric not null,
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

## 5. Marketing e Sistema

```sql
-- Central de Downloads
create table public.marketing_downloads (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  category text not null, -- spreadsheet, video, image, audio
  url text not null,
  file_name text,
  file_size text,
  campaign text,
  created_by text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Logs do Sistema (Auditoria)
create table public.system_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  user_name text, -- Cache do nome para facilitar leitura
  user_role text,
  action text not null,
  details text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

## 6. Configuração de Segurança (Row Level Security - RLS)

Recomendado ativar RLS para que:
1. Gerentes vejam apenas dados da `store_id` vinculada ao perfil deles.
2. Admins vejam tudo.

Exemplo de política RLS para a tabela `monthly_performance`:

```sql
alter table public.monthly_performance enable row level security;

create policy "Admins veem tudo" on public.monthly_performance
for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);

create policy "Gerentes veem sua loja" on public.monthly_performance
for all using (
  store_id = (select store_id from public.profiles where id = auth.uid())
);
```
