-- ============================================================================
-- NOVA RPC DE VALIDAÇÃO DUPLA DE COTA (ENTREGA + PAGAMENTO)
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_order_capacity_v2(
  p_store_number TEXT,
  p_delivery_month INTEGER,      -- Mês de ENTREGA (fat_fim)
  p_delivery_year INTEGER,
  p_payment_months INTEGER[],     -- [9, 10, 11] - Meses dos vencimentos
  p_payment_year INTEGER,
  p_order_value NUMERIC,
  p_user_role VARCHAR,            -- 'gerente' ou 'comprador'
  p_exclude_order_id UUID DEFAULT NULL  -- Para edição: excluir pedido atual do cálculo
)
RETURNS JSONB AS $$
DECLARE
  v_delivery_capacity NUMERIC;
  v_delivery_used NUMERIC;
  v_delivery_available NUMERIC;
  v_parcela NUMERIC := p_order_value / 3;
  v_mes_venc INTEGER;
  v_cota_disponivel NUMERIC;
  v_all_payments_ok BOOLEAN := TRUE;
  v_failed_month INTEGER;
  v_failed_available NUMERIC;
BEGIN
  
  -- =========================================
  -- VALIDAÇÃO 1: CAPACIDADE DE ENTREGA
  -- =========================================
  
  -- 1.1) Buscar cota disponível do mês de ENTREGA
  IF p_user_role = 'GERENTE' THEN
    SELECT cota_gerente_disponivel INTO v_delivery_capacity
    FROM buyorder_quota_control
    WHERE store_number = p_store_number
      AND year = p_delivery_year
      AND month = p_delivery_month;
  ELSE
    SELECT cota_comprador_disponivel INTO v_delivery_capacity
    FROM buyorder_quota_control
    WHERE store_number = p_store_number
      AND year = p_delivery_year
      AND month = p_delivery_month;
  END IF;
  
  IF v_delivery_capacity IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'COTA_NAO_ENCONTRADA',
      'message', format('Cota não encontrada para %s/%s', p_delivery_month, p_delivery_year)
    );
  END IF;
  
  -- 1.2) Calcular quanto JÁ está comprometido para entrega naquele mês
  SELECT COALESCE(SUM(
    boi.total_pares * boi.custo * (1 - COALESCE(bo.desconto, 0) / 100)
  ), 0) INTO v_delivery_used
  FROM buy_orders bo
  JOIN buy_order_sub_orders bos ON bo.id = bos.order_id
  JOIN buy_order_items boi ON bo.id = boi.order_id
  WHERE bos.store_number = p_store_number
    AND bo.status IN ('stand_by', 'confirmado')
    AND EXTRACT(MONTH FROM bo.fat_fim) = p_delivery_month
    AND EXTRACT(YEAR FROM bo.fat_fim) = p_delivery_year
    AND bo.user_role = p_user_role
    AND (p_exclude_order_id IS NULL OR bo.id != p_exclude_order_id);
  
  v_delivery_available := v_delivery_capacity - v_delivery_used;
  
  -- 1.3) Verificar se o NOVO pedido cabe no mês de entrega
  IF p_order_value > v_delivery_available THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'CAPACIDADE_ENTREGA_INSUFICIENTE',
      'message', format(
        'Mês de entrega %s/%s não suporta R$ %.2f. Disponível: R$ %.2f',
        p_delivery_month,
        p_delivery_year,
        p_order_value,
        v_delivery_available
      ),
      'tipo_validacao', 'ENTREGA',
      'mes_entrega', p_delivery_month,
      'capacidade_disponivel', v_delivery_available,
      'valor_pedido', p_order_value,
      'deficit', p_order_value - v_delivery_available
    );
  END IF;
  
  -- =========================================
  -- VALIDAÇÃO 2: CAPACIDADE DE PAGAMENTO
  -- =========================================
  
  FOREACH v_mes_venc IN ARRAY p_payment_months LOOP
    
    -- Buscar cota disponível do mês de PAGAMENTO
    IF p_user_role = 'GERENTE' THEN
      SELECT cota_gerente_disponivel INTO v_cota_disponivel
      FROM buyorder_quota_control
      WHERE store_number = p_store_number
        AND year = p_payment_year
        AND month = v_mes_venc;
    ELSE
      SELECT cota_comprador_disponivel INTO v_cota_disponivel
      FROM buyorder_quota_control
      WHERE store_number = p_store_number
        AND year = p_payment_year
        AND month = v_mes_venc;
    END IF;
    
    IF v_cota_disponivel IS NULL THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'COTA_PAGAMENTO_NAO_ENCONTRADA',
        'message', format('Cota de pagamento não encontrada para %s/%s', v_mes_venc, p_payment_year),
        'mes_vencimento', v_mes_venc
      );
    END IF;
    
    -- Verificar se a PARCELA cabe no mês de vencimento
    IF v_parcela > v_cota_disponivel THEN
      v_all_payments_ok := FALSE;
      v_failed_month := v_mes_venc;
      v_failed_available := v_cota_disponivel;
      EXIT; -- Sair do loop
    END IF;
    
  END LOOP;
  
  -- Se algum mês de pagamento falhou
  IF NOT v_all_payments_ok THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'CAPACIDADE_PAGAMENTO_INSUFICIENTE',
      'message', format(
        'Mês de pagamento %s/%s não suporta parcela de R$ %.2f. Disponível: R$ %.2f',
        v_failed_month,
        p_payment_year,
        v_parcela,
        v_failed_available
      ),
      'tipo_validacao', 'PAGAMENTO',
      'mes_vencimento', v_failed_month,
      'capacidade_disponivel', v_failed_available,
      'valor_parcela', v_parcela,
      'deficit', v_parcela - v_failed_available
    );
  END IF;
  
  -- =========================================
  -- SUCESSO: AMBAS VALIDAÇÕES PASSARAM
  -- =========================================
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Capacidade validada com sucesso',
    'entrega', jsonb_build_object(
      'mes', p_delivery_month,
      'ano', p_delivery_year,
      'disponivel', v_delivery_available,
      'valor_pedido', p_order_value,
      'sobra_apos_pedido', v_delivery_available - p_order_value
    ),
    'pagamentos', jsonb_build_object(
      'meses', p_payment_months,
      'ano', p_payment_year,
      'valor_parcela', v_parcela,
      'todos_ok', TRUE
    )
  );
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
