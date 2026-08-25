-- SQL Script: Tabela detalhe_pagamentos_profissionais no Supabase
-- Registra o detalhamento completo dos repasses aos profissionais ao realizar o fechamento mensal.

CREATE TABLE IF NOT EXISTS public.detalhe_pagamentos_profissionais (
    id TEXT PRIMARY KEY,
    prof_id BIGINT,
    profissional_nome TEXT NOT NULL,
    competencia TEXT NOT NULL,
    descricao TEXT,
    total_sessoes INT DEFAULT 0,
    valor_repasse NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    valor_bruto NUMERIC(12, 2) DEFAULT 0.00,
    data_vencimento DATE,
    status TEXT DEFAULT 'Pendente',
    forma_pagamento TEXT DEFAULT 'PIX',
    detalhes_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Desempenho
CREATE INDEX IF NOT EXISTS idx_detalhe_pagamentos_prof_id ON public.detalhe_pagamentos_profissionais(prof_id);
CREATE INDEX IF NOT EXISTS idx_detalhe_pagamentos_competencia ON public.detalhe_pagamentos_profissionais(competencia);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.detalhe_pagamentos_profissionais ENABLE ROW LEVEL SECURITY;

-- Política de Acesso Total RLS
DROP POLICY IF EXISTS "Acesso Total Detalhe Pagamentos Profissionais" ON public.detalhe_pagamentos_profissionais;
CREATE POLICY "Acesso Total Detalhe Pagamentos Profissionais"
  ON public.detalhe_pagamentos_profissionais
  FOR ALL
  USING (true)
  WITH CHECK (true);
