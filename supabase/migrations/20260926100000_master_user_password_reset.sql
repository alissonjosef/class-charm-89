-- 1. Usuário master: tem todas as permissões de professor em todas as salas
--    e não pode ser apagado nem rebaixado.
CREATE TABLE public.masters (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.masters TO authenticated;
GRANT ALL ON public.masters TO service_role;
ALTER TABLE public.masters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "masters_select_all_auth" ON public.masters FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_master(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.masters WHERE user_id = _user_id);
$$;
REVOKE ALL ON FUNCTION public.is_master(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;

-- Master conta como professor em todas as checagens existentes.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
      OR (_role = 'teacher' AND EXISTS (SELECT 1 FROM public.masters WHERE user_id = _user_id));
$$;

-- Master gerencia qualquer sala (renomear, alunos, professores, quizzes).
CREATE OR REPLACE FUNCTION public.can_manage_class(_class_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.class_teachers WHERE class_id = _class_id AND teacher_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.masters WHERE user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_class(_class_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.masters WHERE user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "classes_delete_owner" ON public.classes;
CREATE POLICY "classes_delete_owner" ON public.classes FOR DELETE TO authenticated
  USING (public.owns_class(id, auth.uid()));
DROP POLICY IF EXISTS "class_teachers_delete_owner" ON public.class_teachers;
CREATE POLICY "class_teachers_delete_owner" ON public.class_teachers FOR DELETE TO authenticated
  USING (public.owns_class(class_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_class_owner()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
     AND OLD.teacher_id <> auth.uid()
     AND NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Somente o professor dono pode transferir a sala';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Proteções: master não pode ser apagado, perder o papel nem trocar de e-mail.
CREATE OR REPLACE FUNCTION public.protect_master()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'O usuário master não pode ser removido ou alterado';
END;
$$;
REVOKE ALL ON FUNCTION public.protect_master() FROM PUBLIC;

CREATE TRIGGER masters_protect
BEFORE DELETE OR UPDATE ON public.masters
FOR EACH ROW EXECUTE FUNCTION public.protect_master();

CREATE TRIGGER auth_users_protect_master
BEFORE DELETE ON auth.users
FOR EACH ROW WHEN (public.is_master(OLD.id)) EXECUTE FUNCTION public.protect_master();

CREATE TRIGGER auth_users_protect_master_email
BEFORE UPDATE OF email ON auth.users
FOR EACH ROW WHEN (public.is_master(OLD.id) AND NEW.email IS DISTINCT FROM OLD.email)
EXECUTE FUNCTION public.protect_master();

CREATE TRIGGER user_roles_protect_master
BEFORE DELETE OR UPDATE ON public.user_roles
FOR EACH ROW WHEN (public.is_master(OLD.user_id)) EXECUTE FUNCTION public.protect_master();

CREATE TRIGGER profiles_protect_master
BEFORE DELETE ON public.profiles
FOR EACH ROW WHEN (public.is_master(OLD.id)) EXECUTE FUNCTION public.protect_master();

-- 3. Cria o master ebd@ebd.com (senha inicial: domingo) se ainda não existir.
DO $$
DECLARE
  master_id UUID;
BEGIN
  SELECT id INTO master_id FROM auth.users WHERE email = 'ebd@ebd.com' LIMIT 1;

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
  ON CONFLICT (id) DO UPDATE SET name = CASE WHEN profiles.name = '' THEN 'Master EBD' ELSE profiles.name END;

  INSERT INTO public.user_roles (user_id, role) VALUES (master_id, 'teacher')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.masters (user_id) VALUES (master_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- 4. Redefinição de senha por professores (alunos ou outros professores).
--    A senha do master só pode ser trocada pelo próprio master.
CREATE OR REPLACE FUNCTION public.reset_user_password(_user_id UUID, _new_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher') THEN
    RAISE EXCEPTION 'Somente professores podem redefinir senhas';
  END IF;
  IF length(_new_password) < 6 OR length(_new_password) > 72 THEN
    RAISE EXCEPTION 'A senha precisa ter entre 6 e 72 caracteres';
  END IF;
  IF public.is_master(_user_id) AND NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'A senha do usuário master só pode ser alterada pelo próprio master';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = _user_id;

  -- Encerra as sessões antigas para a nova senha valer em todos os aparelhos.
  DELETE FROM auth.sessions WHERE user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_user_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_user_password(uuid, text) TO authenticated;
