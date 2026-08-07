import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GROUP_LABELS, RULES, levelFor, type Rule } from "@/lib/points";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PointsBurst } from "@/components/Feedback";
import { EmptyState } from "@/components/States";

export type Student = { id: string; name: string; email: string; total_points: number };

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async (): Promise<Student[]> => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (rolesError) throw rolesError;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, total_points")
        .in("id", ids)
        .order("total_points", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });
}

const GROUPS = ["presenca", "material", "atividades", "destaque"] as const;

export function AttendanceTab({ onCelebrate }: { onCelebrate: () => void }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data: students, isLoading } = useStudents();
  const [open, setOpen] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [burst, setBurst] = useState<{ studentId: string; value: number; id: number } | null>(null);

  const apply = useMutation({
    mutationFn: async ({ student, rule }: { student: Student; rule: Rule }) => {
      const { error } = await supabase.from("points_history").insert({
        student_id: student.id,
        type: rule.key,
        points: rule.points,
        note: rule.label,
        registered_by: session!.user.id,
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
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao lançar"),
  });

  const filtered = (students ?? []).filter((s) =>
    s.name.toLowerCase().includes(term.trim().toLowerCase()),
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
      <EmptyState
        title="Nenhum aluno cadastrado ainda"
        text="Peça para os alunos criarem a conta escolhendo o perfil “Aluno”. Eles aparecerão aqui automaticamente."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar aluno"
          className="pl-9"
        />
      </div>

      {filtered.map((student, index) => {
        const { current } = levelFor(student.total_points);
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
                  {student.total_points}
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
