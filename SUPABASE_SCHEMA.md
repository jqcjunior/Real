
# Estrutura de Banco de Dados Idempotente - Real Calçados

Copie e cole os blocos abaixo no SQL Editor do Supabase para garantir que o sistema de menus e permissões funcione corretamente.

---

### 1. Tabelas da Gelateria e Partilha

```sql
-- Tabela de Sócios para Partilha de Lucros (DRE Mensal)
create table if not exists public.store_profit_partners (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) on delete cascade,
  partner_name text not null,
  percentage numeric not null check (percentage > 0 and percentage <= 100),
  active boolean default true,
  created_at timestamp with time zone default now()
);

-- Adicionar coluna de receita (JSONB) para suportar múltiplos insumos por venda
ALTER TABLE public.ice_cream_items 
ADD COLUMN IF NOT EXISTS recipe jsonb DEFAULT '[]'::jsonb;

-- Garantir que o estoque seja único por unidade e nome de base (Ex: Copo 300ml)
ALTER TABLE public.ice_cream_stock 
ADD CONSTRAINT unique_stock_item_per_store UNIQUE (store_id, product_base);
```

### 2. Configuração de Permissões de Páginas (Navegação)

```sql
-- Tabela de Permissões (se não existir)
create table if not exists public.page_permissions (
  id uuid default uuid_generate_v4() primary key,
  page_key text unique not null,
  label text not null,
  module_group text not null,
  allow_admin boolean default true,
  allow_manager boolean default false,
  allow_cashier boolean default false,
  allow_sorvete boolean default false,
  sort_order integer default 100,
  created_at timestamp with time zone default now()
);

-- Inserção das Rotas Funcionais e Sub-Módulos da Gelateria
insert into public.page_permissions (page_key, label, module_group, allow_admin, allow_manager, allow_cashier, allow_sorvete, sort_order)
values 
  ('dashboard', 'Dashboard Performance', 'Inteligência', true, true, false, false, 10),
  ('metas_registration', 'Registro de Metas', 'Inteligência', true, false, false, false, 20),
  ('purchases', 'Gestão de Compras', 'Inteligência', true, true, false, false, 30),
  ('cotas', 'Gestão de Cotas', 'Inteligência', true, true, false, false, 40),
  
  ('icecream', 'Gelateria: Módulo Principal', 'Operação', true, true, true, true, 50),
  ('gelateria_pdv', 'Gelateria: PDV / Vendas', 'Gelateria', true, true, true, true, 51),
  ('gelateria_estoque', 'Gelateria: Estoque / Produção', 'Gelateria', true, true, true, false, 52),
  ('gelateria_dre_diario', 'Gelateria: DRE Diário', 'Gelateria', true, true, true, false, 53),
  ('gelateria_dre_mensal', 'Gelateria: DRE Mensal', 'Gelateria', true, true, false, false, 54),
  ('gelateria_audit', 'Gelateria: Auditoria', 'Gelateria', true, true, false, false, 55),
  ('gelateria_config', 'Gelateria: Config de Produtos', 'Gelateria', true, true, false, false, 56),

  ('cash_register', 'Fechamento de Caixa', 'Operação', true, true, true, false, 60),
  ('financial', 'Financeiro / Recibos', 'Operação', true, true, true, false, 70),
  ('cash_errors', 'Quebras de Caixa', 'Operação', true, false, true, false, 80),
  ('agenda', 'Minha Agenda', 'Operação', true, true, true, false, 90),
  
  ('marketing', 'Studio Real Marketing', 'Marketing', true, true, false, false, 100),
  
  ('downloads', 'Central Downloads', 'Documentos', true, true, true, false, 110),
  ('auth_print', 'Autoriz. de Compra', 'Documentos', true, true, true, false, 120),
  ('termo_print', 'Termo Condicional', 'Documentos', true, true, true, false, 130),
  
  ('admin_users', 'Gestão de Usuários', 'Administração', true, false, false, false, 140),
  ('access_control', 'Controle de Acessos', 'Administração', true, false, false, false, 150),
  ('audit', 'Auditoria de Logs', 'Administração', true, false, false, false, 160),
  ('settings', 'Configurações', 'Administração', true, false, false, false, 170)
on conflict (page_key) do update set
  label = excluded.label,
  module_group = excluded.module_group,
  sort_order = excluded.sort_order;
```
