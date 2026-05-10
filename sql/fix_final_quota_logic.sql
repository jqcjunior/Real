-- Migration: fix_final_quota_logic.sql
-- Goal: Synchronize OTB and Quota logic to use buyorder_quota_transactions and correct fields.

-- 1. Helper to safely convert buy_orders.vencimentos to dates
CREATE OR REPLACE FUNCTION get_vencimentos_as_dates(p_vencimentos JSONB)
RETURNS DATE[] AS $$
DECLARE
    v_dates DATE[];
    v_val TEXT;
BEGIN
    IF p_vencimentos IS NULL OR jsonb_typeof(p_vencimentos) != 'array' THEN
        RETURN ARRAY[]::DATE[];
    END IF;

    FOR v_val IN SELECT * FROM jsonb_array_elements_text(p_vencimentos) LOOP
        IF v_val ~ '^\d{4}-\d{2}-\d{2}' THEN
            v_dates := array_append(v_dates, v_val::DATE);
        END IF;
    END LOOP;

    RETURN v_dates;
END;
$$ LANGUAGE plpgsql;

-- 2. Fixed debitar_cota_pedido: Uses actual vencimentos and handles any number of installments
CREATE OR REPLACE FUNCTION debitar_cota_pedido(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_order_total_value DECIMAL(12,2);
    v_vencimentos DATE[];
    v_num_parcelas INT;
    v_loja TEXT;
    v_lojas_array JSONB;
    v_num_lojas INT;
    v_valor_por_loja DECIMAL(12,2);
    v_valor_parcela DECIMAL(12,2);
    v_venc DATE;
    v_qc_id UUID;
    v_count INT := 0;
BEGIN
    -- 1. Get order data
    SELECT * INTO v_order FROM buy_orders WHERE id = p_order_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Pedido não encontrado'); END IF;

    -- 2. Calculate total value from items (Fix: use total_pares * custo)
    SELECT SUM(total_pares * custo) INTO v_order_total_value FROM buy_order_items WHERE order_id = p_order_id;
    v_order_total_value := COALESCE(v_order_total_value, 0);
    IF v_order_total_value <= 0 THEN RETURN jsonb_build_object('success', true, 'message', 'Valor zero, sem débitos'); END IF;

    -- 3. Get vencimentos
    v_vencimentos := get_vencimentos_as_dates(v_order.vencimentos);
    v_num_parcelas := array_length(v_vencimentos, 1);
    IF v_num_parcelas IS NULL OR v_num_parcelas = 0 THEN
        -- Fallback to default logic if no vencimentos specified
        v_vencimentos := ARRAY[
            (v_order.created_at::DATE + interval '3 month')::DATE,
            (v_order.created_at::DATE + interval '4 month')::DATE,
            (v_order.created_at::DATE + interval '5 month')::DATE
        ];
        v_num_parcelas := 3;
    END IF;

    -- 4. Get stores (from first sub_order)
    SELECT lojas_numeros INTO v_lojas_array FROM buy_order_sub_orders WHERE order_id = p_order_id LIMIT 1;
    v_num_lojas := COALESCE(jsonb_array_length(v_lojas_array), 1);
    
    v_valor_por_loja := v_order_total_value / v_num_lojas;
    v_valor_parcela := v_valor_por_loja / v_num_parcelas;

    -- 5. Create transactions for each store and each installment
    FOR v_loja IN SELECT * FROM jsonb_array_elements_text(v_lojas_array) LOOP
        FOREACH v_venc IN ARRAY v_vencimentos LOOP
            
            -- Ensure Quota Control exists for exact month/year
            SELECT id INTO v_qc_id FROM buyorder_quota_control 
            WHERE store_number = v_loja 
              AND year = EXTRACT(YEAR FROM v_venc) 
              AND month = EXTRACT(MONTH FROM v_venc);

            IF v_qc_id IS NULL THEN
                PERFORM inicializar_cotas_mes(EXTRACT(YEAR FROM v_venc)::INT, EXTRACT(MONTH FROM v_venc)::INT);
                SELECT id INTO v_qc_id FROM buyorder_quota_control 
                WHERE store_number = v_loja 
                  AND year = EXTRACT(YEAR FROM v_venc) 
                  AND month = EXTRACT(MONTH FROM v_venc);
            END IF;

            INSERT INTO buyorder_quota_transactions (
                quota_control_id,
                store_number,
                order_id,
                valor_abatido,
                tipo_comprador,
                vencimento_data,
                aplicado,
                descricao
            ) VALUES (
                v_qc_id,
                v_loja,
                p_order_id,
                v_valor_parcela,
                UPPER(v_order.tipo_comprador),
                v_venc,
                false,
                'Pedido #' || COALESCE(v_order.numero_pedido::TEXT, SUBSTRING(p_order_id::TEXT, 1, 8)) || ' (' || v_venc || ')'
            );
            v_count := v_count + 1;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'transactions_created', v_count);
END;
$$ LANGUAGE plpgsql;

-- 2.1 Updated inicializar_cotas_ano to match frontend signature
CREATE OR REPLACE FUNCTION inicializar_cotas_ano(p_start_year INT, p_start_month INT)
RETURNS JSONB AS $$
DECLARE
    v_date DATE := make_date(p_start_year, p_start_month, 1);
    v_month_date DATE;
    v_results JSONB := '[]'::jsonb;
BEGIN
    FOR i IN 0..11 LOOP
        v_month_date := v_date + (i || ' month')::INTERVAL;
        v_results := v_results || inicializar_cotas_mes(EXTRACT(YEAR FROM v_month_date)::INT, EXTRACT(MONTH FROM v_month_date)::INT);
    END LOOP;
    
    PERFORM reparar_transacoes_cotas();
    
    RETURN v_results;
END;
$$ LANGUAGE plpgsql;

-- 2.2 Maintenance: Re-trigger missing confirmed order transactions
CREATE OR REPLACE FUNCTION trigger_missing_order_deductions()
RETURNS INT AS $$
DECLARE
    r RECORD;
    v_count INT := 0;
BEGIN
    FOR r IN 
        SELECT id 
        FROM buy_orders bo 
        WHERE bo.status = 'confirmado' 
        AND NOT EXISTS (SELECT 1 FROM buyorder_quota_transactions qt WHERE qt.order_id = bo.id)
    LOOP
        PERFORM debitar_cota_pedido(r.id);
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Run maintenance
SELECT trigger_missing_order_deductions();

-- 3. Fixed get_pedidos_mes_detalhado: Uses buyorder_quota_transactions
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
    COALESCE((SELECT SUM(boi.total_pares * boi.custo) FROM buy_order_items boi WHERE boi.order_id = bo.id), 0) as valor_total,
    SUM(qt.valor_abatido) as valor_mes,
    bo.vencimentos
  FROM buy_orders bo
  JOIN buyorder_quota_transactions qt ON qt.order_id = bo.id
  WHERE bo.status = 'confirmado'
    AND UPPER(qt.tipo_comprador) = UPPER(p_tipo_comprador)
    AND qt.store_number = p_store_number
    AND EXTRACT(YEAR FROM qt.vencimento_data) = p_year
    AND EXTRACT(MONTH FROM qt.vencimento_data) = p_month
  GROUP BY bo.id, bo.numero_pedido, bo.marca, bo.user_name, bo.vencimentos;
END;
$$ LANGUAGE plpgsql;

-- 4. Fixed get_otb_disponivel_mes: Uses buyorder_quota_transactions
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
    
    -- Using the snapshot cota_limpa (Initial Quota - Initial Expenses)
    SELECT (COALESCE(cota_valor, 0) - COALESCE(despesas_comprometidas, 0))
    INTO v_cota_limpa_venc
    FROM buyorder_parameters_store
    WHERE store_number = p_store_number AND year = v_ano_venc AND month = v_mes_venc;
    
    v_cota_limpa_venc := COALESCE(v_cota_limpa_venc, 0) * v_percentual;
    
    -- SUM all transactions for that future month
    SELECT COALESCE(SUM(qt.valor_abatido), 0)
    INTO v_pedidos_venc
    FROM buyorder_quota_transactions qt
    WHERE qt.store_number = p_store_number
      AND EXTRACT(YEAR FROM qt.vencimento_data) = v_ano_venc
      AND EXTRACT(MONTH FROM qt.vencimento_data) = v_mes_venc
      AND UPPER(qt.tipo_comprador) = UPPER(p_tipo_comprador);
      
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

-- 5. Fixed get_cotas_ano_fiscal: Returns ALL fields needed by the React UI
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
  cota_gerente_valor NUMERIC,
  cota_comprador_valor NUMERIC,
  despesas_comprometidas NUMERIC,
  pedidos_confirmados NUMERIC,
  qtd_pedidos INTEGER,
  cota_futura_mes1 NUMERIC,
  cota_futura_mes2 NUMERIC,
  cota_futura_mes3 NUMERIC,
  otb_maximo_compravel_comprador NUMERIC,
  otb_maximo_compravel_gerente NUMERIC,
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
  v_otb_comp_res RECORD;
  v_otb_ger_res RECORD;
BEGIN
  v_current_date := v_date;
  WHILE v_current_date < v_end_date LOOP
    v_year := extract(year from v_current_date);
    v_month := extract(month from v_current_date);
    
    -- Calculate OTB
    SELECT * INTO v_otb_comp_res FROM get_otb_disponivel_mes(p_store_number, v_year, v_month, 'COMPRADOR');
    SELECT * INTO v_otb_ger_res FROM get_otb_disponivel_mes(p_store_number, v_year, v_month, 'GERENTE');
    
    RETURN QUERY
    WITH snapshot AS (
      SELECT 
        COALESCE(bps.cota_valor, 0) as cota_mensal,
        COALESCE(bps.cota_gerente_valor, 0) as cota_gerente_valor,
        COALESCE(bps.cota_comprador_valor, 0) as cota_comprador_valor,
        COALESCE(bps.despesas_comprometidas, 0) as despesas_comprometidas
      FROM buyorder_parameters_store bps
      WHERE bps.store_number = p_store_number AND bps.year = v_year AND bps.month = v_month
    ),
    trans_comp AS (
      SELECT 
        COALESCE(SUM(qt.valor_abatido), 0) as valor,
        COUNT(DISTINCT qt.order_id)::INTEGER as qtd
      FROM buyorder_quota_transactions qt
      WHERE qt.store_number = p_store_number AND EXTRACT(YEAR FROM qt.vencimento_data) = v_year AND EXTRACT(MONTH FROM qt.vencimento_data) = v_month AND UPPER(qt.tipo_comprador) = 'COMPRADOR'
    ),
    trans_ger AS (
      SELECT 
        COALESCE(SUM(qt.valor_abatido), 0) as valor,
        COUNT(DISTINCT qt.order_id)::INTEGER as qtd
      FROM buyorder_quota_transactions qt
      WHERE qt.store_number = p_store_number AND EXTRACT(YEAR FROM qt.vencimento_data) = v_year AND EXTRACT(MONTH FROM qt.vencimento_data) = v_month AND UPPER(qt.tipo_comprador) = 'GERENTE'
    )
    SELECT 
      v_month as mes,
      v_year as ano,
      COALESCE(s.cota_mensal, 0) as cota_mensal,
      (tc.valor + tg.valor) as cota_utilizada,
      (COALESCE(s.cota_mensal, 0) - COALESCE(s.despesas_comprometidas, 0) - (tc.valor + tg.valor)) as cota_disponivel,
      COALESCE(s.cota_gerente_valor, 0) as cota_gerente_valor,
      COALESCE(s.cota_comprador_valor, 0) as cota_comprador_valor,
      COALESCE(s.despesas_comprometidas, 0) as despesas_comprometidas,
      (tc.valor + tg.valor) as pedidos_confirmados,
      (tc.qtd + tg.qtd) as qtd_pedidos,
      -- OTB Details
      COALESCE((v_otb_comp_res.detalhes->0->>'disponivel')::NUMERIC, 0) as cota_futura_mes1,
      COALESCE((v_otb_comp_res.detalhes->1->>'disponivel')::NUMERIC, 0) as cota_futura_mes2,
      COALESCE((v_otb_comp_res.detalhes->2->>'disponivel')::NUMERIC, 0) as cota_futura_mes3,
      COALESCE(v_otb_comp_res.valor_maximo_compravel, 0) as otb_maximo_compravel_comprador,
      COALESCE(v_otb_ger_res.valor_maximo_compravel, 0) as otb_maximo_compravel_gerente,
      tc.valor as pedidos_futuros_comprador,
      tg.valor as pedidos_futuros_gerente,
      tc.qtd as qtd_pedidos_comprador,
      tg.qtd as qtd_pedidos_gerente
    FROM (SELECT 1) dummy
    LEFT JOIN snapshot s ON true
    CROSS JOIN trans_comp tc
    CROSS JOIN trans_ger tg;

    v_current_date := v_current_date + interval '1 month';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Final repair call to fix Store 96 if needed
SELECT reparar_transacoes_cotas();
