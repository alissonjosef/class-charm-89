import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ruleLabel } from "@/lib/points";
import { useRules } from "@/hooks/useRules";
import { EmptyState } from "@/components/States";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudents } from "@/hooks/useStudents";
import { useClasses } from "@/hooks/useClasses";
import { lessonTag, useLessons } from "@/hooks/useLessons";
import { monthRange } from "@/hooks/useMonthPoints";
import { currentTerm, monthLabel, recentMonths, recentTerms, termLabel } from "@/lib/terms";
import { ALL_CLASSES } from "./ClassBar";

const ALL = "all";

type Row = {
  id: string;
  student_id: string;
  type: string;
  points: number;
  note: string | null;
  created_at: string;
  class_id: string | null;
  lesson_id: string | null;
  lessons: { lesson_number: number | null; lesson_date: string; theme: string } | null;
};

export function HistoryTab({
  classId,
  onClassChange,
  term,
  onTermChange,
}: {
  classId: string;
  onClassChange: (value: string) => void;
  term: string;
  onTermChange: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: students } = useStudents();
  const { data: rules } = useRules();
  const { data: classes } = useClasses();
  const { data: lessons } = useLessons();
  const [studentId, setStudentId] = useState(ALL);
  const [month, setMonth] = useState(ALL);
  const [lessonId, setLessonId] = useState(ALL);
  const [allTerms, setAllTerms] = useState(false);
  const termFilter = allTerms ? ALL : term;

  const { data, isLoading } = useQuery({
    queryKey: ["class-history", classId, termFilter, studentId, month, lessonId],
    queryFn: async (): Promise<Row[]> => {
      let query = supabase
        .from("points_history")
        .select(
          "id, student_id, type, points, note, created_at, class_id, lesson_id, lessons(lesson_number, lesson_date, theme)",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (termFilter !== ALL) query = query.eq("term", termFilter);
      if (classId !== ALL_CLASSES) query = query.eq("class_id", classId);
      if (studentId !== ALL) query = query.eq("student_id", studentId);
      if (lessonId !== ALL) query = query.eq("lesson_id", lessonId);
      if (month !== ALL) {
        const { start, end } = monthRange(month);
        query = query.gte("entry_date", start).lte("entry_date", end);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("points_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento estornado");
      queryClient.invalidateQueries({ queryKey: ["class-history"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["term-points"] });
      queryClient.invalidateQueries({ queryKey: ["month-points"] });
      queryClient.invalidateQueries({ queryKey: ["today-entries"] });
    },
    onError: () => toast.error("Não foi possível estornar"),
  });

  const nameOf = (id: string) => students?.find((s) => s.id === id)?.name ?? "Aluno";
  const classNameOf = (id: string | null) => classes?.find((c) => c.id === id)?.name ?? null;
  const total = (data ?? []).reduce((sum, row) => sum + row.points, 0);
  const filtering =
    classId !== ALL_CLASSES || studentId !== ALL || month !== ALL || lessonId !== ALL;

  function clearFilters() {
    onClassChange(ALL_CLASSES);
    setStudentId(ALL);
    setMonth(ALL);
    setLessonId(ALL);
    setAllTerms(true);
  }

  const filters = (
    <div className="mb-4 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={classId} onValueChange={onClassChange}>
          <SelectTrigger aria-label="Sala">
            <SelectValue placeholder="Sala" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLASSES}>Todas as salas</SelectItem>
            {(classes ?? []).map((room) => (
              <SelectItem key={room.id} value={room.id}>
                {room.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger aria-label="Aluno">
            <SelectValue placeholder="Aluno" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os alunos</SelectItem>
            {(students ?? []).map((student) => (
              <SelectItem key={student.id} value={student.id}>
                {student.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger aria-label="Mês">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os meses</SelectItem>
            {recentMonths().map((value) => (
              <SelectItem key={value} value={value}>
                {monthLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={lessonId} onValueChange={setLessonId}>
          <SelectTrigger aria-label="Aula">
            <SelectValue placeholder="Aula" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as aulas</SelectItem>
            {(lessons ?? []).map((lesson) => (
              <SelectItem key={lesson.id} value={lesson.id}>
                {lesson.lesson_number ? `Lição ${lesson.lesson_number} · ` : ""}
                {new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString("pt-BR")} ·{" "}
                {lesson.theme}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={termFilter}
          onValueChange={(value) => {
            if (value === ALL) {
              setAllTerms(true);
            } else {
              setAllTerms(false);
              onTermChange(value);
            }
          }}
        >
          <SelectTrigger aria-label="Trimestre">
            <SelectValue placeholder="Trimestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os trimestres</SelectItem>
            {recentTerms().map((value) => (
              <SelectItem key={value} value={value}>
                {termLabel(value)}
                {value === currentTerm() ? " (atual)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {data?.length ?? 0} lançamento(s) · saldo{" "}
          <span
            className={total >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"}
          >
            {total > 0 ? "+" : ""}
            {total}
          </span>
        </span>
        {filtering || !allTerms ? (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={clearFilters}>
            Ver todos
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <>
        {filters}
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!data?.length) {
    return (
      <>
        {filters}
        <EmptyState
          title="Sem lançamentos por aqui"
          text="Nenhum lançamento com esses filtros. Ajuste a sala, o aluno, o mês, a aula ou o trimestre."
        />
      </>
    );
  }

  return (
    <>
      {filters}
      <ul className="surface divide-y divide-border overflow-hidden">
        {data.map((row) => {
          const room = classNameOf(row.class_id);
          return (
            <li
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 transition-colors hover:bg-secondary/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{nameOf(row.student_id)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.note ?? ruleLabel(row.type, rules?.rules)} ·{" "}
                  {new Date(row.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {room ? ` · ${room}` : ""}
                </p>
                {row.lessons ? (
                  <p className="truncate text-[11px] text-primary">
                    {lessonTag(row.lessons)} · {row.lessons.theme}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span
                  className={`font-display text-sm font-bold ${row.points >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {row.points > 0 ? "+" : ""}
                  {row.points}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(row.id)}
                  aria-label="Estornar lançamento"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
