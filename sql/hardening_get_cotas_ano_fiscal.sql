-- Migration: hardening_get_cotas_ano_fiscal.sql

CREATE OR REPLACE FUNCTION get_cotas_ano_fiscal(
  p_store_number TEXT,
  p_start_year INTEGER,
  p_start_month INTEGER
)
RETURNS TABLE (
  mes INTEGER,
  ano INTEGER,
  cota_limpa NUMERIC,
  despesas_comprometidas NUMERIC,
  pedidos_futuros_comprador NUMERIC,
  pedidos_futuros_gerente NUMERIC,
  qtd_pedidos_comprador INTEGER,
  qtd_pedidos_gerente INTEGER
) AS $$
DECLARE
  v_date DATE := make_date(p_start_year, p_start_month, 1);
  v_end_date DATE := v_date + interval '12 months';
  v_current_date DATE;
  v_year INTEGER;
  v_month INTEGER;
BEGIN
  -- We loop 12 months
  v_current_date := v_date;
  WHILE v_current_date < v_end_date LOOP
    v_year := extract(year from v_current_date);
    v_month := extract(month from v_current_date);
    
    RETURN QUERY
    WITH parametros AS (
      SELECT 
        COALESCE(bps.cota_valor, 0) as cota_valor,
        COALESCE(bps.despesas_comprometidas, 0) as despesas_comprometidas
      FROM buyorder_parameters_store bps
      WHERE bps.store_number = p_store_number
        AND bps.year = v_year
        AND bps.month = v_month
    ),
    pedidos_abatidos_comprador AS (
      SELECT 
        COALESCE(SUM((
            SELECT SUM(
                CASE
                    WHEN (parcela->>'valor') ~ '^[0-9]+(\.[0-9]+)?$' THEN (parcela->>'valor')::NUMERIC
                    ELSE 0
                END
            ) 
            FROM jsonb_array_elements(COALESCE(bo.titulos_pagamento->'parcelas', '[]'::jsonb)) parcela 
            WHERE 
                CASE WHEN (parcela->>'mes') ~ '^[0-9]+$' THEN (parcela->>'mes')::INTEGER ELSE NULL END = v_month 
                AND CASE WHEN (parcela->>'ano') ~ '^[0-9]+$' THEN (parcela->>'ano')::INTEGER ELSE NULL END = v_year
        )), 0) as total_pedidos,
        COUNT(DISTINCT bo.id) as count_pedidos
      FROM buy_orders bo
      WHERE bo.store_id = p_store_number
        AND UPPER(bo.tipo_comprador) = 'COMPRADOR'
        AND bo.status != 'CANCELADO'
        AND jsonb_typeof(COALESCE(bo.titulos_pagamento->'parcelas', '[]'::jsonb)) = 'array'
    ),
    pedidos_abatidos_gerente AS (
      SELECT 
        COALESCE(SUM((
            SELECT SUM(
                CASE
                    WHEN (parcela->>'valor') ~ '^[0-9]+(\.[0-9]+)?$' THEN (parcela->>'valor')::NUMERIC
                    ELSE 0
                END
            ) 
            FROM jsonb_array_elements(COALESCE(bo.titulos_pagamento->'parcelas', '[]'::jsonb)) parcela 
            WHERE 
                CASE WHEN (parcela->>'mes') ~ '^[0-9]+$' THEN (parcela->>'mes')::INTEGER ELSE NULL END = v_month 
                AND CASE WHEN (parcela->>'ano') ~ '^[0-9]+$' THEN (parcela->>'ano')::INTEGER ELSE NULL END = v_year
        )), 0) as total_pedidos,
        COUNT(DISTINCT bo.id) as count_pedidos
      FROM buy_orders bo
      WHERE bo.store_id = p_store_number
        AND UPPER(bo.tipo_comprador) = 'GERENTE'
        AND bo.status != 'CANCELADO'
        AND jsonb_typeof(COALESCE(bo.titulos_pagamento->'parcelas', '[]'::jsonb)) = 'array'
    )
    SELECT 
      v_month as mes,
      v_year as ano,
      (COALESCE((SELECT cota_valor FROM parametros), 0) - COALESCE((SELECT despesas_comprometidas FROM parametros), 0)) as cota_limpa,
      COALESCE((SELECT despesas_comprometidas FROM parametros), 0) as despesas_comprometidas,
      (SELECT total_pedidos FROM pedidos_abatidos_comprador) as pedidos_futuros_comprador,
      (SELECT total_pedidos FROM pedidos_abatidos_gerente) as pedidos_futuros_gerente,
      (SELECT count_pedidos::INTEGER FROM pedidos_abatidos_comprador) as qtd_pedidos_comprador,
      (SELECT count_pedidos::INTEGER FROM pedidos_abatidos_gerente) as qtd_pedidos_gerente;
      
    v_current_date := v_current_date + interval '1 month';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
