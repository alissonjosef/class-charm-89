-- Delegar professor: troca o papel do usuário de aluno para professor (em vez de acumular os dois).
CREATE OR REPLACE FUNCTION public.promote_to_teacher(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'teacher') OR public.is_master(auth.uid())) THEN
    RAISE EXCEPTION 'Somente professores podem delegar professor';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'student';
  DELETE FROM public.class_members WHERE student_id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'teacher')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_to_teacher(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_to_teacher(uuid) TO authenticated;

-- Corrige quem já foi delegado antes e ficou com os dois papéis.
DELETE FROM public.user_roles s
USING public.user_roles t
WHERE s.user_id = t.user_id AND s.role = 'student' AND t.role = 'teacher';

DELETE FROM public.class_members m
USING public.user_roles t
WHERE m.student_id = t.user_id AND t.role = 'teacher';
