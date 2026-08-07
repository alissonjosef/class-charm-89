import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { AppShell } from "@/components/AppShell";
import { EmptyState, FullPageLoader } from "@/components/States";
import { Confetti } from "@/components/Feedback";
import { QuizRunner } from "@/components/student/QuizRunner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GROUP_LABELS, RULES, levelFor, ruleLabel } from "@/lib/points";
import { parseQuiz, type PointEntry, type Quiz } from "@/lib/types";

export const Route = createFileRoute("/aluno")({
  head: () => ({
    meta: [
      { title: "Meu painel · Classe Viva" },
      {
        name: "description",
        content:
          "Veja seu saldo de pontos, nível, extrato completo e responda os quizzes liberados pelo professor.",
      },
      { property: "og:title", content: "Meu painel · Classe Viva" },
      {
        property: "og:description",
        content: "Saldo de pontos, badges e quizzes da turma na palma da mão.",
      },
    ],
  }),
  component: StudentPage,
});

function StudentPage() {
  const { ready } = useRoleGuard("student");
  const { profile } = useAuth();
  const [fire, setFire] = useState(0);

  if (!ready || !profile) return <FullPageLoader />;

  return (
    <AppShell title={`Olá, ${profile.name.split(" ")[0]}!`} subtitle="Seu progresso na turma.">
      <Confetti fire={fire} />
      <ScoreHero points={profile.total_points} />
      <Tabs defaultValue="extrato" className="mt-6">
        <TabsList className="mb-5 grid w-full grid-cols-3">
          <TabsTrigger value="extrato">Extrato</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
        </TabsList>
        <TabsContent value="extrato">
          <MyHistory />
        </TabsContent>
        <TabsContent value="tarefas">
          <MyTasks onCelebrate={() => setFire((v) => v + 1)} />
        </TabsContent>
        <TabsContent value="regras">
          <RulesCard />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ScoreHero({ points }: { points: number }) {
  const { current, next, progress } = levelFor(points);
  return (
    <section className="relative animate-pop-in overflow-hidden rounded-2xl bg-ink p-6 text-ink-foreground shadow-lift">
      <div
        aria-hidden
        className="absolute -right-16 -top-16 size-56 animate-shine rounded-full bg-gold/25 blur-3xl"
      />
      <div className="relative">
        <p className="text-xs uppercase tracking-widest text-ink-foreground/60">Saldo total</p>
        <div className="mt-1 flex items-end gap-3">
          <span className="font-display text-5xl font-bold leading-none">{points}</span>
          <span className="pb-1 text-sm text-ink-foreground/70">pontos</span>
        </div>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-3 py-1 font-display text-sm font-semibold text-gold-foreground">
          <Trophy className="size-3.5" /> {current.emoji} {current.name}
        </div>
        <div className="mt-4 max-w-sm">
          <Progress value={progress} className="h-1.5 bg-ink-foreground/15" />
          <p className="mt-2 text-xs text-ink-foreground/60">
            {next
              ? `Faltam ${next.min - points} pontos para ${next.emoji} ${next.name}`
              : "Nível máximo alcançado. Você é destaque!"}
          </p>
        </div>
      </div>
    </section>
  );
}

function MyHistory() {
  const { session } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-history", session?.user.id],
    queryFn: async (): Promise<PointEntry[]> => {
      const { data, error } = await supabase
        .from("points_history")
        .select("id, student_id, type, points, note, created_at")
        .eq("student_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PointEntry[];
    },
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <EmptyState
        title="Seu extrato está vazio"
        text="Assim que o professor lançar pontos ou você responder um quiz, tudo aparece aqui detalhado."
      />
    );
  }

  return (
    <ul className="surface divide-y divide-border overflow-hidden">
      {data.map((row) => (
        <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.note ?? ruleLabel(row.type)}</p>
            <p className="text-xs text-muted-foreground">
              {ruleLabel(row.type)} ·{" "}
              {new Date(row.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <span
            className={`shrink-0 font-display text-base font-bold ${
              row.points >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {row.points > 0 ? "+" : ""}
            {row.points}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MyTasks({ onCelebrate }: { onCelebrate: () => void }) {
  const { session } = useAuth();
  const [active, setActive] = useState<Quiz | null>(null);

  const quizzes = useQuery({
    queryKey: ["published-quizzes"],
    queryFn: async (): Promise<Quiz[]> => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, due_date, questions, published, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(parseQuiz);
    },
  });

  const done = useQuery({
    queryKey: ["my-submissions", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("quiz_id, score_obtained")
        .eq("student_id", session!.user.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (active) {
    return (
      <QuizRunner quiz={active} onClose={() => setActive(null)} onCelebrate={onCelebrate} />
    );
  }

  if (quizzes.isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quizzes.data?.length) {
    return (
      <EmptyState
        title="Nenhuma tarefa liberada"
        text="Quando o professor publicar uma pergunta ou quiz, ele aparece aqui para você responder."
      />
    );
  }

  return (
    <div className="space-y-3">
      {quizzes.data.map((quiz) => {
        const submission = done.data?.find((s) => s.quiz_id === quiz.id);
        const total = quiz.questions.reduce((sum, q) => sum + q.points, 0);
        return (
          <article key={quiz.id} className="surface animate-pop-in p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-semibold">{quiz.title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{quiz.questions.length} pergunta(s)</span>
                  <span>vale {total} pontos</span>
                  {quiz.due_date ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" />
                      {new Date(quiz.due_date).toLocaleDateString("pt-BR")}
                    </span>
                  ) : null}
                </p>
              </div>
              {submission ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 text-xs font-semibold text-success">
                  <CheckCircle2 className="size-3.5" /> {submission.score_obtained} pts
                </span>
              ) : (
                <Button variant="ink" size="sm" className="shrink-0" onClick={() => setActive(quiz)}>
                  Responder
                </Button>
              )}
            </div>
            {quiz.description ? (
              <p className="mt-3 text-sm text-muted-foreground">{quiz.description}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function RulesCard() {
  const groups = ["presenca", "material", "atividades", "destaque"] as const;
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group} className="surface overflow-hidden">
          <p className="border-b border-border px-4 py-3 font-display text-sm font-semibold">
            {GROUP_LABELS[group]}
          </p>
          <ul className="divide-y divide-border">
            {RULES.filter((r) => r.group === group).map((rule) => (
              <li key={rule.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-sm">{rule.label}</span>
                <span
                  className={`shrink-0 font-display text-sm font-bold ${
                    rule.points >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {rule.points > 0 ? "+" : ""}
                  {rule.points}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
