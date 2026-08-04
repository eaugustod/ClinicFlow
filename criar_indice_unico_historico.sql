-- =========================================================================
-- SCRIPT DE CRIAÇÃO DO ÍNDICE ÚNICO NA TABELA HISTORICO (SUPABASE / POSTGRES)
-- =========================================================================
-- Aplicação: Agenda Terapeuta & ClinicFlow
-- Chave Única Composta por 3 Campos:
--   1. pac_id  (ID do Paciente)
--   2. prof_id (ID do Profissional)
--   3. created_at (apenas a DATA YYYY-MM-DD extraída do timestamp)
--
-- Data: 2026-08-04
-- =========================================================================

-- 1. LIMPEZA PREVENTIVA DE REGISTROS DUPLICADOS JÁ EXISTENTES
BEGIN;

WITH DuplicadosOrdenados AS (
    SELECT 
        id,
        pac_id,
        COALESCE(prof_id, 0) AS prof_id_norm,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY pac_id, COALESCE(prof_id, 0), (created_at::date)
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

-- 2. REMOVE ÍNDICES ANTIGOS SE EXISTIREM
DROP INDEX IF EXISTS public.idx_historico_unique_pac_created_date;
DROP INDEX IF EXISTS public.idx_historico_unique_pac_prof_created_date;

-- 3. CRIAÇÃO DO ÍNDICE ÚNICO COMPOSTO POR (pac_id, prof_id, created_at::date)
BEGIN;

CREATE UNIQUE INDEX idx_historico_unique_pac_prof_created_date 
ON public.historico (pac_id, COALESCE(prof_id, 0), ((created_at AT TIME ZONE 'UTC')::date));

COMMIT;

-- 4. VERIFICAÇÃO DO ÍNDICE CRIADO NO BANCO
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'historico' AND indexname = 'idx_historico_unique_pac_prof_created_date';
