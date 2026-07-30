-- =========================================================================
-- ClinicFlow — Scripts de Restrições de Integridade (Foreign Keys)
-- =========================================================================
-- Execute este script no Supabase SQL Editor para garantir a consistência
-- referencial dos dados.
-- =========================================================================

-- 1. Limpeza preventiva de inconsistências (valores que apontam para IDs inexistentes)
BEGIN;

UPDATE pacientes SET plano_id = NULL 
WHERE plano_id IS NOT NULL AND plano_id NOT IN (SELECT id FROM planos_saude);

UPDATE procedimentos SET plano_id = NULL 
WHERE plano_id IS NOT NULL AND plano_id NOT IN (SELECT id FROM planos_saude);

UPDATE agendamentos SET prof_id = NULL 
WHERE prof_id IS NOT NULL AND prof_id NOT IN (SELECT id FROM profissionais);

UPDATE agendamentos SET plano_id = NULL 
WHERE plano_id IS NOT NULL AND plano_id NOT IN (SELECT id FROM planos_saude);

UPDATE guias_sadt SET plano_id = NULL 
WHERE plano_id IS NOT NULL AND plano_id NOT IN (SELECT id FROM planos_saude);

UPDATE guias_sadt SET prof_id = NULL 
WHERE prof_id IS NOT NULL AND prof_id NOT IN (SELECT id FROM profissionais);

UPDATE guias_sadt SET lote_id = NULL 
WHERE lote_id IS NOT NULL AND lote_id NOT IN (SELECT id FROM lotes_tiss);

UPDATE lotes_tiss SET plano_id = NULL 
WHERE plano_id IS NOT NULL AND plano_id NOT IN (SELECT id FROM planos_saude);

UPDATE senhas_plano SET plano_id = NULL 
WHERE plano_id IS NOT NULL AND plano_id NOT IN (SELECT id FROM planos_saude);

UPDATE historico SET pac_id = NULL 
WHERE pac_id IS NOT NULL AND pac_id NOT IN (SELECT id FROM pacientes);

UPDATE historico SET prof_id = NULL 
WHERE prof_id IS NOT NULL AND prof_id NOT IN (SELECT id FROM profissionais);

COMMIT;

-- 2. Criação das Constraints de Chave Estrangeira (Foreign Keys)
BEGIN;

ALTER TABLE pacientes 
  ADD CONSTRAINT fk_pacientes_plano_id FOREIGN KEY (plano_id) REFERENCES planos_saude(id) ON DELETE SET NULL;

ALTER TABLE procedimentos 
  ADD CONSTRAINT fk_procedimentos_plano_id FOREIGN KEY (plano_id) REFERENCES planos_saude(id) ON DELETE SET NULL;

ALTER TABLE agendamentos 
  ADD CONSTRAINT fk_agendamentos_prof_id FOREIGN KEY (prof_id) REFERENCES profissionais(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_agendamentos_plano_id FOREIGN KEY (plano_id) REFERENCES planos_saude(id) ON DELETE SET NULL;

ALTER TABLE guias_sadt 
  ADD CONSTRAINT fk_guias_sadt_plano_id FOREIGN KEY (plano_id) REFERENCES planos_saude(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_guias_sadt_prof_id FOREIGN KEY (prof_id) REFERENCES profissionais(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_guias_sadt_lote_id FOREIGN KEY (lote_id) REFERENCES lotes_tiss(id) ON DELETE SET NULL;

ALTER TABLE lotes_tiss 
  ADD CONSTRAINT fk_lotes_tiss_plano_id FOREIGN KEY (plano_id) REFERENCES planos_saude(id) ON DELETE SET NULL;

ALTER TABLE senhas_plano 
  ADD CONSTRAINT fk_senhas_plano_plano_id FOREIGN KEY (plano_id) REFERENCES planos_saude(id) ON DELETE SET NULL;

ALTER TABLE historico 
  ADD CONSTRAINT fk_historico_pac_id FOREIGN KEY (pac_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_historico_prof_id FOREIGN KEY (prof_id) REFERENCES profissionais(id) ON DELETE SET NULL;

COMMIT;
