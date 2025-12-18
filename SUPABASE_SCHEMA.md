
# Estrutura do Banco de Dados - Real Calçados

Para garantir o funcionamento do sistema de metas e do módulo de sorvete, execute os comandos SQL abaixo no seu painel do Supabase.

---

### 1. Tabela de Performance e Metas
```sql
-- Tabela principal de faturamento e metas mensais
create table if not exists public.monthly_performance (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) on delete cascade,
  month text not null, -- Formato YYYY-MM
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
  
  -- Garante que não haja duplicidade de mês para a mesma loja
  unique(store_id, month)
);

-- Habilitar RLS e acesso público
alter table public.monthly_performance enable row level security;
create policy "Public Access Goals" on public.monthly_performance for all using (true) with check (true);
```

---

### 2. Módulo Sorvete
```sql
-- Cadastro de Produtos
create table if not exists public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  category text not null,
  flavor text,
  price numeric not null,
  active boolean default true,
  created_at timestamp with time zone default now()
);

-- Vendas Diárias
create table if not exists public.ice_cream_daily_sales (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references public.products(id),
  product_name text not null,
  category text,
  flavor text,
  units_sold integer not null default 0,
  unit_price numeric not null,
  total_value numeric not null,
  payment_method text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Finanças
create table if not exists public.ice_cream_finances (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  type text not null, -- entry, exit
  category text not null,
  value numeric not null default 0,
  employee_name text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

---

### 3. Materiais de Marketing (NOVO)
```sql
-- Galeria de artes e materiais de campanha
create table if not exists public.marketing_materials (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  image_url text not null,
  category text default 'social_media', -- social_media, internal_comms, promo
  created_by uuid references public.admin_users(id),
  store_id uuid references public.stores(id),
  metadata jsonb, -- detalhes da geração ou ajustes
  created_at timestamp with time zone default now()
);

alter table public.marketing_materials enable row level security;
create policy "Public Access Marketing" on public.marketing_materials for all using (true) with check (true);
```
