import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Lock, QrCode, Search, Trophy, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClassMembers } from "@/hooks/useClasses";
import { useTermPoints } from "@/hooks/useTermPoints";
import { useStudents, type Student } from "@/hooks/useStudents";
import { useTodayLesson } from "@/hooks/useLessons";
import { useMonthPoints } from "@/hooks/useMonthPoints";
import { monthLabel, monthOf, todayInSaoPaulo } from "@/lib/terms";
import { ALL_CLASSES, ClassBar } from "./ClassBar";
import { levelFor, type Rule } from "@/lib/points";
import { useRules } from "@/hooks/useRules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PointsBurst } from "@/components/Feedback";
import { EmptyState } from "@/components/States";
import { QrScannerDialog } from "./QrScannerDialog";

export function AttendanceTab({
  classId,
  onClassChange,
  term,
  onTermChange,
  onCelebrate,
}: {
  classId: string;
  onClassChange: (value: string) => void;
  term: string;
  onTermChange: (value: string) => void;
  onCelebrate: () => void;
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data: allStudents, isLoading } = useStudents();
  const { data: rulesData } = useRules();
  const { data: members } = useClassMembers(classId === ALL_CLASSES ? null : classId);
  const { data: termPoints } = useTermPoints(term, classId === ALL_CLASSES ? null : classId);
  const pointsOf = (studentId: string) => termPoints?.[studentId] ?? 0;
  const students = (
    classId === ALL_CLASSES
      ? allStudents
      : allStudents?.filter((student) => (members ?? []).includes(student.id))
  )
    ?.slice()
    .sort((a, b) => pointsOf(b.id) - pointsOf(a.id));
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [burst, setBurst] = useState<{ studentId: string; value: number; id: number } | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [scanning, setScanning] = useState(false);

  const today = todayInSaoPaulo();
  const month = monthOf(today);
  const { data: monthPoints } = useMonthPoints(month);
  const ranking = (allStudents ?? [])
    .map((student) => ({
      student,
      totals: monthPoints?.[student.id] ?? { positive: 0, negative: 0, net: 0 },
    }))
    .sort((a, b) => b.totals.net - a.totals.net);
  const rankOf = new Map(ranking.map((row, index) => [row.student.id, index + 1]));
  const { data: todayLesson } = useTodayLesson();
  const lessonClosed = Boolean(todayLesson?.closed_at);
  const studentIds = (students ?? []).map((s) => s.id);
  const { data: todayEntries } = useQuery({
    queryKey: ["today-entries", today, studentIds.slice().sort().join(",")],
    enabled: studentIds.length > 0,
    queryFn: async (): Promise<{ id: string; student_id: string; type: string }[]> => {
      const { data, error } = await supabase
        .from("points_history")
        .select("id, student_id, type")
        .eq("entry_date", today)
        .in("student_id", studentIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const appliedToday = new Map(
    (todayEntries ?? []).map((row) => [`${row.student_id}:${row.type}`, row.id]),
  );

  function invalidatePoints() {
    queryClient.invalidateQueries({ queryKey: ["students"] });
    queryClient.invalidateQueries({ queryKey: ["class-history"] });
    queryClient.invalidateQueries({ queryKey: ["term-points"] });
    queryClient.invalidateQueries({ queryKey: ["month-points"] });
    queryClient.invalidateQueries({ queryKey: ["today-entries"] });
  }

  const undo = useMutation({
    mutationFn: async ({
      entryId,
      student,
      rule,
    }: {
      entryId: string;
      student: Student;
      rule: Rule;
    }) => {
      if (lessonClosed)
        throw new Error("A aula de hoje foi encerrada. Reabra na aba Aula para corrigir.");
      const { data, error } = await supabase
        .from("points_history")
        .delete()
        .eq("id", entryId)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Esse lançamento não pode ser desfeito");
      return { student, rule };
    },
    onSuccess: ({ student, rule }) => {
      toast.success(`${rule.label} desfeito para ${student.name}`);
      invalidatePoints();
    },
    onError: (error: Error) => toast.error(error.message || "Erro ao desfazer"),
  });

  const apply = useMutation({
    mutationFn: async ({ student, rule }: { student: Student; rule: Rule }) => {
      if (lessonClosed)
        throw new Error("A aula de hoje foi encerrada. Reabra na aba Aula para lançar pontos.");
      const { error } = await supabase.from("points_history").insert({
        student_id: student.id,
        type: rule.key,
        points: rule.points,
        note: rule.label,
        registered_by: session!.user.id,
        class_id: classId === ALL_CLASSES ? null : classId,
        lesson_id: todayLesson?.id ?? null,
      });
      if (error) throw error;
      return { student, rule };
    },
    onSuccess: ({ student, rule }) => {
      setBurst({ studentId: student.id, value: rule.points, id: Date.now() });
      if (rule.points >= 40) onCelebrate();
      toast.success(`${rule.label} para ${student.name}`, {
        description: `${rule.points > 0 ? "+" : ""}${rule.points} pontos`,
      });
      invalidatePoints();
    },
    onError: (error: { code?: string } & Error) => {
      if (error?.code === "23505") {
        toast.error("Essa nota já foi lançada hoje para este aluno");
        queryClient.invalidateQueries({ queryKey: ["today-entries"] });
        return;
      }
      toast.error(error instanceof Error ? error.message : "Erro ao lançar");
    },
  });

  const filtered = (students ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!students?.length) {
    return (
      <>
        <ClassBar
          classId={classId}
          onChange={onClassChange}
          term={term}
          onTermChange={onTermChange}
        />
        <EmptyState
          title={
            classId === ALL_CLASSES ? "Nenhum aluno cadastrado ainda" : "Nenhum aluno nesta sala"
          }
          text={
            classId === ALL_CLASSES
              ? "Peça para os alunos criarem a conta escolhendo o perfil “Aluno”. Eles aparecerão aqui automaticamente."
              : "Na aba “Salas”, use “Alunos” para escolher quem faz parte desta turma."
          }
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      <ClassBar
        classId={classId}
        onChange={onClassChange}
        term={term}
        onTermChange={onTermChange}
      />

      <section className="surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowRanking((v) => !v)}
          aria-expanded={showRanking}
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
              {ranking[0] && ranking[0].totals.net > 0
                ? `1º ${ranking[0].student.name} · ${ranking[0].totals.net} pontos`
                : "Ranking geral de todas as salas, pelo saldo do mês"}
            </span>
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${showRanking ? "rotate-180" : ""}`}
          />
        </button>
        {showRanking ? (
          <ol className="animate-pop-in divide-y divide-border border-t border-border">
            {ranking.map(({ student, totals }, index) => (
              <li
                key={student.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg font-display text-xs font-bold ${
                    index === 0
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

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar aluno"
            className="pl-9"
          />
        </div>
        <Button
          variant="ink"
          onClick={() => setScanning(true)}
          disabled={lessonClosed || !rulesData?.rules.length}
          title="Fazer chamada lendo o QR code dos alunos"
        >
          <QrCode className="size-4" /> Ler QR
        </Button>
      </div>
      <QrScannerDialog
        open={scanning}
        onOpenChange={setScanning}
        students={students ?? []}
        groups={rulesData?.groups ?? []}
        rules={rulesData?.rules ?? []}
        appliedToday={appliedToday}
        onScan={async (student, rule) => {
          await apply.mutateAsync({ student, rule });
        }}
      />
      {lessonClosed && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          Aula de hoje encerrada — os lançamentos estão bloqueados. Reabra na aba “Aula” se precisar
          corrigir algo.
        </div>
      )}

      {filtered.map((student) => {
        const { current } = levelFor(pointsOf(student.id));
        const rank = rankOf.get(student.id);
        const isOpen = open === student.id;
        return (
          <article key={student.id} className="surface overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : student.id)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  title={`${rank}º no ranking do mês (todas as salas)`}
                  className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-sm font-semibold ${
                    rank === 1
                      ? "bg-gold text-gold-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {rank}º
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{student.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {current.emoji} {current.name}
                  </span>
                </span>
              </div>
              <div className="relative flex shrink-0 items-center gap-2">
                {burst?.studentId === student.id ? (
                  <PointsBurst value={burst.value} id={burst.id} />
                ) : null}
                <span className="rounded-full bg-ink px-2.5 py-1 font-display text-sm font-semibold text-ink-foreground">
                  {pointsOf(student.id)}
                </span>
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {isOpen ? (
              <div className="animate-pop-in space-y-4 border-t border-border bg-secondary/30 p-4">
                {(rulesData?.groups ?? []).map((group) => (
                  <div key={group.id}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.name}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(rulesData?.rules ?? [])
                        .filter((r) => r.group_id === group.id)
                        .map((rule) => {
                          const entryId = appliedToday.get(`${student.id}:${rule.key}`);
                          const busy = apply.isPending || undo.isPending;
                          if (entryId) {
                            return (
                              <Button
                                key={rule.key}
                                size="sm"
                                variant={rule.points >= 0 ? "success" : "destructive"}
                                disabled={busy || lessonClosed}
                                onClick={() => undo.mutate({ entryId, student, rule })}
                                aria-pressed
                                title="Toque para desfazer"
                                className="h-auto flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left"
                              >
                                <span className="flex items-center gap-1 text-xs font-medium leading-tight">
                                  <Check className="size-3.5" />
                                  {rule.label}
                                </span>
                                <span className="flex items-center gap-1 font-display text-xs font-bold">
                                  {rule.points > 0 ? "+" : ""}
                                  {rule.points}
                                  <span className="flex items-center gap-0.5 font-sans text-[10px] font-normal opacity-80">
                                    <Undo2 className="size-3" /> desfazer
                                  </span>
                                </span>
                              </Button>
                            );
                          }
                          return (
                            <Button
                              key={rule.key}
                              size="sm"
                              variant={rule.points >= 0 ? "softSuccess" : "softDanger"}
                              disabled={busy || lessonClosed}
                              onClick={() => apply.mutate({ student, rule })}
                              className="h-auto flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left active:scale-[0.98]"
                            >
                              <span className="text-xs font-medium leading-tight">
                                {rule.label}
                              </span>
                              <span className="font-display text-xs font-bold">
                                {rule.points > 0 ? "+" : ""}
                                {rule.points}
                              </span>
                            </Button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
