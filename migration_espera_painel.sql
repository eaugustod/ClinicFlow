-- ============================================================
-- Migration: Suporte a Consultórios nos Agendamentos e Rastreabilidade da Fila de Espera
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Suporte a sala/consultório nos agendamentos clínicos
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS sala text;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS sala_id text;

-- 2. Rastreabilidade de conversão na fila de espera
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS convertido_em timestamptz;
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS convertido_agendamento_id bigint;
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS convertido_por text;

-- 3. Índices para otimização de busca de horários e salas
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_sala ON public.agendamentos (data_iso, sala);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_prof ON public.agendamentos (data_iso, prof_id);
