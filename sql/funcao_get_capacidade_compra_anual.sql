-- Migration: funcao_get_capacidade_compra_anual.sql

CREATE OR REPLACE FUNCTION get_capacidade_compra_anual(
  p_store_number TEXT,
  p_year INTEGER,
  p_tipo_comprador TEXT,
  p_qtd_parcelas INTEGER
)
RETURNS TABLE (
  mes_nome TEXT,
  mes INTEGER,
  disponivel NUMERIC,
  capacidade_compra NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH parametros AS (
    SELECT 
      bps.month,
      (bps.cota_valor - bps.despesas_comprometidas) as cota_limpa,
      CASE 
        WHEN p_tipo_comprador = 'GERENTE' THEN bps.cota_gerente_valor
        ELSE bps.cota_comprador_valor
      END as cota_tipo
    FROM buyorder_parameters_store bps
    WHERE bps.store_number = p_store_number
    AND bps.year = p_year
  ),
  pedidos AS (
    SELECT 
      (parcela->>'mes')::INTEGER as mes,
      SUM((parcela->>'valor')::NUMERIC) as valor
    FROM buy_orders bo,
    jsonb_array_elements(bo.titulos_pagamento->'parcelas') parcela
    WHERE EXISTS (
        SELECT 1 FROM buy_order_sub_orders so 
        WHERE so.order_id = bo.id 
          AND p_store_number::text IN (SELECT jsonb_array_elements_text(lojas_numeros))
    )
    AND bo.tipo_comprador = p_tipo_comprador
    AND bo.status != 'CANCELADO'
    AND (parcela->>'ano')::INTEGER = p_year
    GROUP BY (parcela->>'mes')::INTEGER
  )
  SELECT 
    TO_CHAR(TO_DATE(p.month::TEXT, 'MM'), 'TMMon') as mes_nome,
    p.month as mes,
    (p.cota_tipo - COALESCE(ped.valor, 0)) as disponivel,
    (SELECT SUM(t.disponivel) FROM (SELECT (p2.cota_tipo - COALESCE(ped2.valor, 0)) as disponivel 
      FROM parametros p2 
      LEFT JOIN pedidos ped2 ON p2.month = ped2.mes
      WHERE p2.month >= p.month AND p2.month < p.month + p_qtd_parcelas
    ) t) as capacidade_compra
  FROM parametros p
  LEFT JOIN pedidos ped ON p.month = ped.mes
  ORDER BY p.month;
END;
$$ LANGUAGE plpgsql;
