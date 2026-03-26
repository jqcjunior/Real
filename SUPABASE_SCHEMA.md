
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
