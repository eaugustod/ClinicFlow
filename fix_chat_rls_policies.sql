-- =========================================================================
-- ClinicFlow — Correção de Políticas RLS para Chat e Notificações (Erro 403)
-- =========================================================================
-- Execute este script no Supabase SQL Editor para liberar o acesso 
-- às tabelas 'conversas', 'mensagens' e 'notificacoes' para os roles anon e authenticated.
-- =========================================================================

BEGIN;

-- 1. Tabela CONVERSAS
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo a conversas" ON public.conversas;
CREATE POLICY "Permitir acesso completo a conversas"
ON public.conversas
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON TABLE public.conversas TO anon, authenticated, service_role;

-- 2. Tabela MENSAGENS
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo a mensagens" ON public.mensagens;
CREATE POLICY "Permitir acesso completo a mensagens"
ON public.mensagens
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON TABLE public.mensagens TO anon, authenticated, service_role;

-- 3. Tabela NOTIFICACOES
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo a notificacoes" ON public.notificacoes;
CREATE POLICY "Permitir acesso completo a notificacoes"
ON public.notificacoes
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON TABLE public.notificacoes TO anon, authenticated, service_role;

-- 4. Permissões nas Sequences (IDs autoincrementais)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;
