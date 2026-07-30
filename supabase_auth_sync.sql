-- =========================================================================
-- ClinicFlow — Sincronização e Migração para Supabase Auth Nativo
-- =========================================================================
-- Execute este script completo no Supabase SQL Editor.
-- =========================================================================

-- 1. Habilita o pgcrypto nos schemas public e extensions caso não esteja ativo
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 2. Trigger de sincronização de public.usuarios para auth.users
CREATE OR REPLACE FUNCTION public.sync_usuario_to_auth()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    new_user_id uuid;
    hashed_pass text;
BEGIN
    -- Evita loops de trigger infinitos/recursão (se disparado de outra trigger)
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- Se a senha for nula e for um insert, definimos uma padrão temporária
    IF NEW.senha IS NULL OR NEW.senha = '' THEN
        BEGIN
            hashed_pass := extensions.crypt('clinicflow123', extensions.gen_salt('bf'));
        EXCEPTION WHEN OTHERS THEN
            hashed_pass := public.crypt('clinicflow123', public.gen_salt('bf'));
        END;
    -- Se já for um hash bcrypt
    ELSIF NEW.senha LIKE '$2b$%' OR NEW.senha LIKE '$2a$%' THEN
        hashed_pass := NEW.senha;
    ELSE
        BEGIN
            hashed_pass := extensions.crypt(NEW.senha, extensions.gen_salt('bf'));
        EXCEPTION WHEN OTHERS THEN
            hashed_pass := public.crypt(NEW.senha, public.gen_salt('bf'));
        END;
    END IF;

    -- Se for uma inserção
    IF TG_OP = 'INSERT' THEN
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = NEW.email) THEN
            new_user_id := gen_random_uuid();
            
            INSERT INTO auth.users (
                instance_id, id, aud, role, email, encrypted_password,
                email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                confirmation_token, email_change_token_new, recovery_token, email_change
            ) VALUES (
                '00000000-0000-0000-0000-000000000000',
                new_user_id, 'authenticated', 'authenticated', NEW.email, hashed_pass,
                NOW(), '{"provider": "email", "providers": ["email"]}',
                jsonb_build_object('nome', NEW.nome, 'perfil', NEW.perfil),
                COALESCE(NEW.created_at, NOW()), NOW(),
                '', '', '', ''
            );

            INSERT INTO auth.identities (
                id, user_id, identity_data, provider, provider_id, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), new_user_id,
                jsonb_build_object('sub', new_user_id, 'email', NEW.email),
                'email', NEW.email, COALESCE(NEW.created_at, NOW()), NOW()
            );
        END IF;

    -- Se for um update
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE auth.users
        SET 
            encrypted_password = hashed_pass,
            raw_user_meta_data = jsonb_build_object('nome', NEW.nome, 'perfil', NEW.perfil),
            updated_at = NOW()
        WHERE email = OLD.email OR email = NEW.email;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Vincula a trigger na tabela public.usuarios
DROP TRIGGER IF EXISTS trigger_sync_usuario_to_auth ON public.usuarios;
CREATE TRIGGER trigger_sync_usuario_to_auth
AFTER INSERT OR UPDATE OF senha, email, nome, perfil ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.sync_usuario_to_auth();
