-- Migration: otb_logic_and_visual_improvements.sql

-- 1. Nova função para calcular OTB detalhado de um mês específico
CREATE OR REPLACE FUNCTION get_otb_disponivel_mes(
  p_store_number TEXT,
  p_year INTEGER,
  p_month INTEGER,
  p_tipo_comprador TEXT,
  p_prazo_dias INTEGER[] DEFAULT ARRAY[90, 120, 150]
)
RETURNS TABLE(
  mes_compra INTEGER,
  ano_compra INTEGER,
  cota_minima_disponivel NUMERIC,
  valor_maximo_compravel NUMERIC,
  detalhes JSONB
) AS $$
DECLARE
  v_data_compra DATE := make_date(p_year, p_month, 1);
  v_venc DATE;
  v_mes_venc INTEGER;
  v_ano_venc INTEGER;
  v_cota_limpa_venc NUMERIC;
  v_pedidos_venc NUMERIC;
  v_disp_venc NUMERIC;
  v_min_disp NUMERIC := NULL;
  v_percentual NUMERIC := CASE WHEN UPPER(p_tipo_comprador) = 'COMPRADOR' THEN 0.8 ELSE 0.2 END;
  v_detalhes_arr JSONB := '[]'::jsonb;
BEGIN
  FOR i IN 1..array_length(p_prazo_dias, 1) LOOP
    v_venc := v_data_compra + (p_prazo_dias[i] || ' days')::INTERVAL;
    v_mes_venc := EXTRACT(MONTH FROM v_venc)::INTEGER;
    v_ano_venc := EXTRACT(YEAR FROM v_venc)::INTEGER;
    
    -- Busca cota limpa do mês de vencimento
    SELECT (COALESCE(cota_valor, 0) - COALESCE(despesas_comprometidas, 0))
    INTO v_cota_limpa_venc
    FROM buyorder_parameters_store
    WHERE store_number = p_store_number AND year = v_ano_venc AND month = v_mes_venc;
    
    v_cota_limpa_venc := COALESCE(v_cota_limpa_venc, 0) * v_percentual;
    
    -- Busca pedidos que vencem neste mês futuro
    -- Precisamos considerar pedidos onde a LOJA p_store_number está incluída
    SELECT COALESCE(SUM((
      SELECT SUM(CASE WHEN (parcela->>'valor') ~ '^[0-9]+(\.[0-9]+)?$' THEN (parcela->>'valor')::NUMERIC ELSE 0 END)
      FROM jsonb_array_elements(COALESCE(bo.titulos_pagamento->'parcelas', '[]'::jsonb)) parcela
      WHERE CASE WHEN (parcela->>'mes') ~ '^[0-9]+$' THEN (parcela->>'mes')::INTEGER ELSE NULL END = v_mes_venc
        AND CASE WHEN (parcela->>'ano') ~ '^[0-9]+$' THEN (parcela->>'ano')::INTEGER ELSE NULL END = v_ano_venc -- FIX: Usar v_ano_venc
    )), 0)
    INTO v_pedidos_venc
    FROM buy_orders bo
    JOIN buy_order_sub_orders boso ON boso.order_id = bo.id
    WHERE bo.status != 'CANCELADO'
      AND UPPER(bo.tipo_comprador) = UPPER(p_tipo_comprador)
      AND p_store_number = ANY(SELECT jsonb_array_elements_text(boso.lojas_numeros));
      
    v_disp_venc := v_cota_limpa_venc - v_pedidos_venc;
    
    IF v_min_disp IS NULL OR v_disp_venc < v_min_disp THEN
      v_min_disp := v_disp_venc;
    END IF;
    
    v_detalhes_arr := v_detalhes_arr || jsonb_build_object(
      'prazo', p_prazo_dias[i],
      'mes', v_mes_venc,
      'ano', v_ano_venc,
      'disponivel', v_disp_venc
    );
  END LOOP;
  
  RETURN QUERY SELECT 
    p_month, 
    p_year, 
    GREATEST(0, v_min_disp), 
    GREATEST(0, v_min_disp) * array_length(p_prazo_dias, 1),
    v_detalhes_arr;
END;
$$ LANGUAGE plpgsql;

-- 2. Atualizar get_cotas_ano_fiscal com cota_inicial e lógica de OTB
CREATE OR REPLACE FUNCTION get_cotas_ano_fiscal(
  p_store_number TEXT,
  p_start_year INTEGER,
  p_start_month INTEGER
)
RETURNS TABLE (
  mes INTEGER,
  ano INTEGER,
  cota_inicial NUMERIC,
  cota_limpa NUMERIC,
  despesas_comprometidas NUMERIC,
  pedidos_futuros_comprador NUMERIC,
  pedidos_futuros_gerente NUMERIC,
  qtd_pedidos_comprador INTEGER,
  qtd_pedidos_gerente INTEGER,
  otb_maximo_comprador NUMERIC,
  otb_maximo_gerente NUMERIC
) AS $$
DECLARE
  v_date DATE := make_date(p_start_year, p_start_month, 1);
  v_end_date DATE := v_date + interval '12 months';
  v_current_date DATE;
  v_year INTEGER;
  v_month INTEGER;
  v_otb_comp NUMERIC;
  v_otb_ger  NUMERIC;
BEGIN
  v_current_date := v_date;
  WHILE v_current_date < v_end_date LOOP
    v_year := extract(year from v_current_date);
    v_month := extract(month from v_current_date);
    
    -- OTB Comprador
    SELECT valor_maximo_compravel INTO v_otb_comp FROM get_otb_disponivel_mes(p_store_number, v_year, v_month, 'COMPRADOR');
    -- OTB Gerente
    SELECT valor_maximo_compravel INTO v_otb_ger FROM get_otb_disponivel_mes(p_store_number, v_year, v_month, 'GERENTE');
    
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
            SELECT SUM(CASE WHEN (parcela->>'valor') ~ '^[0-9]+(\.[0-9]+)?$' THEN (parcela->>'valor')::NUMERIC ELSE 0 END) 
            FROM jsonb_array_elements(COALESCE(bo.titulos_pagamento->'parcelas', '[]'::jsonb)) parcela 
            WHERE CASE WHEN (parcela->>'mes') ~ '^[0-9]+$' THEN (parcela->>'mes')::INTEGER ELSE NULL END = v_month 
              AND CASE WHEN (parcela->>'ano') ~ '^[0-9]+$' THEN (parcela->>'ano')::INTEGER ELSE NULL END = v_year
        )), 0) as total_pedidos,
        COUNT(DISTINCT bo.id) as count_pedidos
      FROM buy_orders bo
      JOIN buy_order_sub_orders boso ON boso.order_id = bo.id
      WHERE bo.status != 'CANCELADO'
        AND UPPER(bo.tipo_comprador) = 'COMPRADOR'
        AND p_store_number = ANY(SELECT jsonb_array_elements_text(boso.lojas_numeros))
        AND jsonb_typeof(COALESCE(bo.titulos_pagamento->'parcelas', '[]'::jsonb)) = 'array'
    ),
    pedidos_abatidos_gerente AS (
      SELECT 
        COALESCE(SUM((
            SELECT SUM(CASE WHEN (parcela->>'valor') ~ '^[0-9]+(\.[0-9]+)?$' THEN (parcela->>'valor')::NUMERIC ELSE 0 END) 
            FROM jsonb_array_elements(COALESCE(bo.titulos_pagamento->'parcelas', '[]'::jsonb)) parcela 
            WHERE CASE WHEN (parcela->>'mes') ~ '^[0-9]+$' THEN (parcela->>'mes')::INTEGER ELSE NULL END = v_month 
              AND CASE WHEN (parcela->>'ano') ~ '^[0-9]+$' THEN (parcela->>'ano')::INTEGER ELSE NULL END = v_year
        )), 0) as total_pedidos,
        COUNT(DISTINCT bo.id) as count_pedidos
      FROM buy_orders bo
      JOIN buy_order_sub_orders boso ON boso.order_id = bo.id
      WHERE bo.status != 'CANCELADO'
        AND UPPER(bo.tipo_comprador) = 'GERENTE'
        AND p_store_number = ANY(SELECT jsonb_array_elements_text(boso.lojas_numeros))
        AND jsonb_typeof(COALESCE(bo.titulos_pagamento->'parcelas', '[]'::jsonb)) = 'array'
    )
    SELECT 
      v_month as mes,
      v_year as ano,
      COALESCE((SELECT cota_valor FROM parametros), 0) as cota_inicial,
      (COALESCE((SELECT cota_valor FROM parametros), 0) - COALESCE((SELECT despesas_comprometidas FROM parametros), 0)) as cota_limpa,
      COALESCE((SELECT despesas_comprometidas FROM parametros), 0) as despesas_comprometidas,
      (SELECT total_pedidos FROM pedidos_abatidos_comprador) as pedidos_futuros_comprador,
      (SELECT total_pedidos FROM pedidos_abatidos_gerente) as pedidos_futuros_gerente,
      (SELECT count_pedidos::INTEGER FROM pedidos_abatidos_comprador) as qtd_pedidos_comprador,
      (SELECT count_pedidos::INTEGER FROM pedidos_abatidos_gerente) as qtd_pedidos_gerente,
      COALESCE(v_otb_comp, 0) as otb_maximo_comprador,
      COALESCE(v_otb_ger, 0) as otb_maximo_gerente;
      
    v_current_date := v_current_date + interval '1 month';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
