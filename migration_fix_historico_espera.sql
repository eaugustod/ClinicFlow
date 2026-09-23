-- =========================================================================
-- ClinicFlow & Agenda Terapeuta — Correção Definitiva de Status e Histórico
-- =========================================================================
-- Este script:
-- 1. Atualiza a procedure 'sp_atualizar_status_agendamento' com:
--    - Auto-resolução de pac_id (busca por nome na tabela pacientes caso pac_id do agendamento seja nulo)
--    - Atualização automática de agendamentos.pac_id caso recuperado
--    - Suporte flexível a qualquer variação de status ('Em espera', 'Espera', 'Aguardando', etc.)
--    - Parâmetro opcional p_pac_id para garantir vínculo
-- 2. Repara o agendamento ID 15732 especificamente:
--    - Vincula ao pac_id correto
--    - Garante stat_terap = 'Em Espera'
--    - Cria o registro na tabela historico caso ausente
-- 3. Executa varredura de reparo geral para agendamentos que ficaram sem pac_id ou sem registro de histórico
-- =========================================================================

-- 1. ATUALIZAÇÃO DA STORED PROCEDURE COM AUTO-RESOLUÇÃO E BLINDAGEM DE PAC_ID
CREATE OR REPLACE FUNCTION public.sp_atualizar_status_agendamento(
  p_agendamento_id BIGINT,
  p_status_novo VARCHAR,
  p_stat_terap_novo VARCHAR DEFAULT NULL,
  p_origem VARCHAR DEFAULT 'Web App',
  p_usuario_id VARCHAR DEFAULT NULL,
  p_usuario_nome VARCHAR DEFAULT NULL,
  p_pac_id BIGINT DEFAULT NULL
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
  v_nome_paciente VARCHAR;
BEGIN
  -- 1. Busca dados do agendamento
  SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento com ID % não encontrado.', p_agendamento_id;
  END IF;

  v_pac_id := COALESCE(v_agendamento.pac_id, p_pac_id);
  v_prof_id := v_agendamento.prof_id;
  v_data_iso := v_agendamento.data_iso;
  v_hora := v_agendamento.hora;
  v_nome_paciente := v_agendamento.paciente;

  -- 2. Auto-resolução de pac_id: se for nulo, tenta localizar em pacientes pelo nome
  IF v_pac_id IS NULL AND v_nome_paciente IS NOT NULL AND TRIM(v_nome_paciente) <> '' THEN
    SELECT id INTO v_pac_id 
    FROM public.pacientes 
    WHERE LOWER(TRIM(nome)) = LOWER(TRIM(v_nome_paciente))
    LIMIT 1;

    -- Se encontrou, atualiza o próprio agendamento para sanar inconsistência futura
    IF v_pac_id IS NOT NULL THEN
      UPDATE public.agendamentos 
      SET pac_id = v_pac_id 
      WHERE id = p_agendamento_id;
    END IF;
  END IF;

  -- 3. Mapeamento robusto e flexível de stat_terap se não fornecido
  IF p_stat_terap_novo IS NULL OR TRIM(p_stat_terap_novo) = '' THEN
    IF LOWER(p_status_novo) LIKE '%espera%' OR LOWER(p_status_novo) LIKE '%aguard%' OR LOWER(p_status_novo) LIKE '%chegou%' THEN
      p_stat_terap_novo := 'Em Espera';
    ELSIF LOWER(p_status_novo) IN ('atendido', 'em atendimento') OR LOWER(p_status_novo) LIKE '%atend%' OR LOWER(p_status_novo) LIKE '%realiz%' THEN
      p_stat_terap_novo := 'Presente';
    ELSIF LOWER(p_status_novo) IN ('desmarcado', 'falta', 'cancelado') OR LOWER(p_status_novo) LIKE '%desmarc%' OR LOWER(p_status_novo) LIKE '%cancel%' OR LOWER(p_status_novo) LIKE '%falt%' THEN
      p_stat_terap_novo := 'Falta';
    ELSIF LOWER(p_status_novo) LIKE '%confirm%' THEN
      p_stat_terap_novo := 'Confirmado';
    ELSE
      p_stat_terap_novo := COALESCE(v_agendamento.stat_terap, 'Agendado');
    END IF;
  END IF;

  -- 4. Atualiza agendamentos
  UPDATE public.agendamentos
  SET status = p_status_novo,
      stat_terap = p_stat_terap_novo,
      pac_id = COALESCE(agendamentos.pac_id, v_pac_id)
  WHERE id = p_agendamento_id;

  -- 5. Registra na tabela log_status_agendamento com origem e usuário
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

  -- 6. Sincroniza historico
  v_status_hist := p_stat_terap_novo;

  -- Localiza histórico existente estritamente por agendamento_id
  SELECT id INTO v_hist_id FROM public.historico WHERE agendamento_id = p_agendamento_id LIMIT 1;

  -- Fallback de histórico somente se agendamento_id for nulo (registro legado)
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
        pac_id = COALESCE(historico.pac_id, v_pac_id),
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
    -- Garante inserção mesmo se v_pac_id ainda for nulo (evitando falha silenciosa se houver nome)
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
    'pac_id', v_pac_id,
    'status', p_status_novo, 
    'stat_terap', p_stat_terap_novo
  );
END;
$$ LANGUAGE plpgsql;

-- 2. REPARO ESPECÍFICO DO AGENDAMENTO ID 15732
-- A. Resolve pac_id caso esteja nulo
UPDATE public.agendamentos a
SET pac_id = p.id
FROM public.pacientes p
WHERE a.id = 15732
  AND a.pac_id IS NULL
  AND LOWER(TRIM(a.paciente)) = LOWER(TRIM(p.nome));

-- B. Garante stat_terap = 'Em Espera' para o 15732
UPDATE public.agendamentos
SET stat_terap = 'Em Espera'
WHERE id = 15732
  AND (stat_terap IS NULL OR stat_terap <> 'Em Espera');

-- C. Insere o registro de histórico faltante para o 15732
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
)
SELECT 
  a.pac_id,
  a.id,
  a.prof_id,
  'agendamento',
  'Status do Agendamento: ' || COALESCE(a.status, 'Em espera (Chegou)'),
  jsonb_build_object(
    'texto', 'Agendamento no dia ' || COALESCE(a.data_iso, '') || ' às ' || COALESCE(a.hora, '') || ' teve o status alterado para "' || COALESCE(a.status, 'Em espera (Chegou)') || '".',
    'profId', a.prof_id,
    'hora', a.hora,
    'status', 'Em Espera',
    'usuario', 'Sistema (Correção Agendamento 15732)'
  ),
  'Em Espera',
  COALESCE(a.data_iso || 'T' || COALESCE(a.hora, '08:00') || ':00.000Z', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  'Correção Agendamento 15732'
FROM public.agendamentos a
WHERE a.id = 15732
  AND a.pac_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.historico h WHERE h.agendamento_id = 15732
  );

-- 3. VARREDURA GERAL DE INTEGRIDADE (BACKFILL DE PAC_ID E HISTÓRICOS FALTANTES)
-- 3.A Sincroniza pac_id em todos os agendamentos que estão com pac_id nulo mas tem nome correspondente em pacientes
UPDATE public.agendamentos a
SET pac_id = p.id
FROM public.pacientes p
WHERE a.pac_id IS NULL
  AND LOWER(TRIM(a.paciente)) = LOWER(TRIM(p.nome));

-- 3.B Normaliza stat_terap = 'Em Espera' para agendamentos com status contendo 'espera' ou 'chegou'
UPDATE public.agendamentos
SET stat_terap = 'Em Espera'
WHERE (LOWER(status) LIKE '%espera%' OR LOWER(status) LIKE '%chegou%')
  AND (stat_terap IS NULL OR stat_terap <> 'Em Espera');

-- 3.C Gera registro no historico para agendamentos que não possuem registro correspondente
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
)
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
    'usuario', 'Sistema (Varredura de Integridade)'
  ),
  COALESCE(a.stat_terap, 'Agendado'),
  COALESCE(a.data_iso || 'T' || COALESCE(a.hora, '08:00') || ':00.000Z', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  'Sincronização Histórico'
FROM public.agendamentos a
WHERE NOT EXISTS (
  SELECT 1 FROM public.historico h WHERE h.agendamento_id = a.id
)
AND a.pac_id IS NOT NULL;
