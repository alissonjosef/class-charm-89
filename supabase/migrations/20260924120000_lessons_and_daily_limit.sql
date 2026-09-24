-- Limite de um lançamento por tipo de ponto por aluno por dia + conceito de "aula" diária.

-- 1. Data do lançamento no fuso America/Sao_Paulo, para aplicar a regra "uma vez por dia".
ALTER TABLE public.points_history ADD COLUMN entry_date DATE;

CREATE OR REPLACE FUNCTION public.set_points_entry_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.entry_date := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
  RETURN NEW;
END;
$$;

CREATE TRIGGER points_history_set_entry_date
BEFORE INSERT ON public.points_history
FOR EACH ROW EXECUTE FUNCTION public.set_points_entry_date();

UPDATE public.points_history
SET entry_date = (created_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE entry_date IS NULL;
ALTER TABLE public.points_history ALTER COLUMN entry_date SET NOT NULL;

-- Um lançamento por (aluno, tipo, dia). QUIZ fica de fora: um aluno pode responder vários quizzes no mesmo dia.
CREATE UNIQUE INDEX points_history_unique_daily_type
  ON public.points_history (student_id, type, entry_date)
  WHERE type <> 'QUIZ';

CREATE INDEX points_history_entry_date_idx ON public.points_history (entry_date);

-- 2. Aulas: uma por dia, com tema, para análise do histórico de pontos.
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_date DATE NOT NULL,
  theme TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lessons_select_all_auth" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "lessons_insert_teacher" ON public.lessons FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'teacher') AND created_by = auth.uid());
CREATE POLICY "lessons_update_teacher" ON public.lessons FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'teacher') AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'teacher') AND created_by = auth.uid());
CREATE POLICY "lessons_delete_teacher" ON public.lessons FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'teacher') AND created_by = auth.uid());

-- 3. Lançamentos vinculados à aula do dia, para agrupar a análise por aula/tema.
ALTER TABLE public.points_history
  ADD COLUMN lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL;
CREATE INDEX points_history_lesson_idx ON public.points_history (lesson_id);
