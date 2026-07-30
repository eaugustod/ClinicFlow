-- =========================================================================
-- ClinicFlow — Sincronização e Migração para Supabase Auth Nativo
-- =========================================================================
-- Execute este script completo no Supabase SQL Editor.
-- =========================================================================

-- 1. Habilita o pgcrypto no schema public caso não esteja ativo
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 2. Trigger de sincronização de public.usuarios para auth.users
CREATE OR REPLACE FUNCTION public.sync_usuario_to_auth()
RETURNS TRIGGER AS $$
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
        hashed_pass := crypt('clinicflow123', gen_salt('bf'));
    -- Se já for um hash bcrypt
    ELSIF NEW.senha LIKE '$2b$%' OR NEW.senha LIKE '$2a$%' THEN
        hashed_pass := NEW.senha;
    ELSE
        hashed_pass := crypt(NEW.senha, gen_salt('bf'));
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
        -- Atualiza email
        IF NEW.email IS DISTINCT FROM OLD.email THEN
            UPDATE auth.users 
            SET email = NEW.email, updated_at = NOW() 
            WHERE email = OLD.email;
            
            UPDATE auth.identities
            SET identity_data = jsonb_build_object('sub', user_id, 'email', NEW.email), updated_at = NOW()
            WHERE identity_data->>'email' = OLD.email;
        END IF;

        -- Depura e atualiza senha (apenas se mudou)
        IF NEW.senha IS DISTINCT FROM OLD.senha AND NEW.senha IS NOT NULL AND NEW.senha <> '' THEN
            UPDATE auth.users 
            SET encrypted_password = hashed_pass, updated_at = NOW()
            WHERE email = NEW.email;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Associa o trigger à tabela usuarios
DROP TRIGGER IF EXISTS trg_sync_usuario_to_auth ON public.usuarios;
CREATE TRIGGER trg_sync_usuario_to_auth
    AFTER INSERT OR UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_usuario_to_auth();

-- 3. Função de migração inicial dos 12 usuários existentes
CREATE OR REPLACE FUNCTION public.migrate_existing_users()
RETURNS void AS $$
DECLARE
    usr RECORD;
    new_user_id uuid;
    hashed_pass text;
BEGIN
    FOR usr IN SELECT * FROM public.usuarios LOOP
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = usr.email) THEN
            new_user_id := gen_random_uuid();
            
            IF usr.senha_hash IS NOT NULL AND (usr.senha_hash LIKE '$2b$%' OR usr.senha_hash LIKE '$2a$%') THEN
                hashed_pass := usr.senha_hash;
            ELSIF usr.senha IS NOT NULL AND (usr.senha LIKE '$2b$%' OR usr.senha LIKE '$2a$%') THEN
                hashed_pass := usr.senha;
            ELSIF usr.senha IS NOT NULL AND usr.senha <> '' THEN
                hashed_pass := crypt(usr.senha, gen_salt('bf'));
            ELSE
                hashed_pass := crypt('clinicflow123', gen_salt('bf'));
            END IF;

            INSERT INTO auth.users (
                instance_id, id, aud, role, email, encrypted_password,
                email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                confirmation_token, email_change_token_new, recovery_token, email_change
            ) VALUES (
                '00000000-0000-0000-0000-000000000000',
                new_user_id, 'authenticated', 'authenticated', usr.email, hashed_pass,
                NOW(), '{"provider": "email", "providers": ["email"]}',
                jsonb_build_object('nome', usr.nome, 'perfil', usr.perfil),
                COALESCE(usr.created_at, NOW()), NOW(),
                '', '', '', ''
            );

            INSERT INTO auth.identities (
                id, user_id, identity_data, provider, provider_id, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), new_user_id,
                jsonb_build_object('sub', new_user_id, 'email', usr.email),
                'email', usr.email, COALESCE(usr.created_at, NOW()), NOW()
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executa migração
SELECT public.migrate_existing_users();
DROP FUNCTION public.migrate_existing_users();
