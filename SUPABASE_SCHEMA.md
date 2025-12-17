
# Estrutura do Banco de Dados - Real Calçados (Módulo Sorvete)

Para adicionar o controle de sorveteria ao seu banco de dados Supabase existente, execute o SQL abaixo. Estas tabelas são independentes das tabelas de lojas de calçados.

---

```sql
-- --- NOVAS TABELAS SORVETE ---

-- Itens e Preços (Tabela Base)
create table if not exists public.ice_cream_items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  price numeric not null default 0,
  category text default 'principal', -- principal, adicional
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Vendas Diárias (Unidades)
create table if not exists public.ice_cream_daily_sales (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  item_id uuid references public.ice_cream_items(id),
  units_sold integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Finanças (Movimentação Manual)
create table if not exists public.ice_cream_finances (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  type text not null, -- entry, exit
  category text not null, -- vale, venda_dinheiro, venda_cartao, material, fornecedor, bancaria, cartao_taxa
  value numeric not null default 0,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- POPULAR ITENS INICIAIS (Apenas se a tabela estiver vazia)
insert into public.ice_cream_items (name, price, category) values 
('Sundae 180ml', 8.00, 'principal'),
('Sundae 300ml', 12.00, 'principal'),
('Milkshake 300ml', 15.00, 'principal'),
('Milkshake 500ml', 20.00, 'principal'),
('Casquinha', 4.00, 'principal'),
('Copo', 5.00, 'principal'),
('Cascão', 7.00, 'principal'),
('Cascão Trufado', 10.00, 'principal'),
('Cascão Nutella', 12.00, 'principal'),
('Agua Mineral', 3.00, 'adicional'),
('Fini', 2.00, 'adicional'),
('Acréscimo', 1.50, 'adicional')
on conflict do nothing;

-- POLÍTICAS DE ACESSO PÚBLICO (PADRÃO DO SISTEMA ATUAL)
alter table public.ice_cream_items enable row level security;
create policy "Public Access Ice Cream Items" on public.ice_cream_items for all using (true) with check (true);

alter table public.ice_cream_daily_sales enable row level security;
create policy "Public Access Ice Cream Sales" on public.ice_cream_daily_sales for all using (true) with check (true);

alter table public.ice_cream_finances enable row level security;
create policy "Public Access Ice Cream Finances" on public.ice_cream_finances for all using (true) with check (true);
```
