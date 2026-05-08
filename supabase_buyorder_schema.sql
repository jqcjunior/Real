-- ==========================================
-- SISTEMA DE PARÂMETROS E COTAS DE COMPRAS
-- ==========================================

-- 1. Parâmetros Globais
CREATE TABLE IF NOT EXISTS buyorder_parameters_global (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    feminino_pct DECIMAL(5,2) DEFAULT 40.00,
    infantil_menina_pct DECIMAL(5,2) DEFAULT 10.00,
    infantil_menino_pct DECIMAL(5,2) DEFAULT 10.00,
    masculino_pct DECIMAL(5,2) DEFAULT 20.00,
    acessorio_pct DECIMAL(5,2) DEFAULT 20.00,
    sub_metas JSONB DEFAULT '{}'::jsonb,
    cota_default DECIMAL(12,2) DEFAULT 50000.00,
    cota_gerente_pct DECIMAL(5,2) DEFAULT 50.00,
    cota_comprador_pct DECIMAL(5,2) DEFAULT 50.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(year, month)
);

-- 2. Parâmetros por Loja
CREATE TABLE IF NOT EXISTS buyorder_parameters_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_number TEXT NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    feminino_pct DECIMAL(5,2),
    infantil_menina_pct DECIMAL(5,2),
    infantil_menino_pct DECIMAL(5,2),
    masculino_pct DECIMAL(5,2),
    acessorio_pct DECIMAL(5,2),
    cota_gerente_pct DECIMAL(5,2),
    cota_comprador_pct DECIMAL(5,2),
    sub_metas JSONB,
    cota_valor DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(store_number, year, month)
);

-- 3. Controle de Cotas (OTB)
CREATE TABLE IF NOT EXISTS buyorder_quota_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_number TEXT NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    cota_inicial DECIMAL(12,2) NOT NULL,
    cota_utilizada DECIMAL(12,2) DEFAULT 0,
    cota_gerente_inicial DECIMAL(12,2) DEFAULT 0,
    cota_gerente_utilizada DECIMAL(12,2) DEFAULT 0,
    cota_comprador_inicial DECIMAL(12,2) DEFAULT 0,
    cota_comprador_utilizada DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(store_number, year, month)
);

-- Virtual columns (views or generated columns in PG12+)
ALTER TABLE buyorder_quota_control ADD COLUMN IF NOT EXISTS cota_disponivel DECIMAL(12,2) GENERATED ALWAYS AS (cota_inicial - cota_utilizada) STORED;
ALTER TABLE buyorder_quota_control ADD COLUMN IF NOT EXISTS cota_gerente_disponivel DECIMAL(12,2) GENERATED ALWAYS AS (cota_gerente_inicial - cota_gerente_utilizada) STORED;
ALTER TABLE buyorder_quota_control ADD COLUMN IF NOT EXISTS cota_comprador_disponivel DECIMAL(12,2) GENERATED ALWAYS AS (cota_comprador_inicial - cota_comprador_utilizada) STORED;
ALTER TABLE buyorder_quota_control ADD COLUMN IF NOT EXISTS percentual_utilizado DECIMAL(12,2) GENERATED ALWAYS AS (CASE WHEN cota_inicial = 0 THEN 0 ELSE (cota_utilizada / cota_inicial) * 100 END) STORED;
ALTER TABLE buyorder_quota_control ADD COLUMN IF NOT EXISTS status TEXT GENERATED ALWAYS AS (
    CASE 
        WHEN (cota_utilizada / NULLIF(cota_inicial,0)) >= 1.0 THEN 'ESGOTADO'
        WHEN (cota_utilizada / NULLIF(cota_inicial,0)) >= 0.9 THEN 'CRÍTICO'
        WHEN (cota_utilizada / NULLIF(cota_inicial,0)) >= 0.75 THEN 'ATENÇÃO'
        ELSE 'OK'
    END
) STORED;

-- 4. Log de Transações
CREATE TABLE IF NOT EXISTS buyorder_quota_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quota_control_id UUID REFERENCES buyorder_quota_control(id),
    store_number TEXT, -- Adicionado para facilitar filtros por loja em vencimentos futuros
    order_id UUID NOT NULL, -- FK para buy_orders (assumindo UUID)
    item_id UUID,          -- FK para buy_order_items (se houver)
    valor_abatido DECIMAL(12,2) NOT NULL,
    tipo_comprador VARCHAR(20) NOT NULL DEFAULT 'COMPRADOR',
    vencimento_data DATE,
    aplicado BOOLEAN DEFAULT true,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna se não existir (para bancos legados)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='buyorder_quota_transactions' AND column_name='store_number') THEN
        ALTER TABLE buyorder_quota_transactions ADD COLUMN store_number TEXT;
    END IF;
END $$;

-- 5. Função para Inicializar Cotas (Melhorada para garantir sincronia com parâmetros)
CREATE OR REPLACE FUNCTION inicializar_cotas_mes(p_year INT, p_month INT)
RETURNS JSONB AS $$
DECLARE
    v_count INT := 0;
    v_global RECORD;
    v_store RECORD;
    v_cota_inicial DECIMAL(12,2);
    v_gerente_pct DECIMAL(5,2);
    v_comprador_pct DECIMAL(5,2);
BEGIN
    -- Busca parâmetros globais
    SELECT * INTO v_global FROM buyorder_parameters_global WHERE year = p_year AND month = p_month;
    
    -- Itera sobre lojas ativas (da tabela 'stores')
    FOR v_store IN SELECT number FROM stores WHERE is_active = true LOOP
        
        -- Busca parâmetros específicos da loja (Normalizando store_number para evitar problema de zero à esquerda)
        SELECT cota_valor, cota_gerente_pct, cota_comprador_pct 
        INTO v_cota_inicial, v_gerente_pct, v_comprador_pct
        FROM buyorder_parameters_store 
        WHERE (store_number::INTEGER = v_store.number::INTEGER) 
          AND year = p_year 
          AND month = p_month;

        -- Se não houver parâmetros específicos, usa globais
        IF v_cota_inicial IS NULL AND v_global IS NOT NULL THEN
            v_cota_inicial := v_global.cota_default;
            v_gerente_pct := v_global.cota_gerente_pct;
            v_comprador_pct := v_global.cota_comprador_pct;
        END IF;

        -- Fallback se tudo falhar
        v_cota_inicial := COALESCE(v_cota_inicial, 0);
        v_gerente_pct := COALESCE(v_gerente_pct, 80);
        v_comprador_pct := COALESCE(v_comprador_pct, 20);
                        
        INSERT INTO buyorder_quota_control (store_number, year, month, cota_inicial, cota_gerente_inicial, cota_comprador_inicial)
        VALUES (
            v_store.number, 
            p_year, 
            p_month, 
            v_cota_inicial,
            (v_cota_inicial * v_gerente_pct / 100),
            (v_cota_inicial * v_comprador_pct / 100)
        )
        ON CONFLICT (store_number, year, month) DO UPDATE 
        SET cota_inicial = EXCLUDED.cota_inicial,
            cota_gerente_inicial = EXCLUDED.cota_gerente_inicial,
            cota_comprador_inicial = EXCLUDED.cota_comprador_inicial;
        
        -- Normalizar também o store_number da tabela de controle para o formato da tabela de lojas
        UPDATE buyorder_quota_control SET store_number = v_store.number 
        WHERE store_number::INTEGER = v_store.number::INTEGER;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$ LANGUAGE plpgsql;

-- 6. Triggers de Validação e Sincronização
CREATE OR REPLACE FUNCTION validate_quota_split()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.cota_gerente_pct + NEW.cota_comprador_pct) != 100.00 THEN
    RAISE EXCEPTION 'A soma de cota_gerente_pct (%) + cota_comprador_pct (%) deve ser 100%%';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar parâmetros com controle de quotas automaticamente
CREATE OR REPLACE FUNCTION sync_params_to_quota_control()
RETURNS TRIGGER AS $$
DECLARE
    v_gerente_valor DECIMAL(12,2);
    v_comprador_valor DECIMAL(12,2);
    v_normalized_store TEXT;
BEGIN
    -- Normalizar store_number baseado na tabela de lojas
    SELECT number INTO v_normalized_store FROM stores WHERE number::INTEGER = NEW.store_number::INTEGER LIMIT 1;
    v_normalized_store := COALESCE(v_normalized_store, NEW.store_number);

    v_gerente_valor := (COALESCE(NEW.cota_valor, 0) * COALESCE(NEW.cota_gerente_pct, 0) / 100);
    v_comprador_valor := (COALESCE(NEW.cota_valor, 0) * COALESCE(NEW.cota_comprador_pct, 0) / 100);

    INSERT INTO buyorder_quota_control (store_number, year, month, cota_inicial, cota_gerente_inicial, cota_comprador_inicial)
    VALUES (v_normalized_store, NEW.year, NEW.month, COALESCE(NEW.cota_valor, 0), v_gerente_valor, v_comprador_valor)
    ON CONFLICT (store_number, year, month) DO UPDATE 
    SET cota_inicial = EXCLUDED.cota_inicial,
        cota_gerente_inicial = EXCLUDED.cota_gerente_inicial,
        cota_comprador_inicial = EXCLUDED.cota_comprador_inicial;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_params_to_quota ON buyorder_parameters_store;
CREATE TRIGGER trg_sync_params_to_quota
AFTER INSERT OR UPDATE ON buyorder_parameters_store
FOR EACH ROW
EXECUTE FUNCTION sync_params_to_quota_control();

-- Função para Inicializar Cotas para um ANO INTEIRO
CREATE OR REPLACE FUNCTION inicializar_cotas_ano(p_year INT)
RETURNS JSONB AS $$
DECLARE
    v_month INT;
    v_results JSONB := '[]'::jsonb;
BEGIN
    FOR v_month IN 1..12 LOOP
        v_results := v_results || inicializar_cotas_mes(p_year, v_month);
    END LOOP;
    
    -- Após inicializar o ano, repara as transações para vincular pedidos órfãos
    PERFORM reparar_transacoes_cotas();
    
    RETURN v_results;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_quota_split_global ON buyorder_parameters_global;
CREATE TRIGGER check_quota_split_global
BEFORE INSERT OR UPDATE ON buyorder_parameters_global
FOR EACH ROW
EXECUTE FUNCTION validate_quota_split();

DROP TRIGGER IF EXISTS check_quota_split_store ON buyorder_parameters_store;
CREATE TRIGGER check_quota_split_store
BEFORE INSERT OR UPDATE ON buyorder_parameters_store
FOR EACH ROW
WHEN (NEW.cota_gerente_pct IS NOT NULL AND NEW.cota_comprador_pct IS NOT NULL)
EXECUTE FUNCTION validate_quota_split();

-- Gatilho para limpar transações de cota ao excluir um pedido
CREATE OR REPLACE FUNCTION clean_order_quota_transactions()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM buyorder_quota_transactions WHERE order_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_order_quota ON buy_orders;
CREATE TRIGGER trg_clean_order_quota
BEFORE DELETE ON buy_orders
FOR EACH ROW
EXECUTE FUNCTION clean_order_quota_transactions();

-- 7. Log de Execuções do Cron (Monitoramento)
CREATE TABLE IF NOT EXISTS buyorder_cron_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    execution_time TIMESTAMPTZ DEFAULT now(),
    total_aplicado BIGINT DEFAULT 0,
    valor_total DECIMAL(12,2) DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    execution_duration_ms INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- View para Estatísticas
CREATE OR REPLACE VIEW v_cron_statistics AS
SELECT 
  DATE(execution_time) as dia,
  COUNT(*) as total_execucoes,
  SUM(total_aplicado) as total_abatimentos,
  SUM(valor_total) as valor_total_abatido,
  COUNT(*) FILTER (WHERE success = true) as execucoes_sucesso,
  COUNT(*) FILTER (WHERE success = false) as execucoes_erro,
  ROUND(AVG(execution_duration_ms)::NUMERIC, 2) as tempo_medio_ms,
  MAX(execution_duration_ms) as tempo_maximo_ms,
  MIN(execution_duration_ms) as tempo_minimo_ms
FROM buyorder_cron_logs
GROUP BY DATE(execution_time);

-- 8. Função para Aplicar Abatimentos (CRON)
CREATE OR REPLACE FUNCTION aplicar_abatimentos_vencidos()
RETURNS jsonb AS $$
DECLARE
    r RECORD;
    v_qc_id UUID;
    v_ano INT := EXTRACT(YEAR FROM CURRENT_DATE);
    v_mes INT := EXTRACT(MONTH FROM CURRENT_DATE);
    v_count INT := 0;
    v_total_valor DECIMAL(12,2) := 0;
    v_start_time TIMESTAMPTZ := clock_timestamp();
    v_end_time TIMESTAMPTZ;
    v_duration_ms INT;
    v_error TEXT;
BEGIN
    FOR r IN 
        SELECT pqt.id, pqt.valor_abatido, pqt.tipo_comprador, COALESCE(pqt.store_number, pqc.store_number) as store_number, pqt.vencimento_data
        FROM buyorder_quota_transactions pqt
        LEFT JOIN buyorder_quota_control pqc ON pqt.quota_control_id = pqc.id
        WHERE pqt.aplicado = false AND pqt.vencimento_data <= CURRENT_DATE
    LOOP
        -- Find the quota control for the month/year of the TRANSACTION
        SELECT id INTO v_qc_id
        FROM buyorder_quota_control
        WHERE store_number = r.store_number 
          AND year = EXTRACT(YEAR FROM r.vencimento_data) 
          AND month = EXTRACT(MONTH FROM r.vencimento_data);

        -- If it doesn't exist, we skip for now
        IF FOUND THEN
            -- Update utilized values
            IF r.tipo_comprador = 'GERENTE' THEN
                UPDATE buyorder_quota_control
                SET cota_gerente_utilizada = cota_gerente_utilizada + r.valor_abatido,
                    cota_utilizada = cota_utilizada + r.valor_abatido
                WHERE id = v_qc_id;
            ELSE
                UPDATE buyorder_quota_control
                SET cota_comprador_utilizada = cota_comprador_utilizada + r.valor_abatido,
                    cota_utilizada = cota_utilizada + r.valor_abatido
                WHERE id = v_qc_id;
            END IF;

            -- Mark transaction as applied
            UPDATE buyorder_quota_transactions
            SET aplicado = true
            WHERE id = r.id;

            v_count := v_count + 1;
            v_total_valor := v_total_valor + r.valor_abatido;
        END IF;
    END LOOP;

    v_end_time := clock_timestamp();
    v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time));
    
    INSERT INTO buyorder_cron_logs (job_name, execution_time, total_aplicado, valor_total, success, execution_duration_ms)
    VALUES ('aplicar-abatimentos-cotas', v_start_time, v_count, v_total_valor, true, v_duration_ms);

    RETURN jsonb_build_object('success', true, 'applied_count', v_count, 'total_value', v_total_valor, 'duration_ms', v_duration_ms);
EXCEPTION WHEN OTHERS THEN
    v_end_time := clock_timestamp();
    v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time));
    v_error := SQLERRM;
    
    INSERT INTO buyorder_cron_logs (job_name, execution_time, total_aplicado, valor_total, success, error_message, execution_duration_ms)
    VALUES ('aplicar-abatimentos-cotas', v_start_time, v_count, v_total_valor, false, v_error, v_duration_ms);
    
    RETURN jsonb_build_object('success', false, 'error', v_error, 'duration_ms', v_duration_ms);
END;
$$ LANGUAGE plpgsql;

-- 9. Função de Limpeza de Logs Antigos
CREATE OR REPLACE FUNCTION cleanup_old_cron_logs()
RETURNS INT AS $$
DECLARE
    v_deleted INT;
BEGIN
    WITH deleted AS (
        DELETE FROM buyorder_cron_logs
        WHERE execution_time < CURRENT_DATE - INTERVAL '90 days'
        RETURNING 1
    )
    SELECT count(*) INTO v_deleted FROM deleted;
    
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- 10. Relatórios e Views Consolidadas

CREATE OR REPLACE VIEW v_quota_otb_report AS
SELECT 
    pqc.store_number,
    s.name as store_name,
    s.city,
    pqc.year,
    pqc.month,
    pqc.cota_inicial,
    pqc.cota_utilizada,
    pqc.cota_disponivel,
    pqc.percentual_utilizado,
    pqc.status,
    pqc.cota_gerente_inicial as gerente_inicial,
    pqc.cota_gerente_utilizada as gerente_utilizada,
    CASE WHEN pqc.cota_gerente_inicial > 0 THEN ROUND((pqc.cota_gerente_utilizada / pqc.cota_gerente_inicial) * 100, 2) ELSE 0 END as gerente_pct,
    pqc.cota_comprador_inicial as comprador_inicial,
    pqc.cota_comprador_utilizada as comprador_utilizada,
    CASE WHEN pqc.cota_comprador_inicial > 0 THEN ROUND((pqc.cota_comprador_utilizada / pqc.cota_comprador_inicial) * 100, 2) ELSE 0 END as comprador_pct,
    (SELECT COALESCE(SUM(valor_abatido), 0) FROM buyorder_quota_transactions WHERE quota_control_id = pqc.id AND tipo_comprador = 'GERENTE' AND aplicado = false) as gerente_comprometido,
    (SELECT COALESCE(SUM(valor_abatido), 0) FROM buyorder_quota_transactions WHERE quota_control_id = pqc.id AND tipo_comprador = 'COMPRADOR' AND aplicado = false) as comprador_comprometido,
    (SELECT COUNT(*) FROM buyorder_quota_transactions WHERE quota_control_id = pqc.id AND aplicado = false) as alertas_ativos
FROM buyorder_quota_control pqc
LEFT JOIN stores s ON pqc.store_number = s.number;

CREATE OR REPLACE VIEW v_abatimentos_por_loja AS
SELECT 
    pqc.store_number,
    s.name as store_name,
    s.city,
    pqc.year,
    pqc.month,
    SUM(pqt.valor_abatido) FILTER (WHERE pqt.aplicado = true) as total_abatido,
    COUNT(pqt.id) FILTER (WHERE pqt.aplicado = true) as qtd_abatimentos,
    SUM(pqt.valor_abatido) FILTER (WHERE pqt.tipo_comprador = 'GERENTE' AND pqt.aplicado = true) as gerente_abatido,
    COUNT(pqt.id) FILTER (WHERE pqt.tipo_comprador = 'GERENTE' AND pqt.aplicado = true) as gerente_qtd,
    SUM(pqt.valor_abatido) FILTER (WHERE pqt.tipo_comprador = 'COMPRADOR' AND pqt.aplicado = true) as comprador_abatido,
    COUNT(pqt.id) FILTER (WHERE pqt.tipo_comprador = 'COMPRADOR' AND pqt.aplicado = true) as comprador_qtd,
    SUM(pqt.valor_abatido) FILTER (WHERE pqt.aplicado = false) as futuro_agendado,
    COUNT(pqt.id) FILTER (WHERE pqt.aplicado = false) as futuro_qtd
FROM buyorder_quota_control pqc
JOIN buyorder_quota_transactions pqt ON pqt.quota_control_id = pqc.id
LEFT JOIN stores s ON pqc.store_number = s.number
GROUP BY pqc.id, pqc.store_number, s.name, s.city, pqc.year, pqc.month;

CREATE OR REPLACE FUNCTION generate_quota_report(p_year INT, p_month INT)
RETURNS JSONB AS $$
DECLARE
    v_resumo JSONB;
    v_lojas JSONB;
    v_alertas JSONB;
    v_mes_nome TEXT;
BEGIN
    v_mes_nome := (ARRAY['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'])[p_month];

    SELECT jsonb_build_object(
        'total_lojas', COUNT(*),
        'cota_total_inicial', COALESCE(SUM(cota_inicial), 0),
        'cota_total_utilizada', COALESCE(SUM(cota_utilizada), 0),
        'cota_total_disponivel', COALESCE(SUM(cota_disponivel), 0),
        'percentual_medio', CASE WHEN SUM(cota_inicial) > 0 THEN ROUND((SUM(cota_utilizada) / SUM(cota_inicial)) * 100, 2) ELSE 0 END,
        'lojas_ok', COUNT(*) FILTER (WHERE status = 'OK'),
        'lojas_atencao', COUNT(*) FILTER (WHERE status = 'ATENÇÃO'),
        'lojas_critico', COUNT(*) FILTER (WHERE status IN ('CRÍTICO', 'ESGOTADO'))
    ) INTO v_resumo
    FROM v_quota_otb_report
    WHERE year = p_year AND month = p_month;

    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_lojas
    FROM (
        SELECT * FROM v_quota_otb_report
        WHERE year = p_year AND month = p_month
        ORDER BY percentual_utilizado DESC
    ) t;

    SELECT COALESCE(jsonb_agg(row_to_json(a)), '[]'::jsonb) INTO v_alertas
    FROM (
        SELECT store_number, store_name, cota_disponivel, status, percentual_utilizado
        FROM v_quota_otb_report
        WHERE year = p_year AND month = p_month AND status IN ('CRÍTICO', 'ESGOTADO')
        ORDER BY percentual_utilizado DESC
    ) a;

    RETURN jsonb_build_object(
        'periodo', jsonb_build_object(
            'year', p_year,
            'month', p_month,
            'mes_nome', v_mes_nome,
            'periodo_completo', v_mes_nome || ' ' || p_year
        ),
        'resumo_geral', COALESCE(v_resumo, '{}'::jsonb),
        'por_loja', COALESCE(v_lojas, '[]'::jsonb),
        'alertas_criticos', COALESCE(v_alertas, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_cron_report(p_year INT, p_month INT)
RETURNS JSONB AS $$
DECLARE
    v_resumo JSONB;
    v_execucoes JSONB;
    v_lojas JSONB;
    v_mes_nome TEXT;
BEGIN
    v_mes_nome := (ARRAY['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'])[p_month];

    SELECT jsonb_build_object(
        'total_execucoes', COUNT(*),
        'execucoes_sucesso', COUNT(*) FILTER (WHERE success = true),
        'execucoes_erro', COUNT(*) FILTER (WHERE success = false),
        'total_abatimentos', COALESCE(SUM(total_aplicado), 0),
        'valor_total', COALESCE(SUM(valor_total), 0),
        'tempo_medio_ms', COALESCE(ROUND(AVG(execution_duration_ms)::NUMERIC, 2), 0)
    ) INTO v_resumo
    FROM buyorder_cron_logs
    WHERE EXTRACT(YEAR FROM execution_time) = p_year AND EXTRACT(MONTH FROM execution_time) = p_month;

    SELECT COALESCE(jsonb_agg(row_to_json(e)), '[]'::jsonb) INTO v_execucoes
    FROM (
        SELECT * FROM buyorder_cron_logs
        WHERE EXTRACT(YEAR FROM execution_time) = p_year AND EXTRACT(MONTH FROM execution_time) = p_month
        ORDER BY execution_time DESC
    ) e;

    SELECT COALESCE(jsonb_agg(row_to_json(l)), '[]'::jsonb) INTO v_lojas
    FROM (
        SELECT * FROM v_abatimentos_por_loja
        WHERE year = p_year AND month = p_month
        ORDER BY total_abatido DESC
    ) l;

    RETURN jsonb_build_object(
        'periodo', jsonb_build_object(
            'year', p_year,
            'month', p_month,
            'mes_nome', v_mes_nome,
            'periodo_completo', v_mes_nome || ' ' || p_year
        ),
        'resumo', COALESCE(v_resumo, '{}'::jsonb),
        'execucoes', COALESCE(v_execucoes, '[]'::jsonb),
        'por_loja', COALESCE(v_lojas, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS buyorder_quota_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_number TEXT NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    tipo_comprador VARCHAR(20) NOT NULL,
    nivel VARCHAR(20) NOT NULL,
    cota_inicial DECIMAL(12,2) NOT NULL,
    cota_utilizada DECIMAL(12,2) NOT NULL,
    percentual_utilizado DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'ATIVO',
    notificado BOOLEAN DEFAULT false,
    notificado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT
);

CREATE OR REPLACE VIEW v_quota_alerts_active AS
SELECT *
FROM buyorder_quota_alerts
WHERE status = 'ATIVO'
ORDER BY 
  CASE nivel
    WHEN 'ESGOTADO_100' THEN 1
    WHEN 'CRITICO_90' THEN 2
    WHEN 'AVISO_75' THEN 3
  END,
  created_at DESC;

CREATE OR REPLACE FUNCTION check_and_create_quota_alerts()
RETURNS jsonb AS $$
DECLARE
    r RECORD;
    v_nivel VARCHAR(20);
    v_alertas_criados INT := 0;
    v_lojas_afetadas INT := 0;
    v_afetado BOOLEAN;
    v_pct_gerente DECIMAL := 0;
    v_pct_comprador DECIMAL := 0;
BEGIN
    FOR r IN SELECT * FROM buyorder_quota_control WHERE year = EXTRACT(YEAR FROM CURRENT_DATE) AND month = EXTRACT(MONTH FROM CURRENT_DATE)
    LOOP
        v_afetado := false;
        
        -- Verificar GERAL
        IF r.percentual_utilizado >= 100 THEN v_nivel := 'ESGOTADO_100';
        ELSIF r.percentual_utilizado >= 90 THEN v_nivel := 'CRITICO_90';
        ELSIF r.percentual_utilizado >= 75 THEN v_nivel := 'AVISO_75';
        ELSE v_nivel := NULL; END IF;
        
        IF v_nivel IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM buyorder_quota_alerts WHERE store_number = r.store_number AND year = r.year AND month = r.month AND tipo_comprador = 'GERAL' AND nivel = v_nivel AND status = 'ATIVO') THEN
                INSERT INTO buyorder_quota_alerts (store_number, year, month, tipo_comprador, nivel, cota_inicial, cota_utilizada, percentual_utilizado)
                VALUES (r.store_number, r.year, r.month, 'GERAL', v_nivel, r.cota_inicial, r.cota_utilizada, r.percentual_utilizado);
                v_alertas_criados := v_alertas_criados + 1;
                v_afetado := true;
            END IF;
        END IF;

        -- Verificar GERENTE
        v_pct_gerente := 0;
        IF r.cota_gerente_inicial > 0 THEN v_pct_gerente := (r.cota_gerente_utilizada / r.cota_gerente_inicial) * 100; END IF;
        
        IF v_pct_gerente >= 100 THEN v_nivel := 'ESGOTADO_100';
        ELSIF v_pct_gerente >= 90 THEN v_nivel := 'CRITICO_90';
        ELSIF v_pct_gerente >= 75 THEN v_nivel := 'AVISO_75';
        ELSE v_nivel := NULL; END IF;

        IF v_nivel IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM buyorder_quota_alerts WHERE store_number = r.store_number AND year = r.year AND month = r.month AND tipo_comprador = 'GERENTE' AND nivel = v_nivel AND status = 'ATIVO') THEN
                INSERT INTO buyorder_quota_alerts (store_number, year, month, tipo_comprador, nivel, cota_inicial, cota_utilizada, percentual_utilizado)
                VALUES (r.store_number, r.year, r.month, 'GERENTE', v_nivel, r.cota_gerente_inicial, r.cota_gerente_utilizada, v_pct_gerente);
                v_alertas_criados := v_alertas_criados + 1;
                v_afetado := true;
            END IF;
        END IF;

        -- Verificar COMPRADOR
        v_pct_comprador := 0;
        IF r.cota_comprador_inicial > 0 THEN v_pct_comprador := (r.cota_comprador_utilizada / r.cota_comprador_inicial) * 100; END IF;
        
        IF v_pct_comprador >= 100 THEN v_nivel := 'ESGOTADO_100';
        ELSIF v_pct_comprador >= 90 THEN v_nivel := 'CRITICO_90';
        ELSIF v_pct_comprador >= 75 THEN v_nivel := 'AVISO_75';
        ELSE v_nivel := NULL; END IF;

        IF v_nivel IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM buyorder_quota_alerts WHERE store_number = r.store_number AND year = r.year AND month = r.month AND tipo_comprador = 'COMPRADOR' AND nivel = v_nivel AND status = 'ATIVO') THEN
                INSERT INTO buyorder_quota_alerts (store_number, year, month, tipo_comprador, nivel, cota_inicial, cota_utilizada, percentual_utilizado)
                VALUES (r.store_number, r.year, r.month, 'COMPRADOR', v_nivel, r.cota_comprador_inicial, r.cota_comprador_utilizada, v_pct_comprador);
                v_alertas_criados := v_alertas_criados + 1;
                v_afetado := true;
            END IF;
        END IF;

        IF v_afetado THEN
            v_lojas_afetadas := v_lojas_afetadas + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'alertas_criados', v_alertas_criados, 'lojas_afetadas', v_lojas_afetadas);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_resolve_quota_alerts()
RETURNS TRIGGER AS $$
DECLARE
    v_pct_geral DECIMAL := 0;
    v_pct_gerente DECIMAL := 0;
    v_pct_comprador DECIMAL := 0;
BEGIN
    IF NEW.cota_inicial > 0 THEN v_pct_geral := (NEW.cota_utilizada / NEW.cota_inicial) * 100; END IF;
    IF NEW.cota_gerente_inicial > 0 THEN v_pct_gerente := (NEW.cota_gerente_utilizada / NEW.cota_gerente_inicial) * 100; END IF;
    IF NEW.cota_comprador_inicial > 0 THEN v_pct_comprador := (NEW.cota_comprador_utilizada / NEW.cota_comprador_inicial) * 100; END IF;

    IF v_pct_geral < 75 THEN
        UPDATE buyorder_quota_alerts SET status = 'RESOLVIDO', resolved_at = now(), resolved_by = 'AUTO'
        WHERE store_number = NEW.store_number AND year = NEW.year AND month = NEW.month AND tipo_comprador = 'GERAL' AND status = 'ATIVO';
    END IF;

    IF v_pct_gerente < 75 THEN
        UPDATE buyorder_quota_alerts SET status = 'RESOLVIDO', resolved_at = now(), resolved_by = 'AUTO'
        WHERE store_number = NEW.store_number AND year = NEW.year AND month = NEW.month AND tipo_comprador = 'GERENTE' AND status = 'ATIVO';
    END IF;

    IF v_pct_comprador < 75 THEN
        UPDATE buyorder_quota_alerts SET status = 'RESOLVIDO', resolved_at = now(), resolved_by = 'AUTO'
        WHERE store_number = NEW.store_number AND year = NEW.year AND month = NEW.month AND tipo_comprador = 'COMPRADOR' AND status = 'ATIVO';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_resolve_alerts ON buyorder_quota_control;
CREATE TRIGGER trigger_auto_resolve_alerts
AFTER UPDATE ON buyorder_quota_control
FOR EACH ROW
EXECUTE FUNCTION auto_resolve_quota_alerts();

CREATE OR REPLACE FUNCTION resolve_quota_alert(p_alert_id UUID, p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE buyorder_quota_alerts
    SET status = 'RESOLVIDO',
        resolved_at = now(),
        resolved_by = p_user_id
    WHERE id = p_alert_id;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE buyorder_parameters_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyorder_parameters_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyorder_quota_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyorder_quota_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyorder_cron_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyorder_quota_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select" ON buyorder_parameters_global FOR SELECT USING (true);
CREATE POLICY "Admin write" ON buyorder_parameters_global FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin') WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "Allow all select" ON buyorder_parameters_store FOR SELECT USING (true);
CREATE POLICY "Admin write" ON buyorder_parameters_store FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin') WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "Allow all select" ON buyorder_quota_control FOR SELECT USING (true);
CREATE POLICY "Admin write" ON buyorder_quota_control FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin') WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "Allow all select" ON buyorder_quota_transactions FOR SELECT USING (true);
CREATE POLICY "Admin write" ON buyorder_quota_transactions FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin') WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "Allow all select" ON buyorder_cron_logs FOR SELECT USING (true);
CREATE POLICY "Admin write" ON buyorder_cron_logs FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin') WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "Allow all select" ON buyorder_quota_alerts FOR SELECT USING (true);
CREATE POLICY "Admin write" ON buyorder_quota_alerts FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin') WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'manager' OR auth.jwt() ->> 'role' = 'super_admin');

-- Instructions to set up Cron Jobs:
-- 1. Enable pg_cron in Database extensions
-- 2. Execute the following to schedule quota verification:
-- SELECT cron.schedule('check-quota-alerts', '0 * * * *', $$SELECT check_and_create_quota_alerts()$$);
-- 3. Execute the following to schedule periodic log cleanup:
-- SELECT cron.schedule('cleanup-old-cron-logs', '0 0 * * 0', $$SELECT cleanup_old_cron_logs()$$);
-- 4. To schedule applying past due installments:
-- SELECT cron.schedule('aplicar-abatimentos', '0 1 * * *', $$SELECT aplicar_abatimentos_vencidos()$$);

-- 1. v_purchase_history_trends
CREATE OR REPLACE VIEW v_purchase_history_trends AS
WITH base AS (
  SELECT
    jsonb_array_elements_text(boso.lojas_numeros) AS store_number,
    COALESCE(boi.tipo, 'OUTROS') AS categoria,
    EXTRACT(YEAR FROM bo.created_at)::INT AS year,
    EXTRACT(MONTH FROM bo.created_at)::INT AS month,
    DATE_TRUNC('month', bo.created_at)::DATE AS periodo,
    SUM(boi.total_pares / COALESCE(NULLIF(jsonb_array_length(boso.lojas_numeros), 0), 1)) AS total_pares,
    COUNT(DISTINCT bo.id) AS total_pedidos
  FROM buy_orders bo
  JOIN buy_order_items boi ON boi.order_id = bo.id
  JOIN buy_order_sub_orders boso ON boso.order_id = bo.id
  GROUP BY 1, 2, 3, 4, 5
),
with_lag AS (
  SELECT
    b.store_number,
    s.name AS store_name,
    b.categoria,
    b.year,
    b.month,
    b.periodo,
    b.total_pares,
    b.total_pedidos,
    AVG(b.total_pares) OVER (
      PARTITION BY b.store_number, b.categoria
      ORDER BY b.periodo
      ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS media_movel_3m,
    LAG(b.total_pares) OVER (
      PARTITION BY b.store_number, b.categoria
      ORDER BY b.periodo
    ) AS prev_pares
  FROM base b
  LEFT JOIN stores s ON s.number = b.store_number
)
SELECT
  store_number,
  store_name,
  categoria,
  year,
  month,
  periodo,
  total_pares,
  total_pedidos,
  ROUND(media_movel_3m, 2) AS media_movel_3m,
  COALESCE(total_pares - prev_pares, 0) AS crescimento_absoluto,
  CASE WHEN prev_pares > 0 THEN ROUND(((total_pares - prev_pares) / prev_pares) * 100, 2) ELSE 0 END AS crescimento_pct
FROM with_lag;

-- 2. v_future_purchases
CREATE OR REPLACE VIEW v_future_purchases AS
SELECT
  qc.store_number,
  t.vencimento_data,
  COUNT(t.id) AS qtd_vencimentos,
  SUM(t.valor_abatido) AS valor_total,
  t.vencimento_data - CURRENT_DATE AS dias_ate_vencer,
  CASE
    WHEN t.vencimento_data <= CURRENT_DATE + 7 THEN 'Esta Semana'
    WHEN t.vencimento_data <= CURRENT_DATE + 30 THEN 'Este Mês'
    WHEN t.vencimento_data <= CURRENT_DATE + 90 THEN 'Próximos 3 Meses'
    ELSE 'Futuro Distante'
  END AS periodo_categoria
FROM buyorder_quota_transactions t
JOIN buyorder_quota_control qc ON t.quota_control_id = qc.id
WHERE t.aplicado = false AND t.vencimento_data >= CURRENT_DATE
GROUP BY qc.store_number, t.vencimento_data;

-- 3. v_seasonality_patterns
CREATE OR REPLACE VIEW v_seasonality_patterns AS
WITH monthly_stats AS (
  SELECT
    month,
    categoria,
    AVG(total_pares) AS media_pares,
    STDDEV(total_pares) AS desvio_padrao
  FROM v_purchase_history_trends
  GROUP BY month, categoria
),
category_stats AS (
  SELECT
    categoria,
    AVG(media_pares) AS media_geral
  FROM monthly_stats
  GROUP BY categoria
)
SELECT
  m.month,
  m.categoria,
  ROUND(m.media_pares, 2) AS media_pares,
  ROUND(COALESCE(m.desvio_padrao, 0), 2) AS desvio_padrao,
  CASE WHEN c.media_geral > 0 THEN ROUND((m.media_pares / c.media_geral) * 100, 2) ELSE 100 END AS indice_sazonalidade
FROM monthly_stats m
JOIN category_stats c ON m.categoria = c.categoria;

-- 4. calculate_stock_forecast
CREATE OR REPLACE FUNCTION calculate_stock_forecast(p_store_number TEXT, p_categoria TEXT, p_meses INT)
RETURNS TABLE (
  mes INT,
  ano INT,
  previsao_pares NUMERIC,
  previsao_valor NUMERIC,
  tendencia TEXT,
  confianca TEXT
) AS $$ 
DECLARE
  v_media_3m NUMERIC;
  v_cresc_medio NUMERIC;
  v_std_dev NUMERIC;
  v_ano_atual INT;
  v_mes_atual INT;
  v_confianca TEXT;
  v_tendencia TEXT;
BEGIN
  SELECT media_movel_3m, total_pares
  INTO v_media_3m
  FROM v_purchase_history_trends
  WHERE store_number = p_store_number AND categoria = p_categoria
  ORDER BY periodo DESC LIMIT 1;
  
  IF v_media_3m IS NULL THEN v_media_3m := 0; END IF;

  SELECT AVG(crescimento_absoluto), STDDEV(total_pares)
  INTO v_cresc_medio, v_std_dev
  FROM (
    SELECT crescimento_absoluto, total_pares
    FROM v_purchase_history_trends
    WHERE store_number = p_store_number AND categoria = p_categoria
    ORDER BY periodo DESC LIMIT 6
  ) sub;
  
  IF v_cresc_medio IS NULL THEN v_cresc_medio := 0; END IF;

  IF v_media_3m > 0 AND v_std_dev IS NOT NULL THEN
    IF (v_std_dev / v_media_3m) <= 0.20 THEN v_confianca := 'Alta';
    ELSIF (v_std_dev / v_media_3m) <= 0.50 THEN v_confianca := 'Média';
    ELSE v_confianca := 'Baixa'; END IF;
  ELSE
    v_confianca := 'Média';
  END IF;

  v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);
  v_mes_atual := EXTRACT(MONTH FROM CURRENT_DATE);

  FOR i IN 1..p_meses LOOP
    v_mes_atual := v_mes_atual + 1;
    IF v_mes_atual > 12 THEN
      v_mes_atual := 1;
      v_ano_atual := v_ano_atual + 1;
    END IF;

    IF v_cresc_medio > (v_media_3m * 0.05) THEN v_tendencia := 'Forte Crescimento';
    ELSIF v_cresc_medio > 0 THEN v_tendencia := 'Crescimento Moderado';
    ELSIF v_cresc_medio > -(v_media_3m * 0.05) THEN v_tendencia := 'Estável';
    ELSE v_tendencia := 'Em Queda'; END IF;

    mes := v_mes_atual;
    ano := v_ano_atual;
    previsao_pares := GREATEST(0, ROUND(v_media_3m + (v_cresc_medio * i)));
    previsao_valor := previsao_pares * 50; 
    tendencia := v_tendencia;
    confianca := v_confianca;
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. generate_forecast_report
CREATE OR REPLACE FUNCTION generate_forecast_report(p_store_number TEXT, p_months_ahead INT)
RETURNS JSONB AS $$ 
DECLARE
  v_resumo_geral JSONB;
  v_tendencias JSONB;
  v_proximos_vencimentos JSONB;
BEGIN
  SELECT jsonb_build_object(
    'lojas_analisadas', 1,
    'categorias_analisadas', COUNT(DISTINCT categoria),
    'total_historico_pares', COALESCE(SUM(total_pares), 0),
    'media_mensal_pares', COALESCE(ROUND(AVG(total_pares),0), 0)
  )
  INTO v_resumo_geral
  FROM v_purchase_history_trends
  WHERE store_number = p_store_number;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'categoria', categoria,
        'tendencia', CASE 
          WHEN crescimento_medio > 5 THEN 'Forte Crescimento'
          WHEN crescimento_medio > 0 THEN 'Crescimento Moderado'
          WHEN crescimento_medio > -5 THEN 'Estável'
          ELSE 'Em Queda'
        END,
        'crescimento_medio_pct', ROUND(crescimento_medio::numeric, 2),
        'media_mensal_pares', ROUND(media_pares::numeric, 0)
      )
    ), '[]'::jsonb
  )
  INTO v_tendencias
  FROM (
    SELECT 
      categoria, 
      AVG(crescimento_pct) as crescimento_medio, 
      AVG(total_pares) as media_pares
    FROM v_purchase_history_trends
    WHERE store_number = p_store_number AND periodo >= (CURRENT_DATE - INTERVAL '6 months')::DATE
    GROUP BY categoria
  ) agg_data;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'vencimento_data', vencimento_data,
        'valor_total', valor_total,
        'dias_ate_vencer', dias_ate_vencer
      )
    ), '[]'::jsonb
  )
  INTO v_proximos_vencimentos
  FROM v_future_purchases
  WHERE store_number = p_store_number AND dias_ate_vencer <= (p_months_ahead * 30);

  RETURN jsonb_build_object(
    'periodo_previsao', jsonb_build_object(
      'meses_a_frente', p_months_ahead,
      'data_inicial', CURRENT_DATE,
      'data_final', CURRENT_DATE + (p_months_ahead * 30)
    ),
    'resumo_geral', COALESCE(v_resumo_geral, '{}'::jsonb),
    'tendencias', COALESCE(v_tendencias, '[]'::jsonb),
    'proximos_vencimentos', COALESCE(v_proximos_vencimentos, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql;

-- 8. Função para Reparar Dados Órfãos (Corrige pedidos que não estão abatendo)
CREATE OR REPLACE FUNCTION reparar_transacoes_cotas()
RETURNS VOID AS $$
BEGIN
    -- Preenche store_number em transações que estão nulas, buscando do pedido original
    UPDATE buyorder_quota_transactions qt
    SET store_number = s.number
    FROM buy_orders o
    JOIN stores s ON s.id = o.store_id
    WHERE qt.order_id = o.id 
      AND (qt.store_number IS NULL OR qt.store_number::INTEGER != s.number::INTEGER);

    -- Tenta vincular quota_control_id se o registro já existir agora
    UPDATE buyorder_quota_transactions qt
    SET quota_control_id = qc.id
    FROM buyorder_quota_control qc
    WHERE qt.store_number::INTEGER = qc.store_number::INTEGER
      AND EXTRACT(YEAR FROM qt.vencimento_data) = qc.year
      AND EXTRACT(MONTH FROM qt.vencimento_data) = qc.month
      AND (qt.quota_control_id IS NULL OR qt.quota_control_id != qc.id);
END;
$$ LANGUAGE plpgsql;

-- Buscar cotas futuras COM abatimentos em tempo real (ATUALIZADO PARA AUTO-REPARO)
CREATE OR REPLACE FUNCTION get_buy_order_quotas_future(p_store_number text, p_tipo_comprador text)
RETURNS TABLE (
  id UUID,
  store_number text,
  year integer,
  month integer,
  cota_inicial numeric,
  cota_comprometida numeric,
  cota_disponivel numeric
) AS $$
BEGIN
  -- Tenta reparar dados órfãos antes de calcular
  PERFORM reparar_transacoes_cotas();

  RETURN QUERY
  SELECT 
    qc.id,
    qc.store_number,
    qc.year::integer,
    qc.month::integer,
    
    -- Cota Inicial
    CASE WHEN p_tipo_comprador = 'COMPRADOR' THEN qc.cota_comprador_inicial ELSE qc.cota_gerente_inicial END as cota_inicial,
    
    -- Cota Comprometida (Soma do que já foi aplicado no snapshot + o que está pendente nas transações)
    (CASE WHEN p_tipo_comprador = 'COMPRADOR' THEN qc.cota_comprador_utilizada ELSE qc.cota_gerente_utilizada END) +
    COALESCE((
      SELECT SUM(qt.valor_abatido)
      FROM buyorder_quota_transactions qt
      WHERE (qt.store_number::INTEGER = qc.store_number::INTEGER OR qt.quota_control_id = qc.id)
        AND EXTRACT(YEAR FROM qt.vencimento_data) = qc.year
        AND EXTRACT(MONTH FROM qt.vencimento_data) = qc.month
        AND qt.tipo_comprador = p_tipo_comprador
        AND qt.aplicado = false
    ), 0) AS cota_comprometida,
    
    -- Cota Disponível
    (CASE WHEN p_tipo_comprador = 'COMPRADOR' THEN qc.cota_comprador_inicial ELSE qc.cota_gerente_inicial END) - 
    ((CASE WHEN p_tipo_comprador = 'COMPRADOR' THEN qc.cota_comprador_utilizada ELSE qc.cota_gerente_utilizada END) +
    COALESCE((
      SELECT SUM(qt.valor_abatido)
      FROM buyorder_quota_transactions qt
      WHERE (qt.store_number::INTEGER = qc.store_number::INTEGER OR qt.quota_control_id = qc.id)
        AND EXTRACT(YEAR FROM qt.vencimento_data) = qc.year
        AND EXTRACT(MONTH FROM qt.vencimento_data) = qc.month
        AND qt.tipo_comprador = p_tipo_comprador
        AND qt.aplicado = false
    ), 0)) AS cota_disponivel

  FROM buyorder_quota_control qc
  WHERE qc.store_number::INTEGER = p_store_number::INTEGER
    AND (
      (qc.year = EXTRACT(YEAR FROM CURRENT_DATE) AND qc.month >= EXTRACT(MONTH FROM CURRENT_DATE))
      OR (qc.year > EXTRACT(YEAR FROM CURRENT_DATE))
    )
  ORDER BY qc.year, qc.month
  LIMIT 12;
END;
$$ LANGUAGE plpgsql;

-- Listar pedidos que vencem num mês específico
CREATE OR REPLACE FUNCTION get_buy_order_quota_transactions_details(p_store_number text, p_year integer, p_month integer, p_tipo_comprador text)
RETURNS TABLE (
  numero_pedido integer,
  marca text,
  created_at timestamptz,
  prazos integer[],
  vencimentos date[],
  valor_abatido numeric,
  tipo_comprador text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.numero_pedido,
    o.marca,
    o.created_at,
    o.prazos,
    o.vencimentos,
    qt.valor_abatido,
    qt.tipo_comprador::text
  FROM buyorder_quota_transactions qt
  JOIN buy_orders o ON o.id = qt.order_id
  WHERE (qt.store_number = p_store_number OR EXISTS (
    SELECT 1 FROM buyorder_quota_control qc 
    WHERE qc.id = qt.quota_control_id AND qc.store_number = p_store_number
  ))
    AND EXTRACT(YEAR FROM qt.vencimento_data) = p_year
    AND EXTRACT(MONTH FROM qt.vencimento_data) = p_month
    AND qt.tipo_comprador = p_tipo_comprador
    AND qt.aplicado = false
  ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 11. SISTEMA OTB (Open-To-Buy) - Lógica de Pagamento 90/120/150 dias
-- =========================================================================

-- Função para debitar cotas baseado em faturamento + 3/4/5 meses
CREATE OR REPLACE FUNCTION debitar_cota_pedido(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_order_items_total DECIMAL(12,2);
    v_loja TEXT;
    v_num_lojas INT;
    v_valor_por_loja DECIMAL(12,2);
    v_valor_parcela DECIMAL(12,2);
    v_fat_date DATE;
    v_count INT := 0;
    v_qc_id UUID;
    v_vencimento DATE;
    v_i INT;
    v_lojas_array JSONB;
BEGIN
    -- Busca dados básicos do pedido
    SELECT * INTO v_order FROM buy_orders WHERE id = p_order_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Pedido não encontrado'); END IF;

    -- Busca lojas vinculadas (sub-pedidos)
    SELECT lojas_numeros INTO v_lojas_array FROM buy_order_sub_orders WHERE order_id = p_order_id LIMIT 1;
    v_num_lojas := COALESCE(jsonb_array_length(v_lojas_array), 1);

    -- Calcula valor total do pedido (soma de itens)
    SELECT SUM(total_custo) INTO v_order_items_total FROM buy_order_items WHERE order_id = p_order_id;
    v_order_items_total := COALESCE(v_order_items_total, 0);

    -- Se não houver valor, não há o que debitar
    IF v_order_items_total <= 0 THEN RETURN jsonb_build_object('success', true, 'message', 'Valor zero, sem débitos'); END IF;

    v_valor_por_loja := v_order_items_total / v_num_lojas;
    v_valor_parcela := v_valor_por_loja / 3; -- Sempre 3 parcelas (90/120/150)

    -- Data base de faturamento
    v_fat_date := COALESCE(v_order.fat_inicio, v_order.created_at::DATE);

    -- Para cada loja no array
    FOR v_loja IN SELECT * FROM jsonb_array_elements_text(v_lojas_array) LOOP
        
        -- Criar as 3 parcelas futuras
        FOR v_i IN 3..5 LOOP
            v_vencimento := v_fat_date + (v_i * interval '1 month');
            
            -- Tentar encontrar ou inicializar o controle de cota para o mês/ano do vencimento
            SELECT id INTO v_qc_id FROM buyorder_quota_control 
            WHERE store_number = v_loja 
              AND year = EXTRACT(YEAR FROM v_vencimento) 
              AND month = EXTRACT(MONTH FROM v_vencimento);

            IF v_qc_id IS NULL THEN
                -- Se não existir cota para o mês futuro, inicializa o mês
                PERFORM inicializar_cotas_mes(EXTRACT(YEAR FROM v_vencimento)::INT, EXTRACT(MONTH FROM v_vencimento)::INT);
                
                SELECT id INTO v_qc_id FROM buyorder_quota_control 
                WHERE store_number = v_loja 
                  AND year = EXTRACT(YEAR FROM v_vencimento) 
                  AND month = EXTRACT(MONTH FROM v_vencimento);
            END IF;

            -- Registra a transação de cota
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
                'COMPRADOR',
                v_vencimento,
                false, -- Pendente até o cron aplicar no mês real
                'Pedido #' || COALESCE(v_order.numero_pedido::TEXT, p_order_id::TEXT) || ' (Parcela ' || (v_i-2) || '/3 - ' || v_i || ' meses)'
            );
            v_count := v_count + 1;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'transactions_created', v_count);
END;
$$ LANGUAGE plpgsql;

-- Trigger para disparar débito quando o pedido é CONFIRMADO
CREATE OR REPLACE FUNCTION trigger_process_quota_debit()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status mudou para 'confirmado'
    IF (NEW.status = 'confirmado' AND (OLD.status IS NULL OR OLD.status != 'confirmado')) THEN
        PERFORM debitar_cota_pedido(NEW.id);
    END IF;
    
    -- Se o status mudou de 'confirmado' para outro, removemos as transações pendentes
    IF (OLD.status = 'confirmado' AND NEW.status != 'confirmado') THEN
        DELETE FROM buyorder_quota_transactions WHERE order_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_buyorder_status_quota ON buy_orders;
CREATE TRIGGER trg_buyorder_status_quota
AFTER UPDATE ON buy_orders
FOR EACH ROW
EXECUTE FUNCTION trigger_process_quota_debit();

-- VIEW OTB: Soma das 3 cotas futuras vs Compromissos nessas 3 cotas
CREATE OR REPLACE VIEW v_cota_disponivel_mes AS
WITH meses_pagamento AS (
  SELECT 
    s.number as store_number,
    gen_year as year,
    gen_month as month,
    -- Meses que pagarão se lançar NO MÊS REFERÊNCIA (+3, +4, +5)
    (DATE_TRUNC('month', TO_DATE(gen_year || '-' || gen_month || '-01', 'YYYY-MM-DD')) + interval '3 month')::DATE as mes_p1,
    (DATE_TRUNC('month', TO_DATE(gen_year || '-' || gen_month || '-01', 'YYYY-MM-DD')) + interval '4 month')::DATE as mes_p2,
    (DATE_TRUNC('month', TO_DATE(gen_year || '-' || gen_month || '-01', 'YYYY-MM-DD')) + interval '5 month')::DATE as mes_p3
  FROM stores s
  CROSS JOIN (SELECT generate_series(2025, 2028) as gen_year) y
  CROSS JOIN (SELECT generate_series(1, 12) as gen_month) m
  WHERE s.is_active = true
),
quota_sums AS (
  SELECT 
    mp.store_number,
    mp.year,
    mp.month,
    -- COTA LIMPA (Cota Total - Despesas) para os meses de pagamento
    COALESCE((SELECT SUM(cota_comprador_inicial) FROM buyorder_quota_control 
     WHERE store_number = mp.store_number 
       AND ( (year = EXTRACT(YEAR FROM mp.mes_p1) AND month = EXTRACT(MONTH FROM mp.mes_p1))
          OR (year = EXTRACT(YEAR FROM mp.mes_p2) AND month = EXTRACT(MONTH FROM mp.mes_p2))
          OR (year = EXTRACT(YEAR FROM mp.mes_p3) AND month = EXTRACT(MONTH FROM mp.mes_p3)) )
    ), 0) as total_quota_pago,
    -- COMPROMISSOS JÁ LANÇADOS que vencem nesses meses
    COALESCE((SELECT SUM(valor_abatido) FROM buyorder_quota_transactions 
     WHERE store_number = mp.store_number 
       AND vencimento_data >= mp.mes_p1 
       AND vencimento_data < (mp.mes_p3 + interval '1 month')
    ), 0) as total_comprometido_pago
  FROM meses_pagamento mp
)
SELECT 
  store_number,
  year,
  month,
  (total_quota_pago - total_comprometido_pago) as cota_comprador_total
FROM quota_sums;

