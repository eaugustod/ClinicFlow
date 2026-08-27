-- =========================================================================
-- ClinicFlow & Agenda Terapeuta — Correção de Sobreposição de Históricos
-- =========================================================================
-- Execute este script no Supabase SQL Editor para:
-- 1. Remover índice restritivo por data/prof que impedia múltiplos agendamentos do dia
-- 2. Garantir o índice único exclusivo por agendamento_id
-- 3. Atualizar a procedure sp_atualizar_status_agendamento com isolamento estrito por prof_id e agendamento_id
-- 4. Reparar registros de histórico duplicados/sobrepostos (incluindo agendamentos 14041 e 14199)
-- =========================================================================

-- 1. DESFAZER ÍNDICE ÚNICO QUE IMPEDIA MÚLTIPLOS ATENDIMENTOS NO MESMO DIA
DROP INDEX IF EXISTS public.idx_historico_unique_pac_created_date;
DROP INDEX IF EXISTS public.idx_historico_unique_pac_prof_created_date;

-- 2. GARANTIR ÍNDICE ÚNICO EXCLUSIVO POR AGENDAMENTO_ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_historico_unique_agendamento 
ON public.historico (agendamento_id) 
WHERE agendamento_id IS NOT NULL;

-- 3. ATUALIZAÇÃO DA STORED PROCEDURE (RPC) COM ISOLAMENTO SEGURO
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
  
  -- Localiza histórico existente estritamente por agendamento_id
  SELECT id INTO v_hist_id FROM public.historico WHERE agendamento_id = p_agendamento_id LIMIT 1;

  -- Fallback por pac_id, prof_id e data_iso SOMENTE se agendamento_id for nulo (registro órfão/legado daquele prof_id)
  IF v_hist_id IS NULL AND v_pac_id IS NOT NULL AND v_data_iso IS NOT NULL THEN
    SELECT id INTO v_hist_id FROM public.historico 
    WHERE pac_id = v_pac_id 
      AND agendamento_id IS NULL
      AND (prof_id IS NULL OR prof_id = v_prof_id)
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
        prof_id = v_prof_id,
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

-- 4. CORREÇÃO E REPARO DE DADOS LEGADOS / CRUZADOS
-- 4.A Sincroniza prof_id do historico com o prof_id do agendamento onde houver vínculo por agendamento_id
UPDATE public.historico h
SET prof_id = a.prof_id
FROM public.agendamentos a
WHERE h.agendamento_id = a.id
  AND a.prof_id IS NOT NULL
  AND (h.prof_id IS NULL OR h.prof_id <> a.prof_id);

-- 4.B Gera entradas faltantes no histórico para agendamentos válidos que não possuíam histórico próprio
INSERT INTO public.historico (pac_id, agendamento_id, prof_id, tipo, titulo, conteudo, status, data, fonte)
SELECT 
  a.pac_id,
  a.id AS agendamento_id,
  a.prof_id,
  'agendamento',
  'Status do Agendamento: ' || COALESCE(a.status, 'agendado'),
  jsonb_build_object(
    'texto', 'Agendamento no dia ' || COALESCE(a.data_iso, '') || ' às ' || COALESCE(a.hora, '') || ' (Status: ' || COALESCE(a.status, 'agendado') || ').',
    'profId', a.prof_id,
    'hora', a.hora,
    'status', COALESCE(a.stat_terap, 'Agendado'),
    'usuario', 'Sistema (Correção)'
  ),
  COALESCE(a.stat_terap, 'Agendado'),
  COALESCE(a.data_iso || 'T' || COALESCE(a.hora, '08:00') || ':00.000Z', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  'Correção Agendamento'
FROM public.agendamentos a
WHERE NOT EXISTS (
  SELECT 1 FROM public.historico h WHERE h.agendamento_id = a.id
)
AND a.pac_id IS NOT NULL;
