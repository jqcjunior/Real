CREATE OR REPLACE FUNCTION abater_cota_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_lojas_array TEXT[];
  v_loja_num TEXT;
  v_year INT;
  v_month INT;
  v_valor_total DECIMAL(12,2);
  v_quota_id UUID;
  v_user_role TEXT;
  v_tipo_comprador VARCHAR(20);
BEGIN
  -- Extrair ano/mês
  v_year := EXTRACT(YEAR FROM NOW())::INT;
  v_month := EXTRACT(MONTH FROM NOW())::INT;
  
  -- Calcular valor total
  v_valor_total := COALESCE(NEW.total_pares, 1) * COALESCE(NEW.preco_venda, 0);
  
  IF v_valor_total <= 0 THEN
    RETURN NEW;
  END IF;
  
  -- Buscar role do usuário que criou o pedido
  SELECT user_role INTO v_user_role
  FROM buy_orders
  WHERE id = NEW.order_id;
  
  -- Determinar tipo de comprador
  v_tipo_comprador := CASE 
    WHEN v_user_role IN ('GERENTE', 'MANAGER') THEN 'GERENTE'
    ELSE 'COMPRADOR'
  END;
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- FIX: Agregação correta de lojas (consolidar TODOS os sub_orders)
  -- ═══════════════════════════════════════════════════════════════════════════
  SELECT ARRAY_AGG(DISTINCT loja)
  INTO v_lojas_array
  FROM (
    SELECT unnest(lojas_numeros) as loja
    FROM buy_order_sub_orders
    WHERE order_id = NEW.order_id
  ) sub;
  
  IF v_lojas_array IS NULL OR array_length(v_lojas_array, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Para cada loja, abater da cota correta
  FOREACH v_loja_num IN ARRAY v_lojas_array
  LOOP
    -- Buscar ID da cota
    SELECT id INTO v_quota_id
    FROM buyorder_quota_control
    WHERE store_number = v_loja_num
      AND year = v_year
      AND month = v_month;
    
    -- Se não existe, criar
    IF v_quota_id IS NULL THEN
      INSERT INTO buyorder_quota_control (store_number, year, month)
      VALUES (v_loja_num, v_year, v_month)
      RETURNING id INTO v_quota_id;
    END IF;
    
    -- Abater da cota correta (Gerente ou Comprador)
    IF v_tipo_comprador = 'GERENTE' THEN
      UPDATE buyorder_quota_control
      SET cota_gerente_utilizada = COALESCE(cota_gerente_utilizada, 0) + v_valor_total,
          cota_utilizada = COALESCE(cota_utilizada, 0) + v_valor_total,
          updated_at = NOW()
      WHERE id = v_quota_id;
    ELSE
      UPDATE buyorder_quota_control
      SET cota_comprador_utilizada = COALESCE(cota_comprador_utilizada, 0) + v_valor_total,
          cota_utilizada = COALESCE(cota_utilizada, 0) + v_valor_total,
          updated_at = NOW()
      WHERE id = v_quota_id;
    END IF;
    
    -- Registrar transação
    INSERT INTO buyorder_quota_transactions (
      quota_control_id,
      order_id,
      item_id,
      valor_abatido,
      tipo_comprador,
      descricao
    ) VALUES (
      v_quota_id,
      NEW.order_id,
      NEW.id,
      v_valor_total,
      v_tipo_comprador,
      v_tipo_comprador || ': ' || NEW.referencia || ' (' || NEW.total_pares || ' pares × R$ ' || NEW.preco_venda || ')'
    );
    
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
