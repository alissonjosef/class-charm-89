-- Retirar professor de uma sala. Se não sobrar nenhuma outra sala delegada, volta a ser aluno;
-- salas que ele criou passam para quem está retirando. Retorna TRUE quando virou aluno.
DROP FUNCTION IF EXISTS public.revoke_teacher(uuid, uuid);

CREATE OR REPLACE FUNCTION public.revoke_teacher(_user_id UUID, _class_id UUID)
RETURNS BOOLEAN
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

  IF EXISTS (SELECT 1 FROM public.class_teachers WHERE teacher_id = _user_id) THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (SELECT 1 FROM public.classes WHERE teacher_id = _user_id) THEN
    IF NOT public.is_master(auth.uid()) THEN
      RETURN FALSE;
    END IF;
    UPDATE public.classes SET teacher_id = auth.uid() WHERE teacher_id = _user_id;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'teacher';
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_teacher(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_teacher(uuid, uuid) TO authenticated;
