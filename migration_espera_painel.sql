-- ============================================================
-- Migration: Gestão de Salas & Consultórios, Jornada de Trabalho dos Profissionais e Rastreabilidade da Fila de Espera
-- Sistema: ClinicFlow
-- Execute este script completo no SQL Editor do seu Supabase Dashboard
-- ============================================================

-- 1. TABELA DE SALAS & CONSULTÓRIOS DA CLÍNICA (salas_clinica)
CREATE TABLE IF NOT EXISTS public.salas_clinica (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT DEFAULT 'Consultório',
    cor TEXT DEFAULT '#4f8ef7',
    descricao TEXT DEFAULT '',
    ativo BOOLEAN DEFAULT true,
    ordem INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) e conceder acesso total
ALTER TABLE public.salas_clinica ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Salas Clinica" ON public.salas_clinica;
CREATE POLICY "Acesso Total Salas Clinica" ON public.salas_clinica FOR ALL USING (true);

-- Carga inicial com salas padrão da clínica (caso ainda não existam)
INSERT INTO public.salas_clinica (id, nome, categoria, cor, descricao, ativo, ordem) VALUES
('sala-01', 'Sala 01 - Geral / Psicoterapia', 'Consultório', '#4f8ef7', 'Consultório individual para atendimento e psicoterapia', true, 1),
('sala-02', 'Sala 02 - Ludoterapia / Infantil', 'Infantil', '#a855f7', 'Espaço lúdico com recursos pedagógicos para crianças', true, 2),
('sala-03', 'Sala 03 - Integração Sensorial / T.O.', 'T.O.', '#10b981', 'Equipada com balanços e tatames para terapia ocupacional', true, 3),
('sala-04', 'Sala 04 - Fonoaudiologia', 'Fono', '#f59e0b', 'Isolamento acústico e instrumentação fonoaudiológica', true, 4),
('sala-05', 'Sala 05 - Multidisciplinar / Avaliação', 'Multiuso', '#ec4899', 'Sala para avaliações e equipes multidisciplinares', true, 5),
('sala-06', 'Sala 06 - Atendimento Clínico', 'Consultório', '#06b6d4', 'Consultório padrão para atendimento geral', true, 6)
ON CONFLICT (id) DO UPDATE 
SET nome = EXCLUDED.nome,
    categoria = EXCLUDED.categoria,
    cor = EXCLUDED.cor,
    descricao = EXCLUDED.descricao;

-- 2. CADASTRO DE PROFISSIONAIS: JORNADA DE TRABALHO, VÍNCULO DE SALA E FAIXA ETÁRIA
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS jornada jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS sala_padrao text;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS sala_padrao_id text;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS idade_minima integer DEFAULT 0;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS idade_maxima integer DEFAULT 120;

-- 3. AGENDAMENTOS: VÍNCULO DO CONSULTÓRIO / SALA CLÍNICA
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS sala text;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS sala_id text;

-- 4. FILA DE ESPERA: RASTREABILIDADE DA CONVERSÃO EM AGENDAMENTO
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS convertido_em timestamptz;
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS convertido_agendamento_id bigint;
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS convertido_por text;

-- 5. ÍNDICES DE PERFORMANCE PARA OTIMIZAÇÃO DE ENCAIXES E BUSCA DE SALAS
CREATE INDEX IF NOT EXISTS idx_salas_clinica_ativo ON public.salas_clinica (ativo);
CREATE INDEX IF NOT EXISTS idx_salas_clinica_ordem ON public.salas_clinica (ordem);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_sala ON public.agendamentos (data_iso, sala);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_prof ON public.agendamentos (data_iso, prof_id);
