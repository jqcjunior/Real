
# Estrutura de Banco de Dados - Real Calçados (v6.5)

Execute os blocos abaixo no **SQL Editor** do Supabase.

---

### 1. Tabela de Bandeiras de Cartão (Configurador)
```sql
create table public.financial_card_brands (
    id uuid default gen_random_uuid() primary key,
    name text not null unique,
    created_at timestamptz default now()
);

-- Inserir bandeiras padrão iniciais
insert into public.financial_card_brands (name) values 
('VISA DÉBITO'), ('VISA CRÉDITO'), ('MASTER DÉBITO'), ('MASTER CRÉDITO'), 
('ELO DÉBITO'), ('ELO CRÉDITO'), ('AMEX'), ('HIPERCARD')
on conflict (name) do nothing;
```

### 2. Tabela de Vendas Cartão (Auditoria)
```sql
create table public.financial_card_sales (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade,
    user_id uuid references public.admin_users(id),
    user_name text,
    date date not null,
    brand text not null,
    value numeric(10,2) not null,
    sale_code text,
    authorization_code text,
    created_at timestamptz default now()
);
```

### 3. Tabela de Vendas PIX (Auditoria)
```sql
create table public.financial_pix_sales (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade,
    user_id uuid references public.admin_users(id),
    user_name text,
    date date not null,
    sale_code text, -- Número da Ficha
    value numeric(10,2) not null,
    payer_name text,
    created_at timestamptz default now()
);
```

### 4. Tabela de Gestão de Compras (Importação Planilha)
```sql
create table public.gestao_compras (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade,
    brand text not null,
    product_type text not null,
    stock_qty integer default 0,
    buy_qty integer default 0,
    sell_qty integer default 0,
    sell_price numeric(10,2) default 0,
    last_buy_date date,
    year integer not null,
    month integer not null,
    updated_at timestamptz default now(),
    unique(store_id, brand, product_type, year, month)
);

-- Habilitar RLS
alter table public.gestao_compras enable row level security;

-- Políticas de Acesso
create policy "Acesso Global Admin" on public.gestao_compras
    for all using (
        exists (select 1 from public.admin_users where id = auth.uid() and role = 'ADMIN')
    );

create policy "Acesso Local Loja" on public.gestao_compras
    for select using (
        exists (select 1 from public.admin_users where id = auth.uid() and store_id = gestao_compras.store_id)
    );
```

### 5. Tabelas do Módulo Dashboard P.A. (Performance de Vendas)

```sql
-- 1. Parâmetros Globais do P.A.
create table public.pa_parameters (
    id uuid default gen_random_uuid() primary key,
    min_pa numeric(10,2) not null default 1.80, -- P.A. Mínimo para premiação
    max_pa numeric(10,2) not null default 2.50, -- Teto do P.A.
    award_value numeric(10,2) not null default 50.00, -- Valor fixo da premiação
    weight_revenue integer not null default 50, -- Peso da Meta de Faturamento no Ranking
    weight_pa integer not null default 50, -- Peso do P.A no Ranking
    updated_at timestamptz default now()
);

-- 2. Semanas de Referência (Calendário P.A.)
create table public.pa_weeks (
    id uuid default gen_random_uuid() primary key,
    week_number integer not null, -- 1 a 5
    month integer not null, -- 1 a 12
    year integer not null,
    start_date date not null,
    end_date date not null,
    is_active boolean default true,
    created_at timestamptz default now(),
    unique(week_number, month, year)
);

-- 3. Vendas Consolidadas por Vendedor (Importação XLS)
create table public.pa_sales (
    id uuid default gen_random_uuid() primary key,
    week_id uuid references public.pa_weeks(id) on delete cascade,
    store_id uuid references public.stores(id) on delete cascade,
    seller_name text not null,
    total_sales numeric(10,2) not null, -- Valor total vendido
    pa_value numeric(10,2) not null, -- P.A. do vendedor na semana
    items_sold integer not null, -- Qtd itens vendidos
    is_eligible boolean default false, -- Calculado no backend/importação
    award_amount numeric(10,2) default 0,
    created_at timestamptz default now()
);

-- 4. Registro de Premiações (Histórico/Pagamento)
create table public.pa_awards (
    id uuid default gen_random_uuid() primary key,
    sale_id uuid references public.pa_sales(id) on delete cascade,
    store_id uuid references public.stores(id) on delete cascade,
    seller_name text not null,
    amount numeric(10,2) not null,
    status text check (status in ('PENDENTE', 'PAGO')) default 'PENDENTE',
    paid_at timestamptz,
    created_at timestamptz default now()
);

-- Habilitar RLS
alter table public.pa_parameters enable row level security;
alter table public.pa_weeks enable row level security;
alter table public.pa_sales enable row level security;
alter table public.pa_awards enable row level security;

-- Políticas de Acesso (Admin Total)
create policy "Admin Full Access PA" on public.pa_parameters for all using (exists (select 1 from public.admin_users where id = auth.uid() and role = 'ADMIN'));
create policy "Admin Full Access Weeks" on public.pa_weeks for all using (exists (select 1 from public.admin_users where id = auth.uid() and role = 'ADMIN'));
create policy "Admin Full Access Sales" on public.pa_sales for all using (exists (select 1 from public.admin_users where id = auth.uid() and role = 'ADMIN'));
create policy "Admin Full Access Awards" on public.pa_awards for all using (exists (select 1 from public.admin_users where id = auth.uid() and role = 'ADMIN'));

-- Políticas de Acesso (Gerente - Apenas Leitura da sua Loja)
create policy "Manager Read Sales" on public.pa_sales for select using (exists (select 1 from public.admin_users where id = auth.uid() and store_id = pa_sales.store_id));
create policy "Manager Read Awards" on public.pa_awards for select using (exists (select 1 from public.admin_users where id = auth.uid() and store_id = pa_awards.store_id));
```
