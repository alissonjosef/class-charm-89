import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayInSaoPaulo } from "@/lib/terms";

export type Lesson = {
  id: string;
  lesson_date: string;
  theme: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

const LESSON_COLUMNS = "id, lesson_date, theme, description, created_by, created_at";

export function useTodayLesson() {
  const today = todayInSaoPaulo();
  return useQuery({
    queryKey: ["lesson", today],
    queryFn: async (): Promise<Lesson | null> => {
      const { data, error } = await supabase
        .from("lessons")
        .select(LESSON_COLUMNS)
        .eq("lesson_date", today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useLessons() {
  return useQuery({
    queryKey: ["lessons"],
    queryFn: async (): Promise<Lesson[]> => {
      const { data, error } = await supabase
        .from("lessons")
        .select(LESSON_COLUMNS)
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
      lessonDate,
      theme,
      description,
    }: {
      id?: string;
      lessonDate: string;
      theme: string;
      description: string;
    }) => {
      if (id) {
        const { error } = await supabase
          .from("lessons")
          .update({ theme, description: description || null })
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("lessons").insert({
        lesson_date: lessonDate,
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
