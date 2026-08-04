-- =========================================================================
-- SCRIPT DE CRIAÇÃO DO ÍNDICE ÚNICO NA TABELA HISTORICO (SUPABASE / POSTGRES)
-- =========================================================================
-- Aplicação: Agenda Terapeuta & ClinicFlow
-- Objetivo: Impedir fisicamente duplicidades no histórico por Paciente (pac_id) 
--           e Data da Gravação (created_at).
-- Data: 2026-08-04
-- =========================================================================

-- 1. LIMPEZA PREVENTIVA DE REGISTROS DUPLICADOS JÁ EXISTENTES
BEGIN;

WITH DuplicadosOrdenados AS (
    SELECT 
        id,
        pac_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY pac_id, (created_at::date)
            ORDER BY 
                CASE WHEN LOWER(tipo) = 'evolucao' THEN 1 ELSE 2 END ASC, 
                id DESC
        ) AS rnum
    FROM public.historico
    WHERE pac_id IS NOT NULL AND created_at IS NOT NULL
)
DELETE FROM public.historico
WHERE id IN (
    SELECT id FROM DuplicadosOrdenados WHERE rnum > 1
);

COMMIT;

-- 2. CRIAÇÃO DO ÍNDICE ÚNICO REQUISITADO
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_historico_unique_pac_created_date 
ON public.historico (pac_id, ((created_at AT TIME ZONE 'UTC')::date));

COMMIT;

-- 3. CONSULTA DE VERIFICAÇÃO DO ÍNDICE
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'historico' AND indexname = 'idx_historico_unique_pac_created_date';
