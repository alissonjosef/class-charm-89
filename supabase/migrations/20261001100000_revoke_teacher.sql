-- Retirar professor de uma sala: remove o vínculo e, se não sobrar nenhuma sala
-- (nem como dono), o usuário volta a ser aluno. O master nunca é rebaixado.
CREATE OR REPLACE FUNCTION public.revoke_teacher(_user_id UUID, _class_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'teacher') OR public.is_master(auth.uid())) THEN
    RAISE EXCEPTION 'Somente professores podem retirar professor';
  END IF;

  IF public.is_master(_user_id) THEN
    RAISE EXCEPTION 'O master não pode ser retirado';
  END IF;

  DELETE FROM public.class_teachers WHERE class_id = _class_id AND teacher_id = _user_id;

  IF NOT EXISTS (SELECT 1 FROM public.class_teachers WHERE teacher_id = _user_id)
     AND NOT EXISTS (SELECT 1 FROM public.classes WHERE teacher_id = _user_id) THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'teacher';
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'student')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_teacher(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_teacher(uuid, uuid) TO authenticated;
