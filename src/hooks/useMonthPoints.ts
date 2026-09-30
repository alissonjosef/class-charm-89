import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MonthTotals = { positive: number; negative: number; net: number };

/** Intervalo [início, fim] de um mês YYYY-MM em datas YYYY-MM-DD. */
export function monthRange(month: string): { start: string; end: string } {
  const [year, mm] = month.split("-").map(Number);
  const last = new Date(year!, mm!, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

/** Positivos, negativos e saldo por aluno no mês; com `classId`, só os pontos lançados naquela sala. */
export function useMonthPoints(month: string, classId: string | null = null) {
  return useQuery({
    queryKey: ["month-points", month, classId],
    queryFn: async (): Promise<Record<string, MonthTotals>> => {
      const { start, end } = monthRange(month);
      let query = supabase
        .from("points_history")
        .select("student_id, points")
        .gte("entry_date", start)
        .lte("entry_date", end);
      if (classId) query = query.eq("class_id", classId);
      const { data, error } = await query;
      if (error) throw error;
      const totals: Record<string, MonthTotals> = {};
      for (const row of data ?? []) {
        const entry = totals[row.student_id] ?? { positive: 0, negative: 0, net: 0 };
        if (row.points >= 0) entry.positive += row.points;
        else entry.negative += row.points;
        entry.net += row.points;
        totals[row.student_id] = entry;
      }
      return totals;
    },
  });
}
