import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Lock,
  Sparkles,
  Trophy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { AppShell } from "@/components/AppShell";
import { EmptyState, FullPageLoader } from "@/components/States";
import { Confetti } from "@/components/Feedback";
import { QuizRunner } from "@/components/student/QuizRunner";
import { QuizReview } from "@/components/student/QuizReview";
import { StudentQrCard } from "@/components/student/StudentQrCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { levelFor, ruleLabel } from "@/lib/points";
import { useRules } from "@/hooks/useRules";
import { lessonTag, useLessons } from "@/hooks/useLessons";
import { LessonDialog } from "@/components/LessonDialog";
import { VerseDialog } from "@/components/VerseDialog";
import { currentVerse, useWeeklyVerses, type WeeklyVerse } from "@/hooks/useWeeklyVerses";
import { QUIZ_COLUMNS, parseQuiz, quizStatus, type Quiz } from "@/lib/types";
import { currentTerm, termLabel, todayInSaoPaulo } from "@/lib/terms";

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
      <div className="mt-3">
        <StudentQrCard studentId={profile.id} name={profile.name} />
      </div>
      <WeeklyVerseBanner />
      <Tabs defaultValue="extrato" className="mt-6">
        <TabsList className="mb-5 grid w-full grid-cols-4">
          <TabsTrigger value="extrato">Extrato</TabsTrigger>
          <TabsTrigger value="aulas">Aulas</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
        </TabsList>
        <TabsContent value="extrato">
          <MyHistory />
        </TabsContent>
        <TabsContent value="aulas">
          <MyLessons />
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

type MyEntry = {
  id: string;
  type: string;
  points: number;
  note: string | null;
  created_at: string;
  lessons: { lesson_number: number | null; lesson_date: string; theme: string } | null;
};

function MyHistory() {
  const { session } = useAuth();
  const { data: rules } = useRules();
  const { data, isLoading } = useQuery({
    queryKey: ["my-history", session?.user.id, currentTerm()],
    queryFn: async (): Promise<MyEntry[]> => {
      const { data, error } = await supabase
        .from("points_history")
        .select("id, type, points, note, created_at, lessons(lesson_number, lesson_date, theme)")
        .eq("student_id", session!.user.id)
        .eq("term", currentTerm())
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as MyEntry[];
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
            {row.lessons ? (
              <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <BookOpen className="size-3 shrink-0" />
                <span className="truncate">
                  {lessonTag(row.lessons)} · {row.lessons.theme}
                </span>
              </p>
            ) : null}
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

const VERSE_SEEN_KEY = "classe-viva:verse-seen";

/** Versículo da semana: abre sozinho na primeira entrada após a liberação e fica como card no topo. */
function WeeklyVerseBanner() {
  const { data: verses } = useWeeklyVerses();
  const verse = currentVerse(verses);
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (!verse) return;
    if (window.localStorage.getItem(VERSE_SEEN_KEY) === verse.id) return;
    window.localStorage.setItem(VERSE_SEEN_KEY, verse.id);
    setAuto(true);
    setOpen(true);
  }, [verse?.id]);

  if (!verse) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAuto(false);
          setOpen(true);
        }}
        className="surface mt-3 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition hover:bg-accent/40"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-gold/20 text-gold">
          <Sparkles className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Versículo da semana{verse.theme ? ` · ${verse.theme}` : ""}
          </span>
          <span className="block truncate font-display text-base font-semibold">
            {verse.reference}
          </span>
          <span className="line-clamp-1 text-sm text-muted-foreground">{verse.verse_text}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <VerseDialog verse={open ? verse : null} onClose={() => setOpen(false)} highlight={auto} />
    </>
  );
}

function VerseHistory({ verses }: { verses: WeeklyVerse[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openVerse = verses.find((v) => v.id === openId) ?? null;
  if (!verses.length) return null;
  return (
    <section className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="size-3.5 text-gold" /> Versículos da semana
      </p>
      <ul className="surface divide-y divide-border">
        {verses.map((verse) => (
          <li key={verse.id}>
            <button
              type="button"
              onClick={() => setOpenId(verse.id)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition hover:bg-accent/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {verse.reference}
                  {verse.theme ? (
                    <span className="text-muted-foreground"> · {verse.theme}</span>
                  ) : null}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(`${verse.release_date}T00:00:00`).toLocaleDateString("pt-BR")}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <VerseDialog verse={openVerse} onClose={() => setOpenId(null)} />
    </section>
  );
}

function MyLessons() {
  const { data: lessons, isLoading } = useLessons();
  const { data: verses } = useWeeklyVerses();
  const today = todayInSaoPaulo();
  const [openId, setOpenId] = useState<string | null>(null);
  const openLesson = lessons?.find((l) => l.id === openId) ?? null;

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lessons?.length) {
    return (
      <div className="space-y-6">
        <VerseHistory verses={verses ?? []} />
        <EmptyState
          title="Nenhuma aula publicada"
          text="Quando o professor abrir uma aula, o tema e o conteúdo aparecem aqui para você estudar."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <VerseHistory verses={verses ?? []} />
      <ul className="space-y-3">
        {lessons.map((lesson) => {
          const isToday = lesson.lesson_date === today;
          const closed = Boolean(lesson.closed_at);
          return (
            <li key={lesson.id}>
              <button
                type="button"
                onClick={() => !closed && setOpenId(lesson.id)}
                disabled={closed}
                aria-disabled={closed}
                title={closed ? "Aula encerrada pelo professor" : "Abrir aula"}
                className={`surface grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition ${closed ? "cursor-not-allowed opacity-70" : "hover:bg-accent/40"} ${isToday ? "ring-2 ring-primary/40" : ""}`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <BookOpen className="size-3.5" />
                    <span>
                      {new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString("pt-BR")}
                    </span>
                    {isToday && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        Aula de hoje
                      </span>
                    )}
                    {closed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
                        <Lock className="size-3" /> Encerrada
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-primary">{lessonTag(lesson)}</p>
                  <p className="truncate font-display text-base font-semibold">{lesson.theme}</p>
                  {lesson.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {lesson.description}
                    </p>
                  )}
                </div>
                {closed ? (
                  <Lock className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <LessonDialog lesson={openLesson} onClose={() => setOpenId(null)} />
    </div>
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
