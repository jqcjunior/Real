
-- Migration: add_fixed_quota_columns.sql

-- 1. Adicionar colunas na tabela de parâmetros por loja
ALTER TABLE buyorder_parameters_store 
ADD COLUMN IF NOT EXISTS usar_cota_fixa BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cota_gerente_fixa DECIMAL(12,2);

-- 2. Atualizar a função get_cotas_ano_fiscal para incluir as novas lógicas de cota fixa
CREATE OR REPLACE FUNCTION get_cotas_ano_fiscal(
  p_store_number TEXT,
  p_start_year INTEGER,
  p_start_month INTEGER
)
RETURNS TABLE (
  mes INTEGER,
  ano INTEGER,
  cota_mensal NUMERIC,
  cota_utilizada NUMERIC,
  cota_disponivel NUMERIC,
  usar_cota_fixa BOOLEAN,
  cota_gerente_valor NUMERIC,
  cota_comprador_valor NUMERIC,
  -- Mantendo campos antigos para compatibilidade se necessário (opcional, mas bom para não quebrar UI existente)
  despesas_comprometidas NUMERIC,
  pedidos_confirmados NUMERIC,
  qtd_pedidos INTEGER
) AS $$
DECLARE
  v_date DATE := make_date(p_start_year, p_start_month, 1);
  v_end_date DATE := v_date + interval '12 months';
  v_current_date DATE;
  v_year INTEGER;
  v_month INTEGER;
BEGIN
  v_current_date := v_date;
  WHILE v_current_date < v_end_date LOOP
    v_year := extract(year from v_current_date);
    v_month := extract(month from v_current_date);
    
    RETURN QUERY
    WITH parametros AS (
      SELECT 
        COALESCE(bps.cota_valor, 0) as cota_valor,
        COALESCE(bps.despesas_comprometidas, 0) as despesas_comprometidas,
        COALESCE(bps.usar_cota_fixa, false) as ucf,
        bps.cota_gerente_fixa as cgf
      FROM buyorder_parameters_store bps
      WHERE bps.store_number = p_store_number
        AND bps.year = v_year
        AND bps.month = v_month
    ),
    pedidos_confirmados_calc AS (
      -- Considera todos os pedidos confirmados (não cancelados) para esta loja e mês (baseado em parcelas)
      SELECT 
        COALESCE(SUM((
            SELECT SUM(CASE WHEN (parcela->>'valor') ~ '^[0-9]+(\.[0-9]+)?$' THEN (parcela->>'valor')::NUMERIC ELSE 0 END) 
            FROM jsonb_array_elements(COALESCE(bo.titulos_pagamento->'parcelas', '[]'::jsonb)) parcela 
            WHERE CASE WHEN (parcela->>'mes') ~ '^[0-9]+$' THEN (parcela->>'mes')::INTEGER ELSE NULL END = v_month 
              AND CASE WHEN (parcela->>'ano') ~ '^[0-9]+$' THEN (parcela->>'ano')::INTEGER ELSE NULL END = v_year
        )), 0) as total_pedidos,
        COUNT(DISTINCT bo.id)::INTEGER as count_pedidos
      FROM buy_orders bo
      JOIN buy_order_sub_orders boso ON boso.order_id = bo.id
      WHERE bo.status NOT IN ('CANCELADO', 'RASCUNHO')
        AND p_store_number = ANY(SELECT jsonb_array_elements_text(boso.lojas_numeros))
    ),
    pre_calc AS (
      SELECT
        COALESCE((SELECT cota_valor FROM parametros), 0) as cota_m,
        COALESCE((SELECT despesas_comprometidas FROM parametros), 0) as despesas,
        (SELECT total_pedidos FROM pedidos_confirmados_calc) as confirmados,
        COALESCE((SELECT ucf FROM parametros), false) as usar_fixa,
        (SELECT cgf FROM parametros) as cota_fixa_gerente
    )
    SELECT 
      v_month,
      v_year,
      pc.cota_m,
      (pc.despesas + pc.confirmados) as cota_utilizada,
      (pc.cota_m - (pc.despesas + pc.confirmados)) as cota_disponivel,
      pc.usar_fixa,
      -- Lógica Cota Gerente
      CASE 
        WHEN pc.usar_fixa AND pc.cota_fixa_gerente IS NOT NULL THEN pc.cota_fixa_gerente
        ELSE (pc.cota_m - (pc.despesas + pc.confirmados)) * 0.2
      END as cota_gerente_valor,
      -- Lógica Cota Comprador
      CASE 
        WHEN pc.usar_fixa AND pc.cota_fixa_gerente IS NOT NULL THEN (pc.cota_m - (pc.despesas + pc.confirmados)) - pc.cota_fixa_gerente
        ELSE (pc.cota_m - (pc.despesas + pc.confirmados)) * 0.8
      END as cota_comprador_valor,
      pc.despesas,
      pc.confirmados,
      (SELECT count_pedidos FROM pedidos_confirmados_calc);
      
    v_current_date := v_current_date + interval '1 month';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
