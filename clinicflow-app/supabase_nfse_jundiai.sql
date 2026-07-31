-- ==============================================================================
-- SCRIPT DE AJUSTE E CRIAÇÃO DE ESTRUTURA COMPLETA SUPABASE - CLINICFLOW
-- INTEGRATION: NFS-e Jundiaí (SP) - GISS Online / ABRASF v2.04 & Reforma Tributária
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AJUSTES NA TABELA DE PACIENTES (pacientes) - ENDEREÇO ESTRUTURADO FISCAL
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS cidade TEXT DEFAULT 'Jundiaí';
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS uf_end TEXT DEFAULT 'SP';

-- ------------------------------------------------------------------------------
-- 2. AJUSTES NA TABELA DE PROCEDIMENTOS (procedimentos) - CÓDIGO FISCAL ABRASF
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.procedimentos ADD COLUMN IF NOT EXISTS codigo_servico_abrasf TEXT DEFAULT '04.01';

-- ------------------------------------------------------------------------------
-- 3. CRIAÇÃO / AJUSTES DA TABELA DE CONFIGURAÇÃO FISCAL (config_fiscal_jundiai)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.config_fiscal_jundiai (
    id TEXT PRIMARY KEY DEFAULT 'config_padrao',
    cnpj_emissor TEXT NOT NULL,
    inscricao_municipal TEXT NOT NULL,
    razao_social TEXT NOT NULL,
    ambiente TEXT DEFAULT 'Homologação',
    codigo_servico_padrao TEXT DEFAULT '04.01',
    aliquota_iss_padrao NUMERIC(5, 2) DEFAULT 2.00,
    optante_simples_nacional BOOLEAN DEFAULT TRUE,
    
    -- PARÂMETROS RPS E CERTIFICADO DIGITAL A1
    serie_rps TEXT DEFAULT '1',
    proximo_numero_rps BIGINT DEFAULT 1001,
    proximo_numero_lote BIGINT DEFAULT 1001,
    regime_tributario TEXT DEFAULT '6', -- 1-Microempresa, 2-Estimativa, 3-Sociedade Profissionais, 5-MEI, 6-ME/EPP Simples Nacional
    certificado_nome_arquivo TEXT,
    certificado_base64 TEXT,
    certificado_senha TEXT,
    
    -- CONFIGURAÇÃO REFORMA TRIBUTÁRIA (IBS / CBS)
    destacar_ibs_cbs BOOLEAN DEFAULT TRUE,
    aliquota_ibs_padrao NUMERIC(5, 4) DEFAULT 0.1000,
    aliquota_cbs_padrao NUMERIC(5, 4) DEFAULT 0.9000,
    reducao_saude_ibs_cbs NUMERIC(5, 2) DEFAULT 60.00,

    token_api TEXT,
    certificado_validade DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GARANTIR COLUNAS EM CASO DE TABELA JÁ EXISTENTE
ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS serie_rps TEXT DEFAULT '1';
ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS proximo_numero_rps BIGINT DEFAULT 1001;
ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS proximo_numero_lote BIGINT DEFAULT 1001;
ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS regime_tributario TEXT DEFAULT '6';
ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS certificado_nome_arquivo TEXT;
ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS certificado_base64 TEXT;
ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS certificado_senha TEXT;

-- ------------------------------------------------------------------------------
-- 4. CRIAÇÃO DA TABELA DE NOTAS FISCAIS (notas_fiscais)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
    id TEXT PRIMARY KEY,
    numero_rps TEXT NOT NULL,
    numero_lote BIGINT,
    numero_nota TEXT,
    codigo_verificacao TEXT,
    data_emissao TIMESTAMPTZ DEFAULT NOW(),
    paciente_id BIGINT,
    tomador_nome TEXT NOT NULL,
    tomador_cpf_cnpj TEXT NOT NULL,
    tomador_email TEXT,
    tomador_endereco TEXT,
    servico_codigo TEXT DEFAULT '04.01',
    descricao_servico TEXT NOT NULL,
    valor_servico NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    aliquota_iss NUMERIC(5, 2) NOT NULL DEFAULT 2.00,
    valor_iss NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- COLUNAS REFORMA TRIBUTÁRIA (IBS / CBS)
    cst_ibs_cbs TEXT DEFAULT '01',
    c_class_trib TEXT DEFAULT '040100',
    aliquota_ibs NUMERIC(5, 4) DEFAULT 0.1000,
    valor_ibs NUMERIC(12, 2) DEFAULT 0.00,
    aliquota_cbs NUMERIC(5, 4) DEFAULT 0.9000,
    valor_cbs NUMERIC(12, 2) DEFAULT 0.00,
    p_redutor_ibs_cbs NUMERIC(5, 2) DEFAULT 60.00,

    status TEXT NOT NULL DEFAULT 'Rascunho',
    motivo_rejeicao TEXT,
    pdf_url TEXT,
    xml_url TEXT,
    xml_envio TEXT,
    xml_resposta TEXT,
    ambiente TEXT DEFAULT 'Homologação',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. CRIAÇÃO DA TABELA DE LOTES RPS TRANSMITIDOS (lotes_rps_jundiai)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lotes_rps_jundiai (
    id TEXT PRIMARY KEY,
    numero_lote BIGINT UNIQUE NOT NULL,
    quantidade_rps INTEGER DEFAULT 1,
    protocolo TEXT,
    status TEXT DEFAULT 'Processado',
    xml_lote TEXT,
    data_transmissao TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. ÍNDICES DE DESEMPENHO E BUSCA RÁPIDA
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_status ON public.notas_fiscais(status);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_data_emissao ON public.notas_fiscais(data_emissao);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_cpf_cnpj ON public.notas_fiscais(tomador_cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_pacientes_cpf ON public.pacientes(cpf);

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS DE SEGURANÇA RLS (Row Level Security)
-- ------------------------------------------------------------------------------
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_fiscal_jundiai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_rps_jundiai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso Total Notas Fiscais" ON public.notas_fiscais FOR ALL USING (true);
CREATE POLICY "Acesso Total Config Fiscal" ON public.config_fiscal_jundiai FOR ALL USING (true);
CREATE POLICY "Acesso Total Lotes RPS" ON public.lotes_rps_jundiai FOR ALL USING (true);

-- ------------------------------------------------------------------------------
-- 8. CARGA INICIAL DE CONFIGURAÇÃO FISCAL SE NÃO EXISTIR
-- ------------------------------------------------------------------------------
INSERT INTO public.config_fiscal_jundiai (id, cnpj_emissor, inscricao_municipal, razao_social, ambiente, codigo_servico_padrao, aliquota_iss_padrao)
VALUES ('config_padrao', '12.345.678/0001-90', '987654', 'Kosmos Clínica de Saúde & Psicologia Ltda', 'Homologação', '04.01', 2.00)
ON CONFLICT (id) DO NOTHING;
