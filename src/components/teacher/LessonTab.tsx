import { useEffect, useState } from "react";
import { ChevronRight, Loader2, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/States";
import {
  useCloseLesson,
  useLessons,
  useSaveLesson,
  useTodayLesson,
  type Lesson,
} from "@/hooks/useLessons";
import { LessonDialog } from "@/components/LessonDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  LESSONS_PER_SEMESTER,
  currentSemester,
  semesterLabel,
  semesterOf,
  todayInSaoPaulo,
} from "@/lib/terms";

const NO_NUMBER = "none";

export function LessonTab() {
  const today = todayInSaoPaulo();
  const semester = currentSemester();
  const { data: todayLesson, isLoading: loadingToday } = useTodayLesson();
  const { data: lessons, isLoading: loadingLessons } = useLessons();
  const saveLesson = useSaveLesson();
  const closeLesson = useCloseLesson();
  const { session } = useAuth();
  const isClosed = Boolean(todayLesson?.closed_at);

  const semesterLessons = (lessons ?? []).filter((l) => semesterOf(l.lesson_date) === semester);
  const usedNumbers = new Set(
    semesterLessons.filter((l) => l.id !== todayLesson?.id).map((l) => l.lesson_number),
  );
  const nextNumber = Array.from({ length: LESSONS_PER_SEMESTER }, (_, i) => i + 1).find(
    (n) => !usedNumbers.has(n),
  );

  function toggleClosed() {
    if (!todayLesson) return;
    closeLesson.mutate(
      { id: todayLesson.id, closed: !isClosed },
      {
        onSuccess: () => toast.success(isClosed ? "Aula reaberta" : "Aula encerrada"),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Erro ao atualizar a aula"),
      },
    );
  }
  const [openId, setOpenId] = useState<string | null>(null);
  const openLesson = lessons?.find((l) => l.id === openId) ?? null;

  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [lessonNumber, setLessonNumber] = useState<string>(NO_NUMBER);
  const [historySemester, setHistorySemester] = useState(semester);

  useEffect(() => {
    setTheme(todayLesson?.theme ?? "");
    setDescription(todayLesson?.description ?? "");
    setLessonNumber(todayLesson?.lesson_number ? String(todayLesson.lesson_number) : NO_NUMBER);
  }, [todayLesson?.id]);

  useEffect(() => {
    if (!todayLesson && lessonNumber === NO_NUMBER && nextNumber && lessons) {
      setLessonNumber(String(nextNumber));
    }
  }, [todayLesson, lessons, nextNumber, lessonNumber]);

  function submit() {
    if (!theme.trim()) {
      toast.error("Informe o tema da aula");
      return;
    }
    saveLesson.mutate(
      {
        ...(todayLesson ? { id: todayLesson.id } : {}),
        lessonDate: today,
        lessonNumber: lessonNumber === NO_NUMBER ? null : Number(lessonNumber),
        theme: theme.trim(),
        description: description.trim(),
      },
      {
        onSuccess: () => toast.success(todayLesson ? "Aula atualizada" : "Aula de hoje aberta"),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Erro ao salvar a aula"),
      },
    );
  }

  if (loadingToday) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const semesters = Array.from(
    new Set([semester, ...(lessons ?? []).map((l) => semesterOf(l.lesson_date))]),
  ).sort((a, b) => b.localeCompare(a));
  const historyLessons = (lessons ?? []).filter(
    (l) => semesterOf(l.lesson_date) === historySemester,
  );

  return (
    <div className="space-y-6">
      <SemesterBox
        semester={semester}
        lessons={semesterLessons}
        todayLessonId={todayLesson?.id ?? null}
        onOpen={setOpenId}
      />

      <div className="surface space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {todayLesson ? "Aula de hoje" : "Abrir aula de hoje"}
          </p>
          {isClosed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              <Lock className="size-3" /> Encerrada
            </span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
            Lição e título da aula
          </label>
          <Select value={lessonNumber} onValueChange={setLessonNumber} disabled={isClosed}>
            <SelectTrigger>
              <SelectValue placeholder="Lição" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_NUMBER}>Sem número</SelectItem>
              {Array.from({ length: LESSONS_PER_SEMESTER }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Lição {n}
                  {usedNumbers.has(n) ? " · já usada" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Título da aula (ex.: A parábola do semeador)"
            disabled={isClosed}
          />
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Conteúdo da aula</span>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Escreva o conteúdo, versículos e pontos principais da aula. Os alunos veem isso no histórico."
            rows={6}
            disabled={isClosed}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={saveLesson.isPending || isClosed}>
            {todayLesson ? "Salvar alterações" : "Abrir aula"}
          </Button>
          {todayLesson && (
            <Button
              variant={isClosed ? "outline" : "softDanger"}
              onClick={toggleClosed}
              disabled={closeLesson.isPending}
            >
              {isClosed ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
              {isClosed ? "Reabrir aula" : "Encerrar aula"}
            </Button>
          )}
        </div>
        {isClosed && (
          <p className="text-xs text-muted-foreground">
            Com a aula encerrada, a chamada não lança mais pontos hoje. Reabra se precisar corrigir
            algo.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Histórico de aulas
          </p>
          <Select value={historySemester} onValueChange={setHistorySemester}>
            <SelectTrigger className="h-8 w-full text-xs sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semesters.map((value) => (
                <SelectItem key={value} value={value}>
                  {semesterLabel(value)}
                  {value === semester ? " (atual)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loadingLessons ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !historyLessons.length ? (
          <EmptyState
            title="Nenhuma aula registrada"
            text={
              historySemester === semester
                ? "Abra a aula de hoje informando o tema para começar o histórico."
                : "Nenhuma aula neste semestre."
            }
          />
        ) : (
          <ul className="surface divide-y divide-border overflow-hidden">
            {historyLessons.map((lesson) => {
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(lesson.id)}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition hover:bg-accent/40"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary font-display text-xs font-semibold text-secondary-foreground">
                      {lesson.lesson_number ?? "–"}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {lesson.closed_at && (
                          <Lock className="size-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{lesson.theme}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString("pt-BR")}
                        {lesson.description ? ` · ${lesson.description}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <LessonDialog
        lesson={openLesson}
        onClose={() => setOpenId(null)}
        canEdit={openLesson?.created_by === session?.user.id}
      />
    </div>
  );
}

function SemesterBox({
  semester,
  lessons,
  todayLessonId,
  onOpen,
}: {
  semester: string;
  lessons: Lesson[];
  todayLessonId: string | null;
  onOpen: (id: string) => void;
}) {
  const byNumber = new Map<number, Lesson>();
  for (const lesson of lessons) {
    if (lesson.lesson_number && !byNumber.has(lesson.lesson_number)) {
      byNumber.set(lesson.lesson_number, lesson);
    }
  }
  const done = byNumber.size;

  return (
    <section className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Semestre em estudo
          </p>
          <p className="font-display text-lg font-semibold">{semesterLabel(semester)}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {done} de {LESSONS_PER_SEMESTER} lições dadas
        </p>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-13">
        {Array.from({ length: LESSONS_PER_SEMESTER }, (_, i) => i + 1).map((n) => {
          const lesson = byNumber.get(n);
          const isToday = lesson?.id === todayLessonId;
          return (
            <button
              key={n}
              type="button"
              disabled={!lesson}
              onClick={() => lesson && onOpen(lesson.id)}
              title={lesson ? `Lição ${n} · ${lesson.theme}` : `Lição ${n} · ainda não dada`}
              className={`grid aspect-square place-items-center rounded-xl font-display text-sm font-semibold transition ${
                lesson
                  ? "bg-ink text-ink-foreground shadow-soft hover:bg-ink/85"
                  : "border border-dashed border-border text-muted-foreground"
              } ${isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </section>
  );
}
