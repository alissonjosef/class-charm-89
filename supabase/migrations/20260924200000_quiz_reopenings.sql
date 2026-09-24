-- Liberação individual de quiz: o professor reabre um quiz (mesmo antigo/encerrado)
-- para alunos específicos, sem reabrir para a sala toda.

CREATE TABLE public.quiz_reopenings (
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  until TIMESTAMPTZ,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_reopenings TO authenticated;
GRANT ALL ON public.quiz_reopenings TO service_role;
ALTER TABLE public.quiz_reopenings ENABLE ROW LEVEL SECURITY;
CREATE INDEX quiz_reopenings_student_idx ON public.quiz_reopenings (student_id);

CREATE OR REPLACE FUNCTION public.can_manage_quiz(_quiz_id UUID, _user_id UUID)
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
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_quiz(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_quiz(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.quiz_reopened_for(_quiz_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_reopenings r
    WHERE r.quiz_id = _quiz_id
      AND r.student_id = _user_id
      AND (r.until IS NULL OR r.until > now())
  );
$$;
REVOKE ALL ON FUNCTION public.quiz_reopened_for(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quiz_reopened_for(uuid, uuid) TO authenticated;

CREATE POLICY "quiz_reopenings_select" ON public.quiz_reopenings FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.can_manage_quiz(quiz_id, auth.uid()));
CREATE POLICY "quiz_reopenings_insert_manager" ON public.quiz_reopenings FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_quiz(quiz_id, auth.uid()) AND granted_by = auth.uid());
CREATE POLICY "quiz_reopenings_update_manager" ON public.quiz_reopenings FOR UPDATE TO authenticated
  USING (public.can_manage_quiz(quiz_id, auth.uid()))
  WITH CHECK (public.can_manage_quiz(quiz_id, auth.uid()));
CREATE POLICY "quiz_reopenings_delete_manager" ON public.quiz_reopenings FOR DELETE TO authenticated
  USING (public.can_manage_quiz(quiz_id, auth.uid()));

-- Aluno com liberação individual enxerga o quiz mesmo fora da janela da sala
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
    OR public.quiz_reopened_for(id, auth.uid())
  );

-- Responde quem está na janela da sala ou tem liberação individual
DROP POLICY "submissions_insert_own" ON public.submissions;
CREATE POLICY "submissions_insert_own" ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND (
      (public.quiz_is_open(quiz_id) AND public.quiz_visible_to(quiz_id, auth.uid()))
      OR public.quiz_reopened_for(quiz_id, auth.uid())
    )
  );
