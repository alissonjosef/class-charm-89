import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Soma de pontos por aluno no trimestre (opcionalmente restrita a uma sala). */
export function useTermPoints(term: string, classId: string | null) {
  return useQuery({
    queryKey: ["term-points", term, classId],
    queryFn: async (): Promise<Record<string, number>> => {
      let query = supabase.from("points_history").select("student_id, points").eq("term", term);
      if (classId) query = query.eq("class_id", classId);
      const { data, error } = await query;
      if (error) throw error;
      const totals: Record<string, number> = {};
      for (const row of data ?? []) {
        totals[row.student_id] = (totals[row.student_id] ?? 0) + row.points;
      }
      return totals;
    },
  });
}
