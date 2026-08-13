-- Script para adicionar o campo agendamento_id na tabela historico
-- e popular automaticamente os registros legados vinculando ao id da tabela agendamentos.

-- 1. Adiciona a coluna agendamento_id e o índice correspondente
ALTER TABLE historico ADD COLUMN IF NOT EXISTS agendamento_id BIGINT REFERENCES agendamentos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_historico_agendamento_id ON historico(agendamento_id);

-- 2. Backfill em 3 etapas para popular registros legados na tabela historico

-- Passo A: Vincular por pac_id, prof_id, data e hora exata (precisão máxima)
UPDATE historico h
SET agendamento_id = a.id
FROM agendamentos a
WHERE h.agendamento_id IS NULL
  AND h.pac_id = a.pac_id
  AND h.prof_id = a.prof_id
  AND SUBSTRING(h.data FROM 1 FOR 10) = a.data_iso
  AND (
    h.conteudo->>'hora' = a.hora 
    OR h.conteudo->>'horaIni' = a.hora
    OR h.conteudo->>'hora_ini' = a.hora
  );

-- Passo B: Vincular registros remanescentes por pac_id, prof_id e data_iso
UPDATE historico h
SET agendamento_id = a.id
FROM agendamentos a
WHERE h.agendamento_id IS NULL
  AND h.pac_id = a.pac_id
  AND h.prof_id = a.prof_id
  AND SUBSTRING(h.data FROM 1 FOR 10) = a.data_iso;

-- Passo C: Vincular registros remanescentes por pac_id e data_iso
UPDATE historico h
SET agendamento_id = a.id
FROM agendamentos a
WHERE h.agendamento_id IS NULL
  AND h.pac_id IS NOT NULL
  AND h.pac_id = a.pac_id
  AND SUBSTRING(h.data FROM 1 FOR 10) = a.data_iso;
