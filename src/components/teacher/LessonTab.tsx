import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/States";
import {
  useCloseLesson,
  useLessons,
  useLessonTotals,
  useSaveLesson,
  useTodayLesson,
} from "@/hooks/useLessons";
import { LessonDialog } from "@/components/LessonDialog";
import { useAuth } from "@/hooks/useAuth";
import { todayInSaoPaulo } from "@/lib/terms";

export function LessonTab() {
  const today = todayInSaoPaulo();
  const { data: todayLesson, isLoading: loadingToday } = useTodayLesson();
  const { data: lessons, isLoading: loadingLessons } = useLessons();
  const lessonIds = useMemo(() => (lessons ?? []).map((l) => l.id), [lessons]);
  const { data: totals } = useLessonTotals(lessonIds);
  const saveLesson = useSaveLesson();
  const closeLesson = useCloseLesson();
  const { session } = useAuth();
  const isClosed = Boolean(todayLesson?.closed_at);

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

  useEffect(() => {
    setTheme(todayLesson?.theme ?? "");
    setDescription(todayLesson?.description ?? "");
  }, [todayLesson?.id]);

  function submit() {
    if (!theme.trim()) {
      toast.error("Informe o tema da aula");
      return;
    }
    saveLesson.mutate(
      {
        id: todayLesson?.id,
        lessonDate: today,
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

  return (
    <div className="space-y-6">
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
        <Input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Tema da aula (ex.: A parábola do semeador)"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição opcional"
          rows={3}
        />
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
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico de aulas
        </p>
        {loadingLessons ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !lessons?.length ? (
          <EmptyState
            title="Nenhuma aula registrada"
            text="Abra a aula de hoje informando o tema para começar o histórico."
          />
        ) : (
          <ul className="surface divide-y divide-border overflow-hidden">
            {lessons.map((lesson) => {
              const stats = totals?.[lesson.id];
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(lesson.id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-4 text-left transition hover:bg-accent/40"
                  >
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
                    <div className="shrink-0 text-right">
                      <p className="font-display text-sm font-bold">{stats?.total ?? 0} pts</p>
                      <p className="text-xs text-muted-foreground">
                        {stats?.count ?? 0} lançamentos
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
