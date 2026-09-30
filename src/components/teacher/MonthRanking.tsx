import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { useMonthPoints, type MonthTotals } from "@/hooks/useMonthPoints";
import type { Student } from "@/hooks/useStudents";
import { monthLabel } from "@/lib/terms";

export type RankingRow = { student: Student; totals: MonthTotals };

const EMPTY: MonthTotals = { positive: 0, negative: 0, net: 0 };

/** Ranking do mês pelo saldo (positivos − negativos), restrito aos alunos e pontos da sala. */
export function useMonthRanking(
  students: Student[],
  month: string,
  classId: string | null,
): { ranking: RankingRow[]; rankOf: Map<string, number> } {
  const { data: monthPoints } = useMonthPoints(month, classId);
  const ranking = students
    .map((student) => ({ student, totals: monthPoints?.[student.id] ?? EMPTY }))
    .sort((a, b) => b.totals.net - a.totals.net);
  return { ranking, rankOf: new Map(ranking.map((row, index) => [row.student.id, index + 1])) };
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
  const leader = ranking[0];

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
            {leader && leader.totals.net > 0
              ? `1º ${leader.student.name} · ${leader.totals.net} pontos · ${scope}`
              : `Ranking de ${scope}, pelo saldo do mês`}
          </span>
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${show ? "rotate-180" : ""}`}
        />
      </button>
      {show ? (
        <ol className="animate-pop-in divide-y divide-border border-t border-border">
          {!ranking.length ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum aluno nesta sala.
            </li>
          ) : null}
          {ranking.map(({ student, totals }, index) => (
            <li
              key={student.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg font-display text-xs font-bold ${
                  index === 0 && totals.net > 0
                    ? "bg-gold text-gold-foreground"
                    : index < 3
                      ? "bg-ink text-ink-foreground"
                      : "bg-secondary text-secondary-foreground"
                }`}
              >
                {index + 1}º
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
