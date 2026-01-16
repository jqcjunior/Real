
# Estrutura de Banco de Dados Idempotente - Real Calçados

Copie e cole os blocos abaixo no SQL Editor do Supabase para garantir que o sistema de menus e permissões funcione corretamente.

---

### 1. Configuração de Permissões de Páginas (Navegação)

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
  sort_order integer default 100,
  created_at timestamp with time zone default now()
);

-- Inserção das Rotas Funcionais e Sub-Módulos da Gelateria
insert into public.page_permissions (page_key, label, module_group, allow_admin, allow_manager, allow_cashier, sort_order)
values 
  ('dashboard', 'Dashboard Performance', 'Inteligência', true, true, false, 10),
  ('metas_registration', 'Registro de Metas', 'Inteligência', true, false, false, 20),
  ('purchases', 'Gestão de Compras', 'Inteligência', true, true, false, 30),
  ('cotas', 'Gestão de Cotas', 'Inteligência', true, true, false, 40),
  
  ('icecream', 'Gelateria: Módulo Principal', 'Operação', true, true, true, 50),
  ('gelateria_pdv', 'Gelateria: PDV / Vendas', 'Gelateria', true, true, true, 51),
  ('gelateria_estoque', 'Gelateria: Estoque / Produção', 'Gelateria', true, true, true, 52),
  ('gelateria_dre', 'Gelateria: DRE / Fluxo', 'Gelateria', true, true, false, 53),
  ('gelateria_audit', 'Gelateria: Auditoria', 'Gelateria', true, true, false, 54),
  ('gelateria_config', 'Gelateria: Config de Produtos', 'Gelateria', true, true, false, 55),

  ('cash_register', 'Fechamento de Caixa', 'Operação', true, true, true, 60),
  ('financial', 'Financeiro / Recibos', 'Operação', true, true, true, 70),
  ('cash_errors', 'Quebras de Caixa', 'Operação', true, false, true, 80),
  ('agenda', 'Minha Agenda', 'Operação', true, true, true, 90),
  
  ('marketing', 'Studio Real Marketing', 'Marketing', true, true, false, 100),
  
  ('downloads', 'Central Downloads', 'Documentos', true, true, true, 110),
  ('auth_print', 'Autoriz. de Compra', 'Documentos', true, true, true, 120),
  ('termo_print', 'Termo Condicional', 'Documentos', true, true, true, 130),
  
  ('admin_users', 'Gestão de Usuários', 'Administração', true, false, false, 140),
  ('access_control', 'Controle de Acessos', 'Administração', true, false, false, 150),
  ('audit', 'Auditoria de Logs', 'Administração', true, false, false, 160),
  ('settings', 'Configurações', 'Administração', true, false, false, 170)
on conflict (page_key) do update set
  label = excluded.label,
  module_group = excluded.module_group,
  sort_order = excluded.sort_order;
```
