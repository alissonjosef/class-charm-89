-- Regras de pontuação editáveis pelo professor (antes eram fixas no código).
-- Categorias (Chamada, Material, Atividades, Conquistas) e regras podem ser
-- renomeadas, ter os pontos alterados, excluídas ou criadas.

CREATE TABLE public.point_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.point_groups TO authenticated;
GRANT ALL ON public.point_groups TO service_role;
ALTER TABLE public.point_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.point_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.point_groups(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  points INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.point_rules TO authenticated;
GRANT ALL ON public.point_rules TO service_role;
ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX point_rules_group_idx ON public.point_rules (group_id, sort_order);

CREATE POLICY "point_groups_select" ON public.point_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "point_groups_write_teacher" ON public.point_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "point_rules_select" ON public.point_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "point_rules_write_teacher" ON public.point_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- Carga inicial com as regras que existiam no código (mesmas chaves, para o
-- extrato antigo continuar mostrando o nome certo).
WITH g AS (
  INSERT INTO public.point_groups (name, sort_order) VALUES
    ('Chamada', 0), ('Material', 1), ('Atividades', 2), ('Conquistas', 3)
  RETURNING id, name
)
INSERT INTO public.point_rules (group_id, key, label, points, sort_order)
SELECT g.id, r.key, r.label, r.points, r.sort_order
FROM g
JOIN (VALUES
  ('Chamada',    'PRESENCA',           'Presença',               10, 0),
  ('Chamada',    'PONTUALIDADE',       'Pontualidade',           10, 1),
  ('Chamada',    'ATRASO',             'Atraso',                 -5, 2),
  ('Chamada',    'FALTA',              'Falta não justificada', -10, 3),
  ('Material',   'BIBLIA_SIM',         'Trazer Bíblia',          20, 0),
  ('Material',   'BIBLIA_NAO',         'Não trazer Bíblia',     -30, 1),
  ('Material',   'REVISTA_SIM',        'Trazer revista',         20, 2),
  ('Material',   'REVISTA_NAO',        'Não trazer revista',    -30, 3),
  ('Atividades', 'ATIV_PRAZO',         'Atividade no prazo',     20, 0),
  ('Atividades', 'ATIV_ATRASO',        'Atividade com atraso',    5, 1),
  ('Conquistas', 'VISITANTE',          'Trazer visitante',       50, 0),
  ('Conquistas', 'PONTUALIDADE_GERAL', 'Pontualidade geral',     30, 1),
  ('Conquistas', 'DESTAQUE_MES',       'Destaque do mês',        40, 2)
) AS r(group_name, key, label, points, sort_order) ON r.group_name = g.name;
