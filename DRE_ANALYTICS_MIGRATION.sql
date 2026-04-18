-- ============================================================================
-- MÓDULO DRE ANALYTICS - ESTRUTURA COMPLETA (TABELAS + VIEWS + RLS)
-- ============================================================================

-- 1. TABELAS BASE
CREATE TABLE IF NOT EXISTS dre_imports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    filename TEXT NOT NULL,
    user_id UUID REFERENCES admin_users(id),
    status TEXT CHECK (status IN ('parsing', 'completed', 'error')),
    store_count INTEGER DEFAULT 0,
    month_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dre_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    import_id UUID REFERENCES dre_imports(id) ON DELETE CASCADE,
    loja_id INTEGER NOT NULL, -- ID numérico da loja (vindo do Excel)
    mes_referencia DATE NOT NULL,
    grupo TEXT,
    descricao TEXT NOT NULL,
    valor NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dre_sazonalidade (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    fator NUMERIC(5,2) DEFAULT 1.0,
    meses INTEGER[] -- ex: ARRAY[6, 12]
);

CREATE TABLE IF NOT EXISTS dre_cotas_lojas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id INTEGER NOT NULL,
    mes_referencia DATE NOT NULL,
    cota_total NUMERIC(15,2) DEFAULT 0,
    percent_gerente NUMERIC(5,2) DEFAULT 20,
    percent_comprador NUMERIC(5,2) DEFAULT 80,
    UNIQUE(loja_id, mes_referencia)
);

CREATE TABLE IF NOT EXISTS dre_parameters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    periodo_inicio DATE,
    periodo_fim DATE,
    media NUMERIC(15,2),
    mediana NUMERIC(15,2),
    desvio_padrao NUMERIC(15,2),
    min NUMERIC(15,2),
    max NUMERIC(15,2),
    q1 NUMERIC(15,2),
    q3 NUMERIC(15,2),
    limite_inferior NUMERIC(15,2),
    limite_superior NUMERIC(15,2),
    coeficiente_variacao NUMERIC(10,4),
    considera_sazonalidade BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(loja_id, descricao)
);

CREATE TABLE IF NOT EXISTS dre_anomalies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id INTEGER NOT NULL,
    mes_referencia DATE NOT NULL,
    tipo TEXT,
    severidade TEXT,
    descricao TEXT,
    valor_real NUMERIC(15,2),
    valor_esperado NUMERIC(15,2),
    desvio_absoluto NUMERIC(15,2),
    desvio_percentual NUMERIC(10,2),
    status TEXT DEFAULT 'pendente',
    resolvido_por UUID REFERENCES admin_users(id),
    resolvido_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VIEWS (O QUE ESTÁ CAUSANDO O ERRO 400)

-- Limpar views antigas para evitar erro 42P16 (Cannot drop columns from view)
DROP VIEW IF EXISTS view_ranking_lojas CASCADE;
DROP VIEW IF EXISTS view_dre_comparativo_mom CASCADE;
DROP VIEW IF EXISTS view_dre_cotas_status CASCADE;
DROP VIEW IF EXISTS view_dre_resumo_mensal CASCADE;

-- a) Resumo Mensal
CREATE VIEW view_dre_resumo_mensal AS
SELECT 
    loja_id,
    mes_referencia,
    SUM(CASE WHEN valor > 0 AND grupo ILIKE '%receita%' THEN valor ELSE 0 END) as receita_total,
    SUM(CASE WHEN valor < 0 OR grupo ILIKE '%despesa%' OR grupo ILIKE '%custo%' THEN ABS(valor) ELSE 0 END) as despesa_total,
    SUM(valor) as margem_liquida,
    CASE 
        WHEN SUM(CASE WHEN valor > 0 AND (grupo ILIKE '%receita%' OR grupo IS NULL) THEN valor ELSE 0 END) > 0 
        THEN (SUM(valor) / NULLIF(SUM(CASE WHEN valor > 0 AND (grupo ILIKE '%receita%' OR grupo IS NULL) THEN valor ELSE 0 END), 0)) * 100
        ELSE 0 
    END as margem_percent
FROM dre_data
GROUP BY loja_id, mes_referencia;

-- b) Status de Cotas
CREATE VIEW view_dre_cotas_status AS
SELECT 
    c.loja_id,
    c.mes_referencia,
    c.cota_total,
    COALESCE(SUM(ABS(d.valor)), 0) as consumo_fornecedores,
    CASE 
        WHEN c.cota_total > 0 THEN (COALESCE(SUM(ABS(d.valor)), 0) / c.cota_total) * 100 
        ELSE 0 
    END as percent_utilizado,
    c.cota_total - COALESCE(SUM(ABS(d.valor)), 0) as saldo_disponivel
FROM dre_cotas_lojas c
LEFT JOIN dre_data d ON d.loja_id = c.loja_id 
    AND d.mes_referencia = c.mes_referencia 
    AND d.grupo ILIKE '%fornecedor%'
GROUP BY c.id, c.loja_id, c.mes_referencia, c.cota_total;

-- c) Comparativo Mês a Mês (MoM)
CREATE VIEW view_dre_comparativo_mom AS
WITH MesAtual AS (
    SELECT loja_id, descricao, mes_referencia as mes_atual, valor as valor_atual
    FROM dre_data
),
MesAnterior AS (
    SELECT loja_id, descricao, mes_referencia + interval '1 month' as mes_seguinte, valor as valor_anterior
    FROM dre_data
)
SELECT 
    a.loja_id,
    a.descricao,
    a.mes_atual,
    a.valor_atual,
    (a.mes_atual - interval '1 month')::date as mes_anterior,
    COALESCE(b.valor_anterior, 0) as valor_anterior,
    CASE 
        WHEN COALESCE(b.valor_anterior, 0) != 0 THEN ((a.valor_atual - b.valor_anterior) / ABS(b.valor_anterior)) * 100
        ELSE 100 
    END as variacao_percent
FROM MesAtual a
LEFT JOIN MesAnterior b ON a.loja_id = b.loja_id AND a.descricao = b.descricao AND a.mes_atual = b.mes_seguinte;

-- d) Ranking de Lojas (Score)
CREATE VIEW view_ranking_lojas AS
SELECT 
    r.loja_id,
    'Loja ' || r.loja_id as nome_loja,
    r.mes_referencia,
    (r.margem_percent * 0.7 + (100 - COALESCE(c.percent_utilizado, 0)) * 0.3) as score,
    DENSE_RANK() OVER(PARTITION BY r.mes_referencia ORDER BY (r.margem_percent * 0.7 + (100 - COALESCE(c.percent_utilizado, 0)) * 0.3) DESC) as rank,
    r.receita_total as faturamento_total,
    r.margem_percent as margem_media
FROM view_dre_resumo_mensal r
LEFT JOIN view_dre_cotas_status c ON r.loja_id = c.loja_id AND r.mes_referencia = c.mes_referencia;

-- 3. POLÍTICAS RLS (Segurança)
ALTER TABLE dre_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dre_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE dre_sazonalidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE dre_cotas_lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE dre_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE dre_anomalies ENABLE ROW LEVEL SECURITY;

-- Admins podem fazer tudo
CREATE POLICY "Admins full access imports" ON dre_imports FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND LOWER(role_level) = 'admin'));
CREATE POLICY "Admins full access data" ON dre_data FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND LOWER(role_level) = 'admin'));
CREATE POLICY "Admins full access sazonalidade" ON dre_sazonalidade FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND LOWER(role_level) = 'admin'));
CREATE POLICY "Admins full access cotas" ON dre_cotas_lojas FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND LOWER(role_level) = 'admin'));
CREATE POLICY "Admins full access parameters" ON dre_parameters FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND LOWER(role_level) = 'admin'));
CREATE POLICY "Admins full access anomalies" ON dre_anomalies FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND LOWER(role_level) = 'admin'));
