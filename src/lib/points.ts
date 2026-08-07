export type Rule = {
  key: string;
  label: string;
  points: number;
  group: "presenca" | "material" | "atividades" | "destaque";
};

export const RULES: Rule[] = [
  { key: "PRESENCA", label: "Presença", points: 10, group: "presenca" },
  { key: "PONTUALIDADE", label: "Pontualidade", points: 10, group: "presenca" },
  { key: "ATRASO", label: "Atraso", points: -5, group: "presenca" },
  { key: "FALTA", label: "Falta não justificada", points: -10, group: "presenca" },
  { key: "VISITANTE", label: "Trazer visitante", points: 50, group: "destaque" },
  { key: "BIBLIA_SIM", label: "Trazer Bíblia", points: 20, group: "material" },
  { key: "BIBLIA_NAO", label: "Não trazer Bíblia", points: -30, group: "material" },
  { key: "REVISTA_SIM", label: "Trazer revista", points: 20, group: "material" },
  { key: "REVISTA_NAO", label: "Não trazer revista", points: -30, group: "material" },
  { key: "ATIV_PRAZO", label: "Atividade no prazo", points: 20, group: "atividades" },
  { key: "ATIV_ATRASO", label: "Atividade com atraso", points: 5, group: "atividades" },
  { key: "PONTUALIDADE_GERAL", label: "Pontualidade geral", points: 30, group: "destaque" },
  { key: "DESTAQUE_MES", label: "Destaque do mês", points: 40, group: "destaque" },
];

export const GROUP_LABELS: Record<Rule["group"], string> = {
  presenca: "Chamada",
  material: "Material",
  atividades: "Atividades",
  destaque: "Conquistas",
};

export function ruleLabel(key: string) {
  if (key === "QUIZ") return "Quiz respondido";
  return RULES.find((r) => r.key === key)?.label ?? key;
}

export type Level = { name: string; min: number; emoji: string };

export const LEVELS: Level[] = [
  { name: "Iniciante", min: 0, emoji: "🌱" },
  { name: "Bronze", min: 100, emoji: "🥉" },
  { name: "Prata", min: 250, emoji: "🥈" },
  { name: "Ouro", min: 500, emoji: "🥇" },
  { name: "Diamante", min: 1000, emoji: "💎" },
];

export function levelFor(points: number) {
  let current = LEVELS[0]!;
  for (const level of LEVELS) if (points >= level.min) current = level;
  const next = LEVELS.find((l) => l.min > current.min);
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(100, Math.round(((points - current.min) / span) * 100)) : 100;
  return { current, next, progress };
}
