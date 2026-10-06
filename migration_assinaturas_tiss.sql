-- ============================================================
-- Migration: Adicionar campos de assinatura para TISS SP/SADT
-- Tabela: pacientes e profissionais
-- ============================================================

-- 1. Adicionar campo de assinatura escaneada na tabela de pacientes (beneficiários)
ALTER TABLE IF EXISTS pacientes 
ADD COLUMN IF NOT EXISTS assinatura text;

-- 2. Adicionar campo de assinatura na tabela de profissionais (contratado / executante)
ALTER TABLE IF EXISTS profissionais 
ADD COLUMN IF NOT EXISTS assinatura text;

-- Comentários informativos
COMMENT ON COLUMN pacientes.assinatura IS 'Imagem escaneada/digital da assinatura do beneficiário ou responsável (Base64 ou URL) para preenchimento dos campos 57 e 67 da Guia SADT TISS';
COMMENT ON COLUMN profissionais.assinatura IS 'Imagem da assinatura digital/escaneada do profissional (Base64 ou URL) para preenchimento do campo 68 (Assinatura do Contratado) da Guia SADT TISS';
