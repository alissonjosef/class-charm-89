import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClassMembers } from "@/hooks/useClasses";
import { useTermPoints } from "@/hooks/useTermPoints";
import { useStudents, type Student } from "@/hooks/useStudents";
import { ALL_CLASSES, ClassBar } from "./ClassBar";
import { GROUP_LABELS, RULES, levelFor, type Rule } from "@/lib/points";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PointsBurst } from "@/components/Feedback";
import { EmptyState } from "@/components/States";

const GROUPS = ["presenca", "material", "atividades", "destaque"] as const;

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

  const apply = useMutation({
    mutationFn: async ({ student, rule }: { student: Student; rule: Rule }) => {
      const { error } = await supabase.from("points_history").insert({
        student_id: student.id,
        type: rule.key,
        points: rule.points,
        note: rule.label,
        registered_by: session!.user.id,
        class_id: classId === ALL_CLASSES ? null : classId,
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
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["class-history"] });
      queryClient.invalidateQueries({ queryKey: ["term-points"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao lançar"),
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
          manageable
        />
        <EmptyState
          title={
            classId === ALL_CLASSES ? "Nenhum aluno cadastrado ainda" : "Nenhum aluno nesta sala"
          }
          text={
            classId === ALL_CLASSES
              ? "Peça para os alunos criarem a conta escolhendo o perfil “Aluno”. Eles aparecerão aqui automaticamente."
              : "Use “Alunos da sala” para escolher quem faz parte desta turma."
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
        manageable
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar aluno"
          className="pl-9"
        />
      </div>

      {filtered.map((student, index) => {
        const { current } = levelFor(pointsOf(student.id));
        const isOpen = open === student.id;
        return (
          <article key={student.id} className="surface overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : student.id)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary font-display text-sm font-semibold text-secondary-foreground">
                  {index + 1}
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
                {GROUPS.map((group) => (
                  <div key={group}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {GROUP_LABELS[group]}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {RULES.filter((r) => r.group === group).map((rule) => (
                        <Button
                          key={rule.key}
                          size="sm"
                          variant={rule.points >= 0 ? "softSuccess" : "softDanger"}
                          disabled={apply.isPending}
                          onClick={() => apply.mutate({ student, rule })}
                          className="h-auto flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left"
                        >
                          <span className="text-xs font-medium leading-tight">{rule.label}</span>
                          <span className="font-display text-xs font-bold">
                            {rule.points > 0 ? "+" : ""}
                            {rule.points}
                          </span>
                        </Button>
                      ))}
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
