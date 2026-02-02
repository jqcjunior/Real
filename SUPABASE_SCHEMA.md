
# Estrutura de Banco de Dados - Real Calçados

Execute os blocos abaixo no **SQL Editor** do Supabase para garantir a sincronização entre importação e visualização.

---

### 1. Tabela Física de Performance (REALIZADO)
```sql
-- Criar a tabela se não existir
create table if not exists public.monthly_performance_actual (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) on delete cascade,
  month text not null, -- Formato YYYY-MM
  revenue_actual numeric default 0,
  items_actual numeric default 0,
  items_per_ticket numeric default 0,
  unit_price_average numeric default 0,
  average_ticket numeric default 0,
  delinquency_rate numeric default 0,
  business_days integer default 26,
  created_at timestamp with time zone default now()
);

-- CRITICAL: Adicionar restrição única para permitir o UPSERT (onConflict)
-- Se já existir, este comando garantirá a unicidade.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_performance_actual_store_month_key') THEN
        ALTER TABLE public.monthly_performance_actual 
        ADD CONSTRAINT monthly_performance_actual_store_month_key UNIQUE (store_id, month);
    END IF;
END $$;

-- Habilitar acesso público para a chave Anon (ajuste conforme sua política de segurança)
alter table public.monthly_performance_actual enable row level security;
create policy "Permitir leitura pública" on public.monthly_performance_actual for select using (true);
create policy "Permitir inserção/atualização pública" on public.monthly_performance_actual for all using (true) with check (true);
```

### 2. View Consolidada (DASHBOARD) - FULL JOIN ROBUSTO
```sql
create or replace view public.monthly_performance as
select 
  coalesce(g.id::text, (a.store_id::text || '-' || a.month)) as id,
  coalesce(g.store_id, a.store_id) as store_id,
  coalesce((g.year || '-' || lpad(g.month::text, 2, '0')), a.month) as month,
  coalesce(g.revenue_target, 0) as revenue_target,
  coalesce(g.items_target, 0) as items_target,
  coalesce(g.pa_target, 0) as pa_target,
  coalesce(g.pu_target, 0) as pu_target,
  coalesce(g.ticket_target, 0) as ticket_target,
  coalesce(g.delinquency_target, 2.0) as delinquency_target,
  coalesce(a.revenue_actual, 0) as revenue_actual,
  coalesce(a.items_actual, 0) as items_actual,
  coalesce(a.items_per_ticket, 0) as items_per_ticket,
  coalesce(a.unit_price_average, 0) as unit_price_average,
  coalesce(a.average_ticket, 0) as average_ticket,
  coalesce(a.delinquency_rate, 0) as delinquency_rate,
  coalesce(a.business_days, g.business_days, 26) as business_days,
  coalesce(g.trend, 'stable') as trend,
  case 
    when coalesce(g.revenue_target, 0) > 0 then (coalesce(a.revenue_actual, 0) / g.revenue_target) * 100 
    else 0 
  end as percent_meta
from public.monthly_goals g
full join public.monthly_performance_actual a 
  on g.store_id = a.store_id 
  and (g.year || '-' || lpad(g.month::text, 2, '0')) = a.month;

-- Recarrega o cache
NOTIFY pgrst, 'reload schema';
```
