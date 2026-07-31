-- ==============================================================================
-- SCRIPT DE CRIAÇÃO DE TABELAS E ESTRUTURA PARA EMISSÃO DE NFS-e (JUNDIAÍ - SP)
-- SISTEMA: ClinicFlow
-- PADRÃO FISCAL: GISS Online / ABRASF v2.04 (Prefeitura Municipal de Jundiaí/SP)
-- ==============================================================================

-- 1. CRIAR TABELA DE NOTAS FISCAIS (notas_fiscais)
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
    status TEXT NOT NULL DEFAULT 'Rascunho', -- Rascunho, Processando, Aprovada, Cancelada, Rejeitada
    motivo_rejeicao TEXT,
    pdf_url TEXT,
    xml_url TEXT,
    xml_envio TEXT,
    xml_resposta TEXT,
    ambiente TEXT DEFAULT 'Homologação', -- Homologação, Produção
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CRIAR TABELA DE CONFIGURAÇÃO FISCAL JUNDIAÍ (config_fiscal_jundiai)
CREATE TABLE IF NOT EXISTS public.config_fiscal_jundiai (
    id TEXT PRIMARY KEY DEFAULT 'config_padrao',
    cnpj_emissor TEXT NOT NULL,
    inscricao_municipal TEXT NOT NULL,
    razao_social TEXT NOT NULL,
    ambiente TEXT DEFAULT 'Homologação',
    codigo_servico_padrao TEXT DEFAULT '04.01',
    aliquota_iss_padrao NUMERIC(5, 2) DEFAULT 2.00,
    optante_simples_nacional BOOLEAN DEFAULT TRUE,
    token_api TEXT,
    certificado_validade DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CRIAR TABELA DE LOTES TRANSMITIDOS PARA JUNDIAÍ (lotes_rps_jundiai)
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

-- 4. ÍNDICES DE DESEMPENO
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_status ON public.notas_fiscais(status);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_data_emissao ON public.notas_fiscais(data_emissao);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_cpf_cnpj ON public.notas_fiscais(tomador_cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_paciente_id ON public.notas_fiscais(paciente_id);

-- 5. TRIGGER DE ATUALIZAÇÃO AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_notas_fiscais ON public.notas_fiscais;
CREATE TRIGGER set_timestamp_notas_fiscais
BEFORE UPDATE ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 6. POLÍTICAS DE SEGURANÇA RLS (Row Level Security)
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_fiscal_jundiai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_rps_jundiai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso Total Notas Fiscais" ON public.notas_fiscais FOR ALL USING (true);
CREATE POLICY "Acesso Total Config Fiscal" ON public.config_fiscal_jundiai FOR ALL USING (true);
CREATE POLICY "Acesso Total Lotes RPS" ON public.lotes_rps_jundiai FOR ALL USING (true);

-- INSERT DE CONFIGURAÇÃO INICIAL (SE NÃO EXISTIR)
INSERT INTO public.config_fiscal_jundiai (id, cnpj_emissor, inscricao_municipal, razao_social, ambiente, codigo_servico_padrao, aliquota_iss_padrao)
VALUES ('config_padrao', '12.345.678/0001-90', '987654', 'Kosmos Clínica de Saúde & Psicologia Ltda', 'Homologação', '04.01', 2.00)
ON CONFLICT (id) DO NOTHING;
