-- =========================================================================
-- ClinicFlow — Script de Restrição de Unicidade e Permissões RLS para Chat
-- =========================================================================
-- Execute este script no Supabase SQL Editor.
-- =========================================================================

BEGIN;

-- 1. Garante que cada paciente tenha NO MÁXIMO UMA conversa (evita duplicidade de salas)
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS unique_paciente_id;
ALTER TABLE public.conversas ADD CONSTRAINT unique_paciente_id UNIQUE (paciente_id);

-- 2. Tabela CONVERSAS
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo a conversas" ON public.conversas;
CREATE POLICY "Permitir acesso completo a conversas"
ON public.conversas
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON TABLE public.conversas TO anon, authenticated, service_role;

-- 3. Tabela MENSAGENS
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo a mensagens" ON public.mensagens;
CREATE POLICY "Permitir acesso completo a mensagens"
ON public.mensagens
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON TABLE public.mensagens TO anon, authenticated, service_role;

-- 4. Tabela NOTIFICACOES
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo a notificacoes" ON public.notificacoes;
CREATE POLICY "Permitir acesso completo a notificacoes"
ON public.notificacoes
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON TABLE public.notificacoes TO anon, authenticated, service_role;

-- 5. Permissões nas Sequences (IDs autoincrementais)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;
