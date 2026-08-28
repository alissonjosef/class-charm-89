-- Trimestres, liberação/encerramento de quiz por sala e co-professores.

-- 1. Trimestre corrente (calendário: T1 jan-mar, T2 abr-jun, T3 jul-set, T4 out-dez)
CREATE OR REPLACE FUNCTION public.term_of(_at TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(_at, 'YYYY') || '-T' || ceil(extract(month FROM _at) / 3.0)::int;
$$;

CREATE OR REPLACE FUNCTION public.current_term()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT public.term_of(now());
$$;

GRANT EXECUTE ON FUNCTION public.term_of(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_term() TO authenticated;

ALTER TABLE public.points_history ADD COLUMN term TEXT;

CREATE OR REPLACE FUNCTION public.set_points_term()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.term := public.term_of(COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$;

CREATE TRIGGER points_history_set_term
BEFORE INSERT ON public.points_history
FOR EACH ROW EXECUTE FUNCTION public.set_points_term();

UPDATE public.points_history SET term = public.term_of(created_at) WHERE term IS NULL;
ALTER TABLE public.points_history ALTER COLUMN term SET NOT NULL;
CREATE INDEX points_history_term_idx ON public.points_history (term, class_id, created_at DESC);

-- 2. Co-professores por sala
CREATE TABLE public.class_teachers (
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, teacher_id)
);
GRANT SELECT, INSERT, DELETE ON public.class_teachers TO authenticated;
GRANT ALL ON public.class_teachers TO service_role;
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;
CREATE INDEX class_teachers_teacher_idx ON public.class_teachers (teacher_id);

CREATE OR REPLACE FUNCTION public.can_manage_class(_class_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.class_teachers WHERE class_id = _class_id AND teacher_id = _user_id
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_class(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_class(uuid, uuid) TO authenticated;

CREATE POLICY "class_teachers_select" ON public.class_teachers FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.can_manage_class(class_id, auth.uid()));
CREATE POLICY "class_teachers_insert_owner" ON public.class_teachers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND teacher_id = auth.uid())
    AND added_by = auth.uid()
    AND public.has_role(teacher_id, 'teacher')
  );
CREATE POLICY "class_teachers_delete_owner" ON public.class_teachers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND teacher_id = auth.uid()));

-- Salas e membros passam a considerar co-professores
DROP POLICY "classes_select_owner_or_member" ON public.classes;
CREATE POLICY "classes_select_owner_or_member" ON public.classes FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.is_class_member(id, auth.uid())
    OR public.can_manage_class(id, auth.uid())
  );

DROP POLICY "classes_update_owner" ON public.classes;
CREATE POLICY "classes_update_manager" ON public.classes FOR UPDATE TO authenticated
  USING (public.can_manage_class(id, auth.uid()))
  WITH CHECK (public.can_manage_class(id, auth.uid()));

-- Só o dono transfere a sala
CREATE OR REPLACE FUNCTION public.guard_class_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id AND OLD.teacher_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o professor dono pode transferir a sala';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER classes_guard_owner
BEFORE UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.guard_class_owner();

DROP POLICY "class_members_select_owner_or_self" ON public.class_members;
CREATE POLICY "class_members_select_owner_or_self" ON public.class_members FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.can_manage_class(class_id, auth.uid()));

DROP POLICY "class_members_insert_owner" ON public.class_members;
CREATE POLICY "class_members_insert_manager" ON public.class_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_class(class_id, auth.uid()));

DROP POLICY "class_members_delete_owner" ON public.class_members;
CREATE POLICY "class_members_delete_manager" ON public.class_members FOR DELETE TO authenticated
  USING (public.can_manage_class(class_id, auth.uid()));

-- 3. Promoção de aluno a professor (somente por quem já é professor)
CREATE POLICY "user_roles_insert_teacher" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'teacher') AND role = 'teacher');
GRANT INSERT ON public.user_roles TO authenticated;

-- 4. Quiz por sala, com liberação agendada e encerramento
ALTER TABLE public.quizzes
  ADD COLUMN class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  ADD COLUMN open_at TIMESTAMPTZ,
  ADD COLUMN closed_at TIMESTAMPTZ,
  ADD COLUMN term TEXT NOT NULL DEFAULT public.current_term();

UPDATE public.quizzes SET open_at = created_at WHERE published AND open_at IS NULL;
UPDATE public.quizzes SET term = public.term_of(created_at);
CREATE INDEX quizzes_class_term_idx ON public.quizzes (class_id, term, created_at DESC);

CREATE OR REPLACE FUNCTION public.quiz_is_open(_quiz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = _quiz_id
      AND q.published
      AND q.open_at IS NOT NULL
      AND q.open_at <= now()
      AND (q.closed_at IS NULL OR q.closed_at > now())
      AND (q.due_date IS NULL OR q.due_date > now())
  );
$$;
REVOKE ALL ON FUNCTION public.quiz_is_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quiz_is_open(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.quiz_visible_to(_quiz_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = _quiz_id
      AND (
        q.created_by = _user_id
        OR (q.class_id IS NOT NULL AND public.can_manage_class(q.class_id, _user_id))
        OR (
          q.published
          AND q.open_at IS NOT NULL
          AND q.open_at <= now()
          AND (q.class_id IS NULL OR public.is_class_member(q.class_id, _user_id))
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.quiz_visible_to(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quiz_visible_to(uuid, uuid) TO authenticated;

-- Aluno só enxerga quiz liberado da sua sala; rascunho fica com o professor da sala
DROP POLICY "quizzes_select" ON public.quizzes;
CREATE POLICY "quizzes_select" ON public.quizzes FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR (class_id IS NOT NULL AND public.can_manage_class(class_id, auth.uid()))
    OR (
      published
      AND open_at IS NOT NULL
      AND open_at <= now()
      AND (class_id IS NULL OR public.is_class_member(class_id, auth.uid()))
    )
  );

DROP POLICY "quizzes_update_teacher" ON public.quizzes;
CREATE POLICY "quizzes_update_teacher" ON public.quizzes FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR (class_id IS NOT NULL AND public.can_manage_class(class_id, auth.uid()))
  )
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY "quizzes_delete_teacher" ON public.quizzes;
CREATE POLICY "quizzes_delete_teacher" ON public.quizzes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR (class_id IS NOT NULL AND public.can_manage_class(class_id, auth.uid()))
  );

-- Quem não respondeu antes do encerramento não responde mais
DROP POLICY "submissions_insert_own" ON public.submissions;
CREATE POLICY "submissions_insert_own" ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.quiz_is_open(quiz_id)
    AND public.quiz_visible_to(quiz_id, auth.uid())
  );

-- O crédito do quiz entra no extrato da sala do quiz
CREATE OR REPLACE FUNCTION public.credit_submission_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quiz_title TEXT;
  quiz_class UUID;
BEGIN
  IF NEW.score_obtained <> 0 THEN
    SELECT title, class_id INTO quiz_title, quiz_class FROM public.quizzes WHERE id = NEW.quiz_id;
    INSERT INTO public.points_history (student_id, type, points, note, registered_by, class_id)
    VALUES (NEW.student_id, 'QUIZ', NEW.score_obtained, COALESCE(quiz_title, 'Quiz'), NEW.student_id, quiz_class);
  END IF;
  RETURN NEW;
END;
$$;
