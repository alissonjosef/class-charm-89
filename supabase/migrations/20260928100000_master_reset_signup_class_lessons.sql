-- 1. Qualquer professor pode editar, encerrar, reabrir ou excluir qualquer aula
--    (antes só quem abriu a aula podia).
DROP POLICY IF EXISTS "lessons_update_teacher" ON public.lessons;
CREATE POLICY "lessons_update_teacher" ON public.lessons FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "lessons_delete_teacher" ON public.lessons;
CREATE POLICY "lessons_delete_teacher" ON public.lessons FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'teacher'));

-- 2. Redefinição de senha: somente o master.
CREATE OR REPLACE FUNCTION public.reset_user_password(_user_id UUID, _new_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Somente o usuário master pode redefinir senhas';
  END IF;
  IF length(_new_password) < 6 OR length(_new_password) > 72 THEN
    RAISE EXCEPTION 'A senha precisa ter entre 6 e 72 caracteres';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = _user_id;

  DELETE FROM auth.sessions WHERE user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_user_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_user_password(uuid, text) TO authenticated;

-- 3. Cadastro: lista de salas visível antes do login (só id e nome) e
--    matrícula automática na sala escolhida. Toda conta nova é aluno;
--    professores são promovidos pelo master ou por outro professor.
CREATE OR REPLACE FUNCTION public.signup_classes()
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name FROM public.classes ORDER BY name;
$$;
REVOKE ALL ON FUNCTION public.signup_classes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signup_classes() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _class UUID;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  BEGIN
    _class := NULLIF(NEW.raw_user_meta_data->>'class_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    _class := NULL;
  END;
  IF _class IS NOT NULL AND EXISTS (SELECT 1 FROM public.classes WHERE id = _class) THEN
    INSERT INTO public.class_members (class_id, student_id)
    VALUES (_class, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
