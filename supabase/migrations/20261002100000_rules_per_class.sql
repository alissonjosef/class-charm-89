-- Regras de pontos por sala. Grupos com class_id NULL são o padrão (modelo)
-- copiado para cada sala nova; cada sala edita as suas sem afetar as outras.

ALTER TABLE public.point_groups
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS point_groups_class_idx ON public.point_groups (class_id, sort_order);

ALTER TABLE public.point_rules DROP CONSTRAINT IF EXISTS point_rules_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS point_rules_group_key_idx ON public.point_rules (group_id, key);

CREATE OR REPLACE FUNCTION public.copy_default_rules(_class_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g RECORD;
  new_group UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.point_groups WHERE class_id = _class_id) THEN
    RETURN;
  END IF;

  FOR g IN SELECT id, name, sort_order FROM public.point_groups WHERE class_id IS NULL ORDER BY sort_order LOOP
    INSERT INTO public.point_groups (name, sort_order, class_id)
    VALUES (g.name, g.sort_order, _class_id)
    RETURNING id INTO new_group;

    INSERT INTO public.point_rules (group_id, key, label, points, sort_order)
    SELECT new_group, key, label, points, sort_order
    FROM public.point_rules WHERE group_id = g.id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.copy_default_rules(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_default_rules(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.classes_copy_default_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.copy_default_rules(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS classes_copy_default_rules ON public.classes;
CREATE TRIGGER classes_copy_default_rules
  AFTER INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.classes_copy_default_rules();

-- Salas que já existem recebem uma cópia do padrão atual.
SELECT public.copy_default_rules(id) FROM public.classes;
