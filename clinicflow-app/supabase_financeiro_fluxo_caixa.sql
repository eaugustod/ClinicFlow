-- ==============================================================================
-- SCRIPT DE CRIAÇÃO DE TABELAS E ESTRUTURA PARA GESTÃO FINANCEIRA E FLUXO DE CAIXA
-- SISTEMA: ClinicFlow
-- TABELAS: contas_receber, contas_pagar, categorias_financeiras
-- ==============================================================================

-- 1. TABELA DE CATEGORIAS FINANCEIRAS (categorias_financeiras)
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Receita', 'Despesa')),
    cor TEXT DEFAULT '#6366f1',
    icone TEXT DEFAULT 'Tag',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE CONTAS A RECEBER (contas_receber)
CREATE TABLE IF NOT EXISTS public.contas_receber (
    id TEXT PRIMARY KEY,
    paciente_id BIGINT,
    paciente_nome TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    valor_recebido NUMERIC(12, 2) DEFAULT 0.00,
    data_vencimento DATE NOT NULL,
    data_recebimento TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Pendente', -- Pendente, Recebido, Atrasado, Cancelado
    forma_pagamento TEXT DEFAULT 'PIX', -- PIX, Cartao_Credito, Cartao_Debito, Boleto, Dinheiro, Convenio
    categoria_id TEXT,
    categoria_nome TEXT,
    observacoes TEXT,
    nota_fiscal_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE CONTAS A PAGAR (contas_pagar)
CREATE TABLE IF NOT EXISTS public.contas_pagar (
    id TEXT PRIMARY KEY,
    fornecedor_nome TEXT NOT NULL,
    prof_id BIGINT,
    descricao TEXT NOT NULL,
    valor NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    valor_pago NUMERIC(12, 2) DEFAULT 0.00,
    data_vencimento DATE NOT NULL,
    data_pagamento TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Pendente', -- Pendente, Pago, Atrasado, Cancelado
    forma_pagamento TEXT DEFAULT 'PIX', -- PIX, Transferencia, Boleto, Cartao, Dinheiro
    categoria_id TEXT,
    categoria_nome TEXT,
    comprovante_url TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ÍNDICES DE DESEMPENHO
CREATE INDEX IF NOT EXISTS idx_contas_receber_status ON public.contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_vencimento ON public.contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON public.contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON public.contas_pagar(data_vencimento);

-- 5. POLÍTICAS RLS (Row Level Security)
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso Total Categorias" ON public.categorias_financeiras FOR ALL USING (true);
CREATE POLICY "Acesso Total Receber" ON public.contas_receber FOR ALL USING (true);
CREATE POLICY "Acesso Total Pagar" ON public.contas_pagar FOR ALL USING (true);

-- CARGA INICIAL DE CATEGORIAS PADRÃO DA CLÍNICA
INSERT INTO public.categorias_financeiras (id, nome, tipo, cor, icone) VALUES
('cat_rec_1', 'Consultas Particulares', 'Receita', '#10b981', 'UserCheck'),
('cat_rec_2', 'Faturamento Convênios (TISS)', 'Receita', '#06b6d4', 'Receipt'),
('cat_rec_3', 'Procedimentos e Exames', 'Receita', '#3b82f6', 'Activity'),
('cat_desp_1', 'Repasse a Médicos e Psicólogos', 'Despesa', '#8b5cf6', 'User'),
('cat_desp_2', 'Aluguel e Condomínio', 'Despesa', '#ef4444', 'Building'),
('cat_desp_3', 'Insumos e Materiais Médicos', 'Despesa', '#f59e0b', 'Package'),
('cat_desp_4', 'Sistemas e Tecnologia (Software)', 'Despesa', '#6366f1', 'Cpu'),
('cat_desp_5', 'Impostos e Taxas Municipais (ISS)', 'Despesa', '#ec4899', 'Percent')
ON CONFLICT (id) DO NOTHING;
