-- Migration: Ajustar tabela lista_espera para inclusão de campos de importação
-- Executar no Editor SQL do Supabase

ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS especialidade TEXT;
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS idade TEXT;
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS periodo TEXT;
ALTER TABLE public.lista_espera ADD COLUMN IF NOT EXISTS data_cadastro TEXT;
