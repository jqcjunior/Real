-- Migration: funcao_cota_disponivel_mes.sql

CREATE OR REPLACE FUNCTION get_cota_disponivel_mes(
  p_store_number TEXT,
  p_year INTEGER,
  p_month INTEGER,
  p_tipo_comprador TEXT -- 'GERENTE' ou 'COMPRADOR'
)
RETURNS TABLE (
  mes INTEGER,
  cota_inicial NUMERIC,
  despesas_comprometidas NUMERIC,
  cota_limpa NUMERIC,
  pedidos_mes NUMERIC,
  disponivel_real NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH parametros AS (
    -- Buscar parâmetros do mês
    SELECT 
      bps.month,
      bps.cota_valor,
      bps.despesas_comprometidas,
      CASE 
        WHEN p_tipo_comprador = 'GERENTE' THEN bps.cota_gerente_valor
        ELSE bps.cota_comprador_valor
      END as cota_tipo_valor
    FROM buyorder_parameters_store bps
    WHERE bps.store_number = p_store_number
    AND bps.year = p_year
    AND bps.month = p_month
  ),
  pedidos_abatidos AS (
    -- Somar pedidos que têm títulos neste mês
    SELECT 
      COALESCE(
        SUM(
          (
            SELECT SUM((parcela->>'valor')::NUMERIC)
            FROM jsonb_array_elements(bo.titulos_pagamento->'parcelas') parcela
            WHERE (parcela->>'mes')::INTEGER = p_month
            AND (parcela->>'ano')::INTEGER = p_year
          )
        ), 0
      ) as total_pedidos_mes
    FROM buy_orders bo
    WHERE bo.store_id = p_store_number
    AND bo.tipo_comprador = p_tipo_comprador
    AND bo.status != 'CANCELADO'
    AND bo.titulos_pagamento IS NOT NULL
  )
  SELECT 
    p.month,
    p.cota_valor,
    p.despesas_comprometidas,
    (p.cota_valor - p.despesas_comprometidas) as cota_limpa_calc,
    pa.total_pedidos_mes,
    ((CASE WHEN p_tipo_comprador = 'GERENTE' THEN p.cota_gerente_valor ELSE p.cota_tipo_valor END) - COALESCE(pa.total_pedidos_mes, 0)) as disponivel_real_calc
  FROM parametros p
  CROSS JOIN pedidos_abatidos pa;
END;
$$ LANGUAGE plpgsql;

-- Comentário
COMMENT ON FUNCTION get_cota_disponivel_mes IS 
'Calcula cota disponível real de um mês considerando pedidos com títulos naquele mês';
