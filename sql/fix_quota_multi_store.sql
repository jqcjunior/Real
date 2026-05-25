ALTER TABLE buy_order_sub_orders
ADD COLUMN IF NOT EXISTS total_pares INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(12,2) DEFAULT 0;

UPDATE buy_order_sub_orders s
SET 
  total_pares = COALESCE((SELECT SUM(b.total_pares) FROM buy_order_items b WHERE b.order_id = s.order_id) * COALESCE(array_length(lojas_numeros, 1), 0) / NULLIF((SELECT SUM(COALESCE(array_length(s2.lojas_numeros, 1), 0)) FROM buy_order_sub_orders s2 WHERE s2.order_id = s.order_id), 0), 0),
  valor_bruto = COALESCE((SELECT SUM(b.total_pares * b.custo) FROM buy_order_items b WHERE b.order_id = s.order_id) * COALESCE(array_length(lojas_numeros, 1), 0) / NULLIF((SELECT SUM(COALESCE(array_length(s2.lojas_numeros, 1), 0)) FROM buy_order_sub_orders s2 WHERE s2.order_id = s.order_id), 0), 0)
WHERE total_pares = 0 AND (valor_bruto = 0 OR valor_bruto IS NULL);

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

CREATE OR REPLACE FUNCTION debitar_cota_pedido(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_order_total_value DECIMAL(12,2);
    v_vencimentos DATE[];
    v_num_parcelas INT;
    v_loja TEXT;
    v_num_lojas INT;
    v_valor_por_loja DECIMAL(12,2);
    v_valor_parcela DECIMAL(12,2);
    v_venc DATE;
    v_qc_id UUID;
    v_count INT := 0;
    r_sub RECORD;
BEGIN
    -- 1. Get order data
    SELECT * INTO v_order FROM buy_orders WHERE id = p_order_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Pedido não encontrado'); END IF;

    -- 2. Calculate total value from items
    SELECT SUM(total_pares * custo) INTO v_order_total_value FROM buy_order_items WHERE order_id = p_order_id;
    v_order_total_value := COALESCE(v_order_total_value, 0);
    IF v_order_total_value <= 0 THEN RETURN jsonb_build_object('success', true, 'message', 'Valor zero, sem débitos'); END IF;

    -- Apply discount if any (fix for total order amount with discount)
    v_order_total_value := v_order_total_value * (1 - COALESCE(v_order.desconto, 0) / 100.0);

    -- 3. Get vencimentos
    v_vencimentos := get_vencimentos_as_dates(v_order.vencimentos);
    v_num_parcelas := array_length(v_vencimentos, 1);
    IF v_num_parcelas IS NULL OR v_num_parcelas = 0 THEN
        v_vencimentos := ARRAY[
            (v_order.created_at::DATE + interval '3 month')::DATE,
            (v_order.created_at::DATE + interval '4 month')::DATE,
            (v_order.created_at::DATE + interval '5 month')::DATE
        ];
        v_num_parcelas := 3;
    END IF;

    -- 4. Loop over each sub-order to calculate exact costs per store for that specific sub-order
    DELETE FROM buyorder_quota_transactions WHERE order_id = p_order_id;
    
    FOR r_sub IN 
        SELECT id, lojas_numeros, valor_bruto
        FROM buy_order_sub_orders
        WHERE order_id = p_order_id
    LOOP
        v_num_lojas := COALESCE(array_length(r_sub.lojas_numeros, 1), 0);
        IF v_num_lojas > 0 THEN
            -- Valor bruto per store in this sub-order, applying global order discount
            v_valor_por_loja := (r_sub.valor_bruto * (1 - COALESCE(v_order.desconto, 0) / 100.0)) / v_num_lojas;
            v_valor_parcela := v_valor_por_loja / v_num_parcelas;
            
            FOR v_loja IN SELECT unnest(r_sub.lojas_numeros)::TEXT LOOP
                FOREACH v_venc IN ARRAY v_vencimentos LOOP
                    
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
                        quota_control_id, store_number, order_id, valor_abatido,
                        tipo_comprador, vencimento_data, aplicado, descricao
                    ) VALUES (
                        v_qc_id, v_loja, p_order_id, v_valor_parcela,
                        UPPER(v_order.tipo_comprador), v_venc, false,
                        'Pedido #' || COALESCE(v_order.numero_pedido::TEXT, SUBSTRING(p_order_id::TEXT, 1, 8)) || ' (' || v_venc || ')'
                    );
                    v_count := v_count + 1;
                END LOOP;
            END LOOP;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'transactions_created', v_count);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reprocess_all_confirmations()
RETURNS INT AS $$
DECLARE
    r RECORD;
    v_count INT := 0;
BEGIN
    FOR r IN 
        SELECT id 
        FROM buy_orders bo 
        WHERE bo.status = 'confirmado' 
    LOOP
        PERFORM debitar_cota_pedido(r.id);
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Executa o reparo
SELECT reprocess_all_confirmations();
