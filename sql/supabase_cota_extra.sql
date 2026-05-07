-- 1. Tabela buyorder_quota_extra
CREATE TABLE IF NOT EXISTS buyorder_quota_extra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  store_number TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  tipo_comprador VARCHAR(20) NOT NULL CHECK (UPPER(tipo_comprador) IN ('GERENTE', 'COMPRADOR')),
  
  -- Valor e Pedido
  valor_extra NUMERIC(12,2) NOT NULL,
  order_id UUID REFERENCES buy_orders(id) ON DELETE SET NULL,
  
  -- Solicitação
  solicitado_por UUID NOT NULL REFERENCES admin_users(id),
  motivo TEXT NOT NULL,
  
  -- Status e Aprovação
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' 
    CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'usado')),
  aprovado_por UUID REFERENCES admin_users(id),
  aprovado_em TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quota_extra_status ON buyorder_quota_extra(status);
CREATE INDEX IF NOT EXISTS idx_quota_extra_order ON buyorder_quota_extra(order_id);

-- 2. RPCs

CREATE OR REPLACE FUNCTION request_quota_extra(
  p_store_number TEXT,
  p_month INTEGER,
  p_year INTEGER,
  p_tipo_comprador VARCHAR,
  p_valor_extra NUMERIC,
  p_motivo TEXT,
  p_order_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
BEGIN
  INSERT INTO buyorder_quota_extra (
    store_number, year, month, tipo_comprador,
    valor_extra, order_id, solicitado_por, motivo
  ) VALUES (
    p_store_number, p_year, p_month, p_tipo_comprador,
    p_valor_extra, p_order_id, p_user_id, p_motivo
  );
  
  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION approve_reject_quota_extra(
  p_extra_id UUID,
  p_admin_id UUID,
  p_action VARCHAR -- 'aprovar' ou 'rejeitar'
)
RETURNS JSONB AS $$
BEGIN
  IF p_action = 'aprovar' THEN
    UPDATE buyorder_quota_extra
    SET status = 'aprovado', aprovado_por = p_admin_id, aprovado_em = NOW()
    WHERE id = p_extra_id AND status = 'pendente';
  ELSE
    UPDATE buyorder_quota_extra
    SET status = 'rejeitado', aprovado_por = p_admin_id, aprovado_em = NOW()
    WHERE id = p_extra_id AND status = 'pendente';
  END IF;
  
  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION mark_quota_extra_as_used(
  p_order_id UUID
)
RETURNS JSONB AS $$
BEGIN
  UPDATE buyorder_quota_extra
  SET status = 'usado'
  WHERE order_id = p_order_id AND status = 'aprovado';
  
  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION release_quota_extra_on_cancel(
  p_order_id UUID
)
RETURNS JSONB AS $$
BEGIN
  UPDATE buyorder_quota_extra
  SET status = 'aprovado' -- volta para aprovado (disponível)
  WHERE order_id = p_order_id AND status = 'usado';
  
  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- NOVA RPC DE VALIDAÇÃO DUPLA DE COTA (ENTREGA + PAGAMENTO) ATUALIZADA
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
  v_extra_aprovado NUMERIC := 0;  -- ✨ NOVO
  v_parcela NUMERIC := p_order_value / NULLIF(array_length(p_payment_months, 1), 0);
  v_mes_venc INTEGER;
  v_cota_disponivel NUMERIC;
  v_all_payments_ok BOOLEAN := TRUE;
  v_failed_month INTEGER;
  v_failed_available NUMERIC;
BEGIN
  IF v_parcela IS NULL THEN
    v_parcela := p_order_value;
  END IF;
  
  -- =========================================
  -- VALIDAÇÃO 1: CAPACIDADE DE ENTREGA
  -- =========================================
  
  -- 1.1) Buscar cota disponível do mês de ENTREGA
  IF UPPER(p_user_role) = 'GERENTE' THEN
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

  -- ✨ SOMAR cotas extras aprovadas (status = 'aprovado')
  -- Verifica tanto lowercase quanto uppercase
  SELECT COALESCE(SUM(valor_extra), 0) INTO v_extra_aprovado
  FROM buyorder_quota_extra
  WHERE store_number = p_store_number
    AND year = p_delivery_year
    AND month = p_delivery_month
    AND UPPER(tipo_comprador) = UPPER(p_user_role)
    AND status = 'aprovado';

  -- ✨ Capacidade total = cota normal + extras
  v_delivery_capacity := COALESCE(v_delivery_capacity, 0) + v_extra_aprovado;
  
  IF v_delivery_capacity = 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'COTA_NAO_ENCONTRADA',
      'message', format('Cota não encontrada ou zerada para %s/%s', p_delivery_month, p_delivery_year)
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
    AND UPPER(bo.user_role) = UPPER(p_user_role)
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
      'ano_entrega', p_delivery_year,
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
    IF UPPER(p_user_role) = 'GERENTE' THEN
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
    'cota_extra_aprovada', v_extra_aprovado,
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
