import { useState } from "react";
import { CalendarClock, CheckCircle2, ChevronRight, Loader2, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/States";
import { useLessons, useSaveLesson, type Lesson } from "@/hooks/useLessons";
import { LessonDialog } from "@/components/LessonDialog";
import { WeeklyVerseCard } from "@/components/teacher/WeeklyVerseCard";
import {
  LESSONS_PER_TERM,
  currentTermSaoPaulo,
  termLabel,
  isVisibleTerm,
  termOfDate,
  todayInSaoPaulo,
} from "@/lib/terms";

const NO_NUMBER = "none";

function lessonStatus(lesson: Lesson): "agendada" | "aberta" | "concluída" {
  if (lesson.closed_at) return "concluída";
  return lesson.lesson_date > todayInSaoPaulo() ? "agendada" : "aberta";
}

export function LessonTab() {
  const today = todayInSaoPaulo();
  const term = currentTermSaoPaulo();
  const { data: lessons, isLoading } = useLessons();

  const [openId, setOpenId] = useState<string | null>(null);
  const openLesson = lessons?.find((l) => l.id === openId) ?? null;
  const [creating, setCreating] = useState<{ number: number | null } | null>(null);
  const [historyTerm, setHistoryTerm] = useState(term);

  const termLessons = (lessons ?? []).filter((l) => termOfDate(l.lesson_date) === term);
  const todayLesson = (lessons ?? []).find((l) => l.lesson_date === today) ?? null;
  const scheduled = (lessons ?? [])
    .filter((l) => l.lesson_date > today)
    .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date));

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const terms = Array.from(
    new Set([term, ...(lessons ?? []).map((l) => termOfDate(l.lesson_date))]),
  )
    .filter(isVisibleTerm)
    .sort((a, b) => b.localeCompare(a));
  const historyLessons = (lessons ?? []).filter((l) => termOfDate(l.lesson_date) === historyTerm);

  return (
    <div className="space-y-6">
      <TermBox
        term={term}
        lessons={termLessons}
        todayLessonId={todayLesson?.id ?? null}
        onOpen={setOpenId}
        onCreate={(number) => setCreating({ number })}
      />

      <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {todayLesson ? "Aula de hoje" : "Nenhuma aula aberta hoje"}
          </p>
          {todayLesson ? (
            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
              {todayLesson.closed_at && <Lock className="size-3 shrink-0 text-muted-foreground" />}
              {todayLesson.lesson_number ? `Lição ${todayLesson.lesson_number} · ` : ""}
              {todayLesson.theme}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Crie a aula para vincular a chamada e mostrar o conteúdo aos alunos.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {todayLesson && (
            <Button variant="outline" onClick={() => setOpenId(todayLesson.id)}>
              {todayLesson.closed_at ? "Ver / reabrir" : "Ver / encerrar"}
            </Button>
          )}
          <Button variant="ink" onClick={() => setCreating({ number: null })}>
            <Plus className="size-4" /> Nova aula
          </Button>
        </div>
      </div>

      <WeeklyVerseCard />

      {scheduled.length ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aulas agendadas
          </p>
          <ul className="surface divide-y divide-border overflow-hidden">
            {scheduled.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} onOpen={setOpenId} />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Histórico de aulas
          </p>
          <Select value={historyTerm} onValueChange={setHistoryTerm}>
            <SelectTrigger className="h-8 w-full text-xs sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {terms.map((value) => (
                <SelectItem key={value} value={value}>
                  {termLabel(value)}
                  {value === term ? " (atual)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!historyLessons.length ? (
          <EmptyState
            title="Nenhuma aula registrada"
            text={
              historyTerm === term
                ? "Use “Nova aula” para começar o histórico deste trimestre."
                : "Nenhuma aula neste trimestre."
            }
          />
        ) : (
          <ul className="surface divide-y divide-border overflow-hidden">
            {historyLessons.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} onOpen={setOpenId} />
            ))}
          </ul>
        )}
      </div>

      <LessonDialog lesson={openLesson} onClose={() => setOpenId(null)} canEdit />

      {creating && (
        <NewLessonDialog
          key={creating.number ?? "free"}
          initialNumber={creating.number}
          lessons={lessons ?? []}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  );
}

function LessonRow({ lesson, onOpen }: { lesson: Lesson; onOpen: (id: string) => void }) {
  const status = lessonStatus(lesson);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(lesson.id)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition hover:bg-accent/40"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary font-display text-xs font-semibold text-secondary-foreground">
          {lesson.lesson_number ?? "–"}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {lesson.closed_at && <Lock className="size-3 shrink-0 text-muted-foreground" />}
            <span className="truncate">{lesson.theme}</span>
            {status === "agendada" && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                Agendada
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString("pt-BR")} ·{" "}
            {termLabel(termOfDate(lesson.lesson_date))}
            {lesson.description ? ` · ${lesson.description}` : ""}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

/** Montado só enquanto aberto: cada "Nova aula" começa com o formulário limpo. */
function NewLessonDialog({
  initialNumber,
  lessons,
  onClose,
}: {
  initialNumber: number | null;
  lessons: Lesson[];
  onClose: () => void;
}) {
  const saveLesson = useSaveLesson();
  const [date, setDate] = useState(todayInSaoPaulo());
  const term = termOfDate(date);
  const termLessons = lessons.filter((l) => termOfDate(l.lesson_date) === term);
  const byNumber = new Map(termLessons.map((l) => [l.lesson_number, l] as const));
  const doneNumbers = new Set(byNumber.keys());
  const suggested =
    initialNumber ??
    Array.from({ length: LESSONS_PER_TERM }, (_, i) => i + 1).find((n) => !doneNumbers.has(n)) ??
    null;
  const [lessonNumber, setLessonNumber] = useState(suggested ? String(suggested) : NO_NUMBER);
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const dateTaken = lessons.find((l) => l.lesson_date === date);

  function submit() {
    if (!date) {
      toast.error("Informe a data da aula");
      return;
    }
    if (!theme.trim()) {
      toast.error("Informe o título da aula");
      return;
    }
    saveLesson.mutate(
      {
        lessonDate: date,
        lessonNumber: lessonNumber === NO_NUMBER ? null : Number(lessonNumber),
        theme: theme.trim(),
        description: description.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Aula aberta");
          onClose();
        },
        onError: (error: { code?: string } & Error) =>
          toast.error(
            error.code === "23505"
              ? "Já existe uma aula nessa data. Abra-a no histórico para editar."
              : error.message || "Erro ao salvar a aula",
          ),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova aula</DialogTitle>
          <DialogDescription>
            Escolha a data e a lição. Depois de aberta, a aula pode ser encerrada ou reaberta a
            qualquer momento.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lesson-date">Data</Label>
            <Input
              id="lesson-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Lição · {termLabel(term)}</Label>
            <Select value={lessonNumber} onValueChange={setLessonNumber}>
              <SelectTrigger>
                <SelectValue placeholder="Lição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_NUMBER}>Sem número</SelectItem>
                {Array.from({ length: LESSONS_PER_TERM }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Lição {n}
                    {byNumber.has(n) ? ` · ${lessonStatus(byNumber.get(n)!)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {dateTaken && (
          <p className="text-xs text-destructive">
            Já existe uma aula em {new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR")} (
            {dateTaken.theme}). Escolha outra data ou edite essa aula no histórico.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="lesson-title">Título da aula</Label>
          <Input
            id="lesson-title"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Ex.: A parábola do semeador"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lesson-content">Conteúdo da aula</Label>
          <Textarea
            id="lesson-content"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Escreva o conteúdo, versículos e pontos principais. Os alunos veem isso no histórico."
            rows={6}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="ink"
            onClick={submit}
            disabled={saveLesson.isPending || Boolean(dateTaken)}
          >
            {saveLesson.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Abrir aula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TermBox({
  term,
  lessons,
  todayLessonId,
  onOpen,
  onCreate,
}: {
  term: string;
  lessons: Lesson[];
  todayLessonId: string | null;
  onOpen: (id: string) => void;
  onCreate: (number: number) => void;
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
            Trimestre em estudo
          </p>
          <p className="font-display text-lg font-semibold">{termLabel(term)}</p>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" />
          {done} de {LESSONS_PER_TERM} lições concluídas
        </p>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-13">
        {Array.from({ length: LESSONS_PER_TERM }, (_, i) => i + 1).map((n) => {
          const lesson = byNumber.get(n);
          const isToday = lesson?.id === todayLessonId;
          const status = lesson ? lessonStatus(lesson) : null;
          return (
            <button
              key={n}
              type="button"
              onClick={() => (lesson ? onOpen(lesson.id) : onCreate(n))}
              title={
                lesson
                  ? `Lição ${n} · ${lesson.theme} (aula ${status})`
                  : `Lição ${n} · toque para abrir esta aula`
              }
              className={`relative grid aspect-square place-items-center rounded-xl font-display text-sm font-semibold transition ${
                status === "agendada"
                  ? "border-2 border-primary/60 bg-primary/10 text-primary hover:bg-primary/20"
                  : lesson
                    ? "bg-ink text-ink-foreground shadow-soft hover:bg-ink/85"
                    : "border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
              } ${isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
            >
              {n}
              {lesson?.closed_at && (
                <Lock className="absolute right-0.5 top-0.5 size-2.5 opacity-70" />
              )}
              {status === "agendada" && (
                <CalendarClock className="absolute right-0.5 top-0.5 size-2.5 opacity-80" />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Escura: aula aberta · cadeado: concluída · clara com relógio: agendada. Toque para ver ou
        editar; numa vazia para abrir a aula.
      </p>
    </section>
  );
}
