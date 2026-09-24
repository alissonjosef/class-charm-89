import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Loader2, Lock, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { AppShell } from "@/components/AppShell";
import { EmptyState, FullPageLoader } from "@/components/States";
import { Confetti } from "@/components/Feedback";
import { QuizRunner } from "@/components/student/QuizRunner";
import { QuizReview } from "@/components/student/QuizReview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { levelFor, ruleLabel } from "@/lib/points";
import { useRules } from "@/hooks/useRules";
import { QUIZ_COLUMNS, parseQuiz, quizStatus, type PointEntry, type Quiz } from "@/lib/types";
import { currentTerm, termLabel } from "@/lib/terms";

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
  const { profile, session } = useAuth();
  const [fire, setFire] = useState(0);
  const term = currentTerm();

  const termPoints = useQuery({
    queryKey: ["my-term-points", session?.user.id, term],
    enabled: Boolean(session?.user.id),
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("points_history")
        .select("points")
        .eq("student_id", session!.user.id)
        .eq("term", term);
      if (error) throw error;
      return (data ?? []).reduce((sum, row) => sum + row.points, 0);
    },
  });

  if (!ready || !profile) return <FullPageLoader />;

  return (
    <AppShell title={`Olá, ${profile.name.split(" ")[0]}!`} subtitle="Seu progresso na turma.">
      <Confetti fire={fire} />
      <ScoreHero points={termPoints.data ?? 0} term={term} />
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

function ScoreHero({ points, term }: { points: number; term: string }) {
  const { current, next, progress } = levelFor(points);
  return (
    <section className="relative animate-pop-in overflow-hidden rounded-2xl bg-ink p-6 text-ink-foreground shadow-lift">
      <div
        aria-hidden
        className="absolute -right-16 -top-16 size-56 animate-shine rounded-full bg-gold/25 blur-3xl"
      />
      <div className="relative">
        <p className="text-xs uppercase tracking-widest text-ink-foreground/60">
          {termLabel(term)}
        </p>
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
  const { data: rules } = useRules();
  const { data, isLoading } = useQuery({
    queryKey: ["my-history", session?.user.id, currentTerm()],
    queryFn: async (): Promise<PointEntry[]> => {
      const { data, error } = await supabase
        .from("points_history")
        .select("id, student_id, type, points, note, created_at")
        .eq("student_id", session!.user.id)
        .eq("term", currentTerm())
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
            <p className="truncate text-sm font-medium">
              {row.note ?? ruleLabel(row.type, rules?.rules)}
            </p>
            <p className="text-xs text-muted-foreground">
              {ruleLabel(row.type, rules?.rules)} ·{" "}
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
  const [reviewing, setReviewing] = useState<{
    quiz: Quiz;
    answers: number[];
    score: number;
    justSubmitted: boolean;
  } | null>(null);

  const quizzes = useQuery({
    queryKey: ["published-quizzes"],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Quiz[]> => {
      const { data, error } = await supabase
        .from("quizzes")
        .select(QUIZ_COLUMNS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(parseQuiz);
    },
  });

  const reopenings = useQuery({
    queryKey: ["my-reopenings", session?.user.id],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_reopenings")
        .select("quiz_id, until")
        .eq("student_id", session!.user.id);
      if (error) throw error;
      return (data ?? []).filter((r) => !r.until || new Date(r.until) > new Date());
    },
  });
  const reopenedIds = new Set((reopenings.data ?? []).map((r) => r.quiz_id));

  const done = useQuery({
    queryKey: ["my-submissions", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("quiz_id, score_obtained, answers")
        .eq("student_id", session!.user.id);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        quiz_id: row.quiz_id,
        score_obtained: row.score_obtained,
        answers: (row.answers as number[]) ?? [],
      }));
    },
  });

  if (active) {
    return (
      <QuizRunner
        quiz={active}
        onClose={() => setActive(null)}
        onCelebrate={onCelebrate}
        onSubmitted={(answers, score) => {
          setActive(null);
          setReviewing({ quiz: active, answers, score, justSubmitted: true });
        }}
      />
    );
  }

  if (reviewing) {
    return (
      <QuizReview
        quiz={reviewing.quiz}
        answers={reviewing.answers}
        score={reviewing.score}
        justSubmitted={reviewing.justSubmitted}
        onClose={() => setReviewing(null)}
      />
    );
  }

  if (quizzes.isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (quizzes.error) {
    return (
      <EmptyState
        title="Não foi possível carregar as tarefas"
        text={quizzes.error instanceof Error ? quizzes.error.message : "Tente novamente."}
      />
    );
  }

  const term = currentTerm();
  const visible = (quizzes.data ?? []).filter((quiz) => {
    if (!quiz.questions.length) return false;
    if (reopenedIds.has(quiz.id)) return true;
    const status = quizStatus(quiz);
    if (status === "agendado" || status === "rascunho") return false;
    return quiz.term === term || status === "aberto";
  });

  if (!visible.length) {
    return (
      <EmptyState
        title="Nenhuma tarefa liberada"
        text="Quando o professor publicar uma pergunta ou quiz, ele aparece aqui para você responder."
      />
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((quiz) => {
        const submission = done.data?.find((s) => s.quiz_id === quiz.id);
        const total = quiz.questions.reduce((sum, q) => sum + q.points, 0);
        const reopened = reopenedIds.has(quiz.id) && !submission;
        const status = reopened ? "aberto" : quizStatus(quiz);
        return (
          <article key={quiz.id} className="surface animate-pop-in p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-semibold">{quiz.title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{quiz.questions.length} pergunta(s)</span>
                  <span>vale {total} pontos</span>
                  {quiz.term !== term ? <span>{termLabel(quiz.term)}</span> : null}
                  {reopened ? (
                    <span className="rounded-full bg-success/12 px-2 py-0.5 font-semibold text-success">
                      liberado para você
                    </span>
                  ) : null}
                  {quiz.due_date ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" />
                      {new Date(quiz.due_date).toLocaleDateString("pt-BR")}
                    </span>
                  ) : null}
                </p>
              </div>
              {submission ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 text-xs font-semibold text-success">
                    <CheckCircle2 className="size-3.5" /> {submission.score_obtained} pts
                  </span>
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() =>
                      setReviewing({
                        quiz,
                        answers: submission.answers,
                        score: submission.score_obtained,
                        justSubmitted: false,
                      })
                    }
                  >
                    Ver respostas
                  </Button>
                </div>
              ) : status === "encerrado" ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                  <Lock className="size-3.5" /> Encerrado
                </span>
              ) : (
                <Button
                  variant="ink"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setActive(quiz)}
                >
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
  const { data, isLoading } = useRules();
  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {(data?.groups ?? []).map((group) => (
        <div key={group.id} className="surface overflow-hidden">
          <p className="border-b border-border px-4 py-3 font-display text-sm font-semibold">
            {group.name}
          </p>
          <ul className="divide-y divide-border">
            {(data?.rules ?? [])
              .filter((r) => r.group_id === group.id)
              .map((rule) => (
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
