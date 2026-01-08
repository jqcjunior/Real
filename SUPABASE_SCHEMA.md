
# Estrutura de Banco de Dados Idempotente - Real Calçados

Copie e cole os blocos abaixo no SQL Editor do Supabase para garantir que o sistema funcione corretamente.

---

### 1. Tabelas da Gelateria (Gestão Profissional de Estoque e PDV)

```sql
-- Tabela de Estoque (Bases de Consumo)
-- Regra: Itens do catálogo como "Casquinha Baunilha" e "Casquinha Mista" 
-- apontam para a base "Casquinha" nesta tabela.
create table if not exists public.ice_cream_stock (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  product_base text not null, -- Ex: "Casquinha", "Sundae", "Milkshake"
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
  category text not null, -- Deve corresponder ao product_base no ice_cream_stock
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

-- Tabela de Finanças (Despesas da Unidade)
create table if not exists public.ice_cream_finances (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) not null,
  date date not null,
  type text not null, -- 'entry', 'exit'
  category text not null,
  value numeric not null,
  employee_name text,
  description text,
  created_at timestamp with time zone default now()
);
```

### 2. Tabelas Base e Auditoria
```sql
-- Auditoria de Sistema
create table if not exists public.system_logs (
  id uuid default uuid_generate_v4() primary key,
  userId uuid,
  userName text,
  userRole text,
  action text,
  details text,
  created_at timestamp with time zone default now()
);
```
