CREATE TYPE public.app_role AS ENUM ('teacher','student');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_all_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN NEW.raw_user_meta_data->>'role' = 'teacher' THEN 'teacher'::public.app_role ELSE 'student'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  points INTEGER NOT NULL,
  note TEXT,
  registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.points_history TO authenticated;
GRANT ALL ON public.points_history TO service_role;
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_select_own_or_teacher" ON public.points_history FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "points_insert_teacher" ON public.points_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'teacher') AND registered_by = auth.uid());
CREATE POLICY "points_delete_teacher" ON public.points_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'teacher'));

CREATE INDEX points_history_student_idx ON public.points_history (student_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_total_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.profiles SET total_points = total_points + NEW.points WHERE id = NEW.student_id;
    RETURN NEW;
  ELSE
    UPDATE public.profiles SET total_points = total_points - OLD.points WHERE id = OLD.student_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER points_history_sync
AFTER INSERT OR DELETE ON public.points_history
FOR EACH ROW EXECUTE FUNCTION public.sync_total_points();

CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quizzes_select" ON public.quizzes FOR SELECT TO authenticated
  USING (published OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "quizzes_insert_teacher" ON public.quizzes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'teacher') AND created_by = auth.uid());
CREATE POLICY "quizzes_update_teacher" ON public.quizzes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'teacher')) WITH CHECK (public.has_role(auth.uid(),'teacher'));
CREATE POLICY "quizzes_delete_teacher" ON public.quizzes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'teacher'));

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_obtained INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, student_id)
);
GRANT SELECT, INSERT ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submissions_select_own_or_teacher" ON public.submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "submissions_insert_own" ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE OR REPLACE FUNCTION public.credit_submission_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE quiz_title TEXT;
BEGIN
  IF NEW.score_obtained <> 0 THEN
    SELECT title INTO quiz_title FROM public.quizzes WHERE id = NEW.quiz_id;
    INSERT INTO public.points_history (student_id, type, points, note, registered_by)
    VALUES (NEW.student_id, 'QUIZ', NEW.score_obtained, COALESCE(quiz_title,'Quiz'), NEW.student_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER submissions_credit_points
AFTER INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.credit_submission_points();