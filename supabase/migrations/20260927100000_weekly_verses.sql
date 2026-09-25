-- Versículo da semana: professor cadastra referência, texto, tema e a data em que fica liberado
-- para os alunos. O aluno só enxerga versículos cuja data de liberação já chegou.
CREATE TABLE IF NOT EXISTS public.weekly_verses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_date DATE NOT NULL UNIQUE,
  reference TEXT NOT NULL,
  verse_text TEXT NOT NULL,
  theme TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_verses TO authenticated;
GRANT ALL ON public.weekly_verses TO service_role;
ALTER TABLE public.weekly_verses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_verses_select" ON public.weekly_verses;
CREATE POLICY "weekly_verses_select" ON public.weekly_verses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher')
    OR release_date <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );

DROP POLICY IF EXISTS "weekly_verses_insert_teacher" ON public.weekly_verses;
CREATE POLICY "weekly_verses_insert_teacher" ON public.weekly_verses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());

DROP POLICY IF EXISTS "weekly_verses_update_teacher" ON public.weekly_verses;
CREATE POLICY "weekly_verses_update_teacher" ON public.weekly_verses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "weekly_verses_delete_teacher" ON public.weekly_verses;
CREATE POLICY "weekly_verses_delete_teacher" ON public.weekly_verses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'));
