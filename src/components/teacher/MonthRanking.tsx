import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { useMonthPoints, type MonthTotals } from "@/hooks/useMonthPoints";
import type { Student } from "@/hooks/useStudents";
import { monthLabel } from "@/lib/terms";

/** `rank` é null para quem ainda não pontuou (saldo ≤ 0): não entra na colocação. */
export type RankingRow = { student: Student; totals: MonthTotals; rank: number | null };

const EMPTY: MonthTotals = { positive: 0, negative: 0, net: 0 };

/**
 * Critérios, nesta ordem: maior saldo; mais pontos positivos; menos pontos
 * negativos. Quem empata em tudo divide a mesma colocação (ex.: dois em 1º e
 * o próximo é 3º).
 */
function compareTotals(a: MonthTotals, b: MonthTotals) {
  return b.net - a.net || b.positive - a.positive || b.negative - a.negative;
}

/** Ranking do mês pelo saldo (positivos − negativos), restrito aos alunos e pontos da sala. */
export function useMonthRanking(
  students: Student[],
  month: string,
  classId: string | null,
): { ranking: RankingRow[]; rankOf: Map<string, number | null> } {
  const { data: monthPoints } = useMonthPoints(month, classId);
  const sorted = students
    .map((student) => ({ student, totals: monthPoints?.[student.id] ?? EMPTY }))
    .sort(
      (a, b) => compareTotals(a.totals, b.totals) || a.student.name.localeCompare(b.student.name),
    );
  const ranking: RankingRow[] = sorted.map((row, index) => {
    if (row.totals.net <= 0) return { ...row, rank: null };
    const previous = index > 0 ? sorted[index - 1]! : null;
    const tied = previous && compareTotals(previous.totals, row.totals) === 0;
    return { ...row, rank: tied ? null : index + 1 };
  });
  for (let i = 1; i < ranking.length; i++) {
    const row = ranking[i]!;
    if (row.rank === null && row.totals.net > 0) row.rank = ranking[i - 1]!.rank;
  }
  return { ranking, rankOf: new Map(ranking.map((row) => [row.student.id, row.rank])) };
}

/** Classe do selo de colocação: ouro para 1º, escuro para o pódio, neutro para o resto. */
export function rankBadgeClass(rank: number | null) {
  if (rank === 1) return "bg-gold text-gold-foreground";
  if (rank !== null && rank <= 3) return "bg-ink text-ink-foreground";
  return "bg-secondary text-secondary-foreground";
}

export function rankLabel(rank: number | null) {
  return rank === null ? "—" : `${rank}º`;
}

export function MonthRanking({
  ranking,
  month,
  className,
  defaultOpen = false,
}: {
  ranking: RankingRow[];
  month: string;
  /** Nome da sala; vazio quando "Todas as salas". */
  className: string | null;
  defaultOpen?: boolean;
}) {
  const [show, setShow] = useState(defaultOpen);
  const scope = className ? `sala ${className}` : "todas as salas";
  const leaders = ranking.filter((row) => row.rank === 1);

  return (
    <section className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-expanded={show}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold text-gold-foreground">
          <Trophy className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-sm font-semibold">
            Destaque do mês · {monthLabel(month)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {leaders.length
              ? `1º ${leaders.map((row) => row.student.name).join(" e ")} · ${leaders[0]!.totals.net} pontos${
                  leaders.length > 1 ? " (empate)" : ""
                } · ${scope}`
              : `Ranking de ${scope}, pelo saldo do mês`}
          </span>
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${show ? "rotate-180" : ""}`}
        />
      </button>
      {show ? (
        <ol className="animate-pop-in divide-y divide-border border-t border-border">
          <li className="px-4 py-2 text-[11px] text-muted-foreground">
            Desempate: mais pontos positivos, depois menos negativos. Empate em tudo divide a
            colocação; quem não pontuou fica sem posição.
          </li>
          {!ranking.length ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum aluno nesta sala.
            </li>
          ) : null}
          {ranking.map(({ student, totals, rank }) => (
            <li
              key={student.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg font-display text-xs font-bold ${rankBadgeClass(rank)}`}
              >
                {rankLabel(rank)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{student.name}</span>
                <span className="block text-xs text-muted-foreground">
                  <span className="text-success">+{totals.positive}</span>
                  {totals.negative ? (
                    <>
                      {" − "}
                      <span className="text-destructive">{Math.abs(totals.negative)}</span>
                    </>
                  ) : null}
                  {" = "}
                  saldo
                </span>
              </span>
              <span className="font-display text-sm font-bold">{totals.net}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
