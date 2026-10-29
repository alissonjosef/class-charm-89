import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { termLabel, termOfDate, todayInSaoPaulo } from "@/lib/terms";

export type Lesson = {
  id: string;
  lesson_date: string;
  lesson_number: number | null;
  theme: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
  class_id: string | null;
};

const LESSON_COLUMNS =
  "id, lesson_date, lesson_number, theme, description, created_by, created_at, closed_at, class_id";

/** "Lição 3 · 3º trimestre de 2026" — usado no card da aula e no extrato. */
export function lessonTag(lesson: { lesson_number: number | null; lesson_date: string }): string {
  const term = termLabel(termOfDate(lesson.lesson_date));
  return lesson.lesson_number ? `Lição ${lesson.lesson_number} · ${term}` : term;
}

/** Aula de hoje da sala; sem sala selecionada não há aula vinculável. */
export function useTodayLesson(classId: string | null) {
  const today = todayInSaoPaulo();
  return useQuery({
    queryKey: ["lesson", today, classId],
    enabled: Boolean(classId),
    queryFn: async (): Promise<Lesson | null> => {
      const { data, error } = await supabase
        .from("lessons")
        .select(LESSON_COLUMNS)
        .eq("lesson_date", today)
        .eq("class_id", classId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Com classId filtra a sala (incluindo aulas antigas sem sala); sem ele, o RLS limita ao que o usuário enxerga. */
export function useLessons(classId?: string | null) {
  return useQuery({
    queryKey: ["lessons", classId ?? null],
    queryFn: async (): Promise<Lesson[]> => {
      let query = supabase.from("lessons").select(LESSON_COLUMNS);
      if (classId) query = query.or(`class_id.eq.${classId},class_id.is.null`);
      const { data, error } = await query
        .order("lesson_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as Lesson[];
    },
  });
}

export function useSaveLesson() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      classId,
      lessonDate,
      lessonNumber,
      theme,
      description,
    }: {
      id?: string;
      classId?: string;
      lessonDate: string;
      lessonNumber: number | null;
      theme: string;
      description: string;
    }) => {
      if (id) {
        const { data, error } = await supabase
          .from("lessons")
          .update({
            theme,
            description: description || null,
            lesson_number: lessonNumber,
            lesson_date: lessonDate,
          })
          .eq("id", id)
          .select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("Não foi possível salvar a aula");
        return;
      }
      if (!classId) throw new Error("Selecione a sala da aula");
      const { error } = await supabase.from("lessons").insert({
        class_id: classId,
        lesson_date: lessonDate,
        lesson_number: lessonNumber,
        theme,
        description: description || null,
        created_by: session!.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson"] });
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
}

export function useCloseLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, closed }: { id: string; closed: boolean }) => {
      const { data, error } = await supabase
        .from("lessons")
        .update({ closed_at: closed ? new Date().toISOString() : null })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Não foi possível atualizar a aula");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson"] });
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("lessons").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Não foi possível excluir a aula");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson"] });
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
}

/** Total de pontos e quantidade de lançamentos vinculados a cada aula, para a tela de análise. */
export function useLessonTotals(lessonIds: string[]) {
  return useQuery({
    queryKey: ["lesson-totals", lessonIds.slice().sort().join(",")],
    enabled: lessonIds.length > 0,
    queryFn: async (): Promise<Record<string, { total: number; count: number }>> => {
      const { data, error } = await supabase
        .from("points_history")
        .select("lesson_id, points")
        .in("lesson_id", lessonIds);
      if (error) throw error;
      const totals: Record<string, { total: number; count: number }> = {};
      for (const row of data ?? []) {
        if (!row.lesson_id) continue;
        const entry = totals[row.lesson_id] ?? { total: 0, count: 0 };
        entry.total += row.points;
        entry.count += 1;
        totals[row.lesson_id] = entry;
      }
      return totals;
    },
  });
}
