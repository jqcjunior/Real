
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

### 3. Tabela de Recibos
```sql
create table public.financial_receipts (
    id text primary key, -- Número do recibo formatado
    store_id uuid references public.stores(id) on delete cascade,
    issuer_name text,
    payer text,
    recipient text,
    value numeric(10,2),
    value_in_words text,
    reference text,
    receipt_date date,
    created_at timestamptz default now()
);
```
