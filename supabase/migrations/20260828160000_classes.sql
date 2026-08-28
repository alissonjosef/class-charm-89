CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.class_members (
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);
GRANT SELECT, INSERT, DELETE ON public.class_members TO authenticated;
GRANT ALL ON public.class_members TO service_role;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX class_members_student_idx ON public.class_members (student_id);

CREATE OR REPLACE FUNCTION public.is_class_member(_class_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members WHERE class_id = _class_id AND student_id = _user_id
  );
$$;
REVOKE ALL ON FUNCTION public.is_class_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) TO authenticated;

CREATE POLICY "classes_select_owner_or_member" ON public.classes FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_class_member(id, auth.uid()));
CREATE POLICY "classes_insert_teacher" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid());
CREATE POLICY "classes_update_owner" ON public.classes FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "classes_delete_owner" ON public.classes FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

CREATE OR REPLACE FUNCTION public.owns_class(_class_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = _user_id
  );
$$;
REVOKE ALL ON FUNCTION public.owns_class(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_class(uuid, uuid) TO authenticated;

CREATE POLICY "class_members_select_owner_or_self" ON public.class_members FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.owns_class(class_id, auth.uid()));
CREATE POLICY "class_members_insert_owner" ON public.class_members FOR INSERT TO authenticated
  WITH CHECK (public.owns_class(class_id, auth.uid()));
CREATE POLICY "class_members_delete_owner" ON public.class_members FOR DELETE TO authenticated
  USING (public.owns_class(class_id, auth.uid()));

ALTER TABLE public.points_history
  ADD COLUMN class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;
CREATE INDEX points_history_class_idx ON public.points_history (class_id, created_at DESC);
