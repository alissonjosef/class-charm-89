-- Garante o acesso do master ebd@ebd.com: senha "domingo", e-mail confirmado,
-- identidade de e-mail presente, papel de professor e registro em masters.
-- Pode ser executado quantas vezes for preciso.
DO $$
DECLARE
  master_id UUID;
BEGIN
  SELECT id INTO master_id FROM auth.users WHERE lower(email) = 'ebd@ebd.com' LIMIT 1;

  IF master_id IS NULL THEN
    master_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', master_id, 'authenticated', 'authenticated',
      'ebd@ebd.com', extensions.crypt('domingo', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Master EBD","role":"teacher"}'::jsonb, now(), now(),
      '', '', '', '', false
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt('domingo', extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = '',
        banned_until = NULL,
        aud = 'authenticated',
        role = 'authenticated',
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
          || '{"provider":"email","providers":["email"]}'::jsonb,
        updated_at = now()
    WHERE id = master_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = master_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), master_id, master_id::text, 'email',
      jsonb_build_object('sub', master_id::text, 'email', 'ebd@ebd.com', 'email_verified', true),
      now(), now(), now()
    );
  END IF;

  INSERT INTO public.profiles (id, name, email)
  VALUES (master_id, 'Master EBD', 'ebd@ebd.com')
  ON CONFLICT (id) DO UPDATE SET email = 'ebd@ebd.com';

  INSERT INTO public.user_roles (user_id, role) VALUES (master_id, 'teacher')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.masters (user_id) VALUES (master_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Sessões antigas saem para a nova senha valer em todos os aparelhos.
  DELETE FROM auth.sessions WHERE user_id = master_id;
END;
$$;
