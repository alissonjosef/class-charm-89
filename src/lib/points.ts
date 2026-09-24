export type RuleGroup = { id: string; name: string; sort_order: number };

export type Rule = {
  id: string;
  group_id: string;
  key: string;
  label: string;
  points: number;
  sort_order: number;
};

// Nomes das regras originais, para o extrato antigo caso a regra tenha sido excluída.
const LEGACY_LABELS: Record<string, string> = {
  PRESENCA: "Presença",
  PONTUALIDADE: "Pontualidade",
  ATRASO: "Atraso",
  FALTA: "Falta não justificada",
  VISITANTE: "Trazer visitante",
  BIBLIA_SIM: "Trazer Bíblia",
  BIBLIA_NAO: "Não trazer Bíblia",
  REVISTA_SIM: "Trazer revista",
  REVISTA_NAO: "Não trazer revista",
  ATIV_PRAZO: "Atividade no prazo",
  ATIV_ATRASO: "Atividade com atraso",
  PONTUALIDADE_GERAL: "Pontualidade geral",
  DESTAQUE_MES: "Destaque do mês",
};

export function ruleLabel(key: string, rules: Rule[] = []) {
  if (key === "QUIZ") return "Quiz respondido";
  return rules.find((r) => r.key === key)?.label ?? LEGACY_LABELS[key] ?? key;
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
