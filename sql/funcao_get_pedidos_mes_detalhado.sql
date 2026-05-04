-- Migration: funcao_get_pedidos_mes_detalhado.sql

CREATE OR REPLACE FUNCTION get_pedidos_mes_detalhado(
  p_store_number TEXT,
  p_year INTEGER,
  p_month INTEGER,
  p_tipo_comprador TEXT
)
RETURNS TABLE (
  numero_pedido INTEGER,
  marca TEXT,
  comprador TEXT,
  valor_total NUMERIC,
  valor_mes NUMERIC,
  vencimentos JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bo.numero_pedido,
    bo.marca,
    bo.user_name as comprador,
    -- Somar itens
    COALESCE(
      (SELECT SUM(boi.total_pares * boi.custo)
       FROM buy_order_items boi
       WHERE boi.order_id = bo.id), 
      0
    ) as valor_total,
    -- Valor dividido pelo número de vencimentos
    COALESCE(
      (SELECT SUM(boi.total_pares * boi.custo)
       FROM buy_order_items boi
       WHERE boi.order_id = bo.id), 
      0
    ) / NULLIF(jsonb_array_length(bo.vencimentos), 0) as valor_mes,
    bo.vencimentos
  FROM buy_orders bo
  INNER JOIN buy_order_sub_orders boso ON boso.order_id = bo.id
  WHERE bo.status = 'confirmado'
  AND LOWER(bo.user_role) = LOWER(p_tipo_comprador)
  AND p_store_number = ANY(boso.lojas_numeros)
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(bo.vencimentos) venc
    WHERE (venc->>'mes')::INTEGER = p_month
    AND (venc->>'ano')::INTEGER = p_year
  );
END;
$$ LANGUAGE plpgsql;
