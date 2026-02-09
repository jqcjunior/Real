
# Estrutura de Banco de Dados - Real Calçados (v6.0)

Execute os blocos abaixo no **SQL Editor** do Supabase para implementar a **Opção A (Cálculos em View)**.

---

### 1. Tabela Física de Performance (APENAS DADOS BRUTOS)
```sql
-- Remove a tabela antiga para reconstruir com a Opção A
drop table if exists public.monthly_performance_actual cascade;

create table public.monthly_performance_actual (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade,
    month text not null, -- Formato YYYY-MM
    
    revenue_actual numeric default 0, -- Valor Vendido
    items_actual numeric default 0,   -- Qtde Itens
    sales_actual numeric default 0,   -- Qtde Vendas
    delinquency_rate numeric default 0,
    
    last_import_by text,
    updated_at timestamptz default now(),
    created_at timestamptz default now(),
    constraint monthly_performance_actual_store_month_key unique (store_id, month)
);
```

### 2. View de Performance (INTELIGÊNCIA DE CÁLCULO)
```sql
create or replace view public.monthly_performance as
select 
    -- ID único
    (coalesce(g.store_id, a.store_id)::text || '-' || coalesce(a.month, (g.year || '-' || lpad(g.month::text, 2, '0')))) as id,
    coalesce(g.store_id, a.store_id) as store_id,
    coalesce(a.month, (g.year || '-' || lpad(g.month::text, 2, '0'))) as month,
    
    -- Realizado (Dados Brutos da Tabela Física)
    coalesce(a.revenue_actual, 0) as revenue_actual,
    coalesce(a.items_actual, 0) as items_actual,
    coalesce(a.sales_actual, 0) as sales_actual,
    coalesce(a.delinquency_rate, 0) as delinquency_rate,

    -- Indicadores Calculados em Tempo Real (O Coração da Opção A)
    -- P.A. = Itens / Vendas
    case when coalesce(a.sales_actual, 0) > 0 
         then round(a.items_actual / a.sales_actual, 2) 
         else 0 end as items_per_ticket,

    -- P.U. = Valor / Itens
    case when coalesce(a.items_actual, 0) > 0 
         then round(a.revenue_actual / a.items_actual, 2) 
         else 0 end as unit_price_average,

    -- Ticket Médio = Valor / Vendas
    case when coalesce(a.sales_actual, 0) > 0 
         then round(a.revenue_actual / a.sales_actual, 2) 
         else 0 end as average_ticket,
    
    -- Metas (Targets)
    coalesce(g.revenue_target, 0) as revenue_target,
    coalesce(g.items_target, 0) as items_target,
    coalesce(g.pa_target, 0) as pa_target,
    coalesce(g.pu_target, 0) as pu_target,
    coalesce(g.ticket_target, 0) as ticket_target,
    coalesce(g.delinquency_target, 2.0) as delinquency_target,
    coalesce(g.business_days, 26) as business_days,
    coalesce(g.trend, 'stable') as trend,

    -- Atingimento (%)
    case when coalesce(g.revenue_target, 0) > 0 
         then round((coalesce(a.revenue_actual, 0) / g.revenue_target) * 100, 2)
         else 0 end as percent_meta

from public.monthly_goals g
full join public.monthly_performance_actual a 
    on g.store_id = a.store_id 
    and (g.year || '-' || lpad(g.month::text, 2, '0')) = a.month;
```
