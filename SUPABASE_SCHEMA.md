# Estrutura de Banco de Dados - Real Calçados

Execute os blocos abaixo no **SQL Editor** do Supabase para garantir a compatibilidade com as novas funcionalidades.

---

### 1. Migração de Usuários e Vínculo de Unidades
```sql
-- Adiciona a coluna de vínculo com a loja (ID da Unidade)
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

-- Adiciona a coluna de nível de papel (Role Level) para hierarquia
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS role_level text DEFAULT 'admin';

-- Recarrega o cache do PostgREST para reconhecer as novas colunas imediatamente
NOTIFY pgrst, 'reload schema';
```

### 2. Expansão do Módulo de Metas (Performance)
```sql
-- Adiciona colunas de objetivos (targets) para análise de performance
ALTER TABLE public.monthly_performance
ADD COLUMN IF NOT EXISTS pa_target numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS ticket_target numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pu_target numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS delinquency_target numeric DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS items_target integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS business_days integer DEFAULT 26;
```

### 3. Tabelas da Gelateria e Partilha
```sql
-- Tabela de Sócios para Partilha de Lucros (DRE Mensal)
create table if not exists public.store_profit_distribution (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) on delete cascade,
  partner_name text not null,
  percentage numeric not null check (percentage > 0 and percentage <= 100),
  active boolean default true,
  created_at timestamp with time zone default now()
);

-- Tabela de Categorias de Despesas da Gelateria
create table if not exists public.ice_cream_expense_categories (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now(),
  unique(store_id, name)
);
```