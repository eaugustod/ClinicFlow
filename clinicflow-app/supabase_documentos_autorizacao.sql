-- ==============================================================================
-- SCRIPT DE CRIAÇÃO DO MÓDULO DE GESTÃO DE ANEXOS CLÍNICOS E DOCUMENTOS DE AUTORIZAÇÃO
-- SISTEMA: ClinicFlow
-- TABELA: documentos_autorizacao
-- BUCKET STORAGE: anexos-autorizacao
-- COMPATIBILIDADE: 100% retrocompatível, aditivo, sem quebra de tabelas existentes
-- ==============================================================================

-- 1. Enums com criação idempotente
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento_autorizacao') THEN
    CREATE TYPE tipo_documento_autorizacao AS ENUM (
      'relatorio_medico',        -- Relatório detalhado do médico assistente com diagnóstico/CID
      'pedido_medico',           -- Guia ou receituário de encaminhamento assinado
      'laudo_patologia',         -- Avaliação neuropsicológica, laudo multidisciplinar ou patologia
      'exame_complementar',      -- Audiometria, tomografia, exames genéticos ou laboratoriais
      'justificativa_clinica'    -- Justificativa técnica para extensão de quantidade de sessões
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_envio_documento') THEN
    CREATE TYPE status_envio_documento AS ENUM (
      'PENDENTE_ENVIO',          -- Documento anexado no ClinicFlow, aguardando envio pelo robô
      'ENVIADO_PLANO',           -- Submetido com sucesso no portal da operadora
      'REJEITADO_PLANO',         -- Recusado pelo convênio (ex: ilegível, fora do prazo)
      'DISPENSADO'               -- Convênio/procedimento não exigiu anexo
    );
  END IF;
END $$;

-- 2. Tabela de Documentos de Autorização
CREATE TABLE IF NOT EXISTS public.documentos_autorizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pac_id BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  agendamento_id BIGINT REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  plano_id BIGINT REFERENCES public.planos_saude(id) ON DELETE SET NULL,
  
  tipo_documento tipo_documento_autorizacao NOT NULL,
  nome_original VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  
  -- Dados do Médico Solicitante
  medico_solicitante_nome VARCHAR(255),
  medico_solicitante_crm VARCHAR(50),
  medico_solicitante_cbo VARCHAR(50),

  -- Controle de Vigência Clínica
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_validade DATE,        -- Ex: Pedido médico (30 a 90 dias); Laudos (até 1 ano)
  observacoes TEXT,
  
  -- Metadados de Envio pelo RPA
  status_envio status_envio_documento NOT NULL DEFAULT 'PENDENTE_ENVIO',
  protocolo_envio VARCHAR(100),
  enviado_em TIMESTAMPTZ,
  motivo_recusa TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2.1 Adição retrocompatível das colunas do Médico Solicitante (para bases onde a tabela já foi criada)
ALTER TABLE public.documentos_autorizacao ADD COLUMN IF NOT EXISTS medico_solicitante_nome VARCHAR(255);
ALTER TABLE public.documentos_autorizacao ADD COLUMN IF NOT EXISTS medico_solicitante_crm VARCHAR(50);
ALTER TABLE public.documentos_autorizacao ADD COLUMN IF NOT EXISTS medico_solicitante_cbo VARCHAR(50);

-- 3. Índices de alta performance para busca e filtros
CREATE INDEX IF NOT EXISTS idx_doc_autorizacao_pac_tipo ON public.documentos_autorizacao (pac_id, tipo_documento);
CREATE INDEX IF NOT EXISTS idx_doc_autorizacao_agendamento ON public.documentos_autorizacao (agendamento_id);
CREATE INDEX IF NOT EXISTS idx_doc_autorizacao_status ON public.documentos_autorizacao (status_envio);
CREATE INDEX IF NOT EXISTS idx_doc_autorizacao_validade ON public.documentos_autorizacao (data_validade);
CREATE INDEX IF NOT EXISTS idx_doc_autorizacao_medico_crm ON public.documentos_autorizacao (medico_solicitante_crm);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.documentos_autorizacao ENABLE ROW LEVEL SECURITY;

-- Política de RLS para acesso completo pelo ClinicFlow
DROP POLICY IF EXISTS "Permitir acesso completo em documentos_autorizacao" ON public.documentos_autorizacao;
CREATE POLICY "Permitir acesso completo em documentos_autorizacao"
  ON public.documentos_autorizacao
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Configuração do Bucket Privado no Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anexos-autorizacao',
  'anexos-autorizacao',
  false,
  5242880, -- 5 MB por arquivo
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- Políticas de acesso para o Bucket anexos-autorizacao
DROP POLICY IF EXISTS "Acesso Leitura Bucket Anexos" ON storage.objects;
CREATE POLICY "Acesso Leitura Bucket Anexos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'anexos-autorizacao');

DROP POLICY IF EXISTS "Upload Bucket Anexos" ON storage.objects;
CREATE POLICY "Upload Bucket Anexos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'anexos-autorizacao');

DROP POLICY IF EXISTS "Update Bucket Anexos" ON storage.objects;
CREATE POLICY "Update Bucket Anexos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'anexos-autorizacao');

DROP POLICY IF EXISTS "Delete Bucket Anexos" ON storage.objects;
CREATE POLICY "Delete Bucket Anexos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'anexos-autorizacao');
