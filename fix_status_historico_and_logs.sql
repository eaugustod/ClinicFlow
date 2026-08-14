-- =========================================================================
-- ClinicFlow & Agenda Terapeuta — Integridade de Status, Histórico e Auditoria
-- =========================================================================
-- Execute este script no Supabase SQL Editor para criar a tabela de logs,
-- a trigger de auditoria e a função atômica de atualização de status.
-- =========================================================================

-- 1. TABELA DE AUDITORIA DE ALTERAÇÃO DE STATUS
CREATE TABLE IF NOT EXISTS public.log_status_agendamento (
  id BIGSERIAL PRIMARY KEY,
  agendamento_id BIGINT NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  status_anterior VARCHAR(100),
  status_novo VARCHAR(100) NOT NULL,
  stat_terap_anterior VARCHAR(100),
  stat_terap_novo VARCHAR(100),
  origem VARCHAR(100) DEFAULT 'sistema',
  usuario_id VARCHAR(100),
  usuario_nome VARCHAR(255),
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativar RLS permissivo equivalente a anon
ALTER TABLE public.log_status_agendamento ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'log_status_agendamento' AND policyname = 'cf_allow_anon'
  ) THEN
    CREATE POLICY "cf_allow_anon" ON public.log_status_agendamento FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Índices de auditoria rápida
CREATE INDEX IF NOT EXISTS idx_log_status_agendamento_id ON public.log_status_agendamento(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_log_status_created_at ON public.log_status_agendamento(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_status_usuario ON public.log_status_agendamento(usuario_id);

-- 2. BACKUP PREVENTIVO, LIMPEZA DE DUPLICIDADES E CRIAÇÃO DO ÍNDICE ÚNICO EM HISTORICO

-- 2.A Criar cópia/backup completo da tabela historico
CREATE TABLE IF NOT EXISTS public.historico_backup_20260814 AS 
SELECT * FROM public.historico;

-- 2.B Limpeza preventiva de duplicidades legadas com o mesmo agendamento_id (mantém evoluções ou o maior ID)
BEGIN;

WITH DuplicadosAgendamento AS (
    SELECT 
        id,
        agendamento_id,
        ROW_NUMBER() OVER (
            PARTITION BY agendamento_id
            ORDER BY 
                CASE WHEN LOWER(tipo) = 'evolucao' THEN 1 ELSE 2 END ASC,
                id DESC
        ) AS rnum
    FROM public.historico
    WHERE agendamento_id IS NOT NULL
)
DELETE FROM public.historico
WHERE id IN (
    SELECT id FROM DuplicadosAgendamento WHERE rnum > 1
);

COMMIT;

-- 2.C Criação do índice único por agendamento_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_historico_unique_agendamento 
ON public.historico (agendamento_id) 
WHERE agendamento_id IS NOT NULL;


-- 3. TRIGGER DE AUDITORIA DE BANCO DE DADOS (Captura automatizada)
CREATE OR REPLACE FUNCTION public.fn_log_status_agendamento_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.stat_terap IS DISTINCT FROM NEW.stat_terap) THEN
    INSERT INTO public.log_status_agendamento (
      agendamento_id,
      status_anterior,
      status_novo,
      stat_terap_anterior,
      stat_terap_novo,
      origem,
      created_at
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      OLD.stat_terap,
      NEW.stat_terap,
      'database_trigger',
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_log_status_agendamento ON public.agendamentos;
CREATE TRIGGER tg_log_status_agendamento
AFTER UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_status_agendamento_change();


-- 4. STORED PROCEDURE (RPC) PARA ATUALIZAÇÃO ATÔMICA DE STATUS E HISTÓRICO
CREATE OR REPLACE FUNCTION public.sp_atualizar_status_agendamento(
  p_agendamento_id BIGINT,
  p_status_novo VARCHAR,
  p_stat_terap_novo VARCHAR DEFAULT NULL,
  p_origem VARCHAR DEFAULT 'Web App',
  p_usuario_id VARCHAR DEFAULT NULL,
  p_usuario_nome VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_agendamento RECORD;
  v_status_hist VARCHAR;
  v_pac_id BIGINT;
  v_prof_id BIGINT;
  v_data_iso VARCHAR;
  v_hora VARCHAR;
  v_hist_id BIGINT;
  v_data_hist VARCHAR;
BEGIN
  -- Busca dados do agendamento
  SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento com ID % não encontrado.', p_agendamento_id;
  END IF;

  v_pac_id := v_agendamento.pac_id;
  v_prof_id := v_agendamento.prof_id;
  v_data_iso := v_agendamento.data_iso;
  v_hora := v_agendamento.hora;

  -- Mapeamento automático de stat_terap se não fornecido explicitamente
  IF p_stat_terap_novo IS NULL OR p_stat_terap_novo = '' THEN
    CASE LOWER(p_status_novo)
      WHEN 'atendido' THEN p_stat_terap_novo := 'Presente';
      WHEN 'em atendimento' THEN p_stat_terap_novo := 'Presente';
      WHEN 'em espera (chegou)' THEN p_stat_terap_novo := 'Em Espera';
      WHEN 'desmarcado' THEN p_stat_terap_novo := 'Falta';
      WHEN 'falta' THEN p_stat_terap_novo := 'Falta';
      WHEN 'cancelado' THEN p_stat_terap_novo := 'Falta';
      ELSE p_stat_terap_novo := COALESCE(v_agendamento.stat_terap, 'Agendado');
    END CASE;
  END IF;

  -- 1. Atualiza agendamentos
  UPDATE public.agendamentos
  SET status = p_status_novo,
      stat_terap = p_stat_terap_novo
  WHERE id = p_agendamento_id;

  -- 2. Registra na tabela log_status_agendamento com origem e usuário
  INSERT INTO public.log_status_agendamento (
    agendamento_id,
    status_anterior,
    status_novo,
    stat_terap_anterior,
    stat_terap_novo,
    origem,
    usuario_id,
    usuario_nome,
    created_at
  ) VALUES (
    p_agendamento_id,
    v_agendamento.status,
    p_status_novo,
    v_agendamento.stat_terap,
    p_stat_terap_novo,
    p_origem,
    p_usuario_id,
    p_usuario_nome,
    NOW()
  );

  -- 3. Sincroniza historico (usando a data real do agendamento)
  v_status_hist := p_stat_terap_novo;
  
  -- Localiza histórico existente por agendamento_id
  SELECT id INTO v_hist_id FROM public.historico WHERE agendamento_id = p_agendamento_id LIMIT 1;

  IF v_hist_id IS NULL AND v_pac_id IS NOT NULL AND v_data_iso IS NOT NULL THEN
    -- Fallback por pac_id e data_iso
    SELECT id INTO v_hist_id FROM public.historico 
    WHERE pac_id = v_pac_id 
      AND data >= v_data_iso 
      AND data <= (v_data_iso || 'T23:59:59.999Z')
    ORDER BY id DESC LIMIT 1;
  END IF;

  -- Formata data do histórico correspondente ao dia/hora da consulta
  IF v_data_iso IS NOT NULL THEN
    v_data_hist := v_data_iso || 'T' || COALESCE(v_hora, '08:00') || ':00.000Z';
  ELSE
    v_data_hist := TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  END IF;

  IF v_hist_id IS NOT NULL THEN
    UPDATE public.historico
    SET agendamento_id = p_agendamento_id,
        status = v_status_hist,
        titulo = 'Status do Agendamento: ' || p_status_novo,
        conteudo = jsonb_build_object(
          'texto', 'Agendamento no dia ' || COALESCE(v_data_iso, '') || ' às ' || COALESCE(v_hora, '') || ' teve o status alterado para "' || p_status_novo || '".',
          'profId', v_prof_id,
          'hora', v_hora,
          'status', v_status_hist,
          'usuario', COALESCE(p_usuario_nome, 'Sistema')
        )
    WHERE id = v_hist_id;
  ELSE
    IF v_pac_id IS NOT NULL THEN
      INSERT INTO public.historico (
        pac_id,
        agendamento_id,
        prof_id,
        tipo,
        titulo,
        conteudo,
        status,
        data,
        fonte
      ) VALUES (
        v_pac_id,
        p_agendamento_id,
        v_prof_id,
        'agendamento',
        'Status do Agendamento: ' || p_status_novo,
        jsonb_build_object(
          'texto', 'Agendamento no dia ' || COALESCE(v_data_iso, '') || ' às ' || COALESCE(v_hora, '') || ' teve o status alterado para "' || p_status_novo || '".',
          'profId', v_prof_id,
          'hora', v_hora,
          'status', v_status_hist,
          'usuario', COALESCE(p_usuario_nome, 'Sistema')
        ),
        v_status_hist,
        v_data_hist,
        p_origem
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'agendamento_id', p_agendamento_id, 
    'status', p_status_novo, 
    'stat_terap', p_stat_terap_novo
  );
END;
$$ LANGUAGE plpgsql;
