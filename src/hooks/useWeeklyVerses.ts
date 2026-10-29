import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayInSaoPaulo } from "@/lib/terms";

export type WeeklyVerse = {
  id: string;
  release_date: string;
  reference: string;
  verse_text: string;
  theme: string | null;
  created_by: string | null;
  created_at: string;
  class_id: string | null;
};

const VERSE_COLUMNS =
  "id, release_date, reference, verse_text, theme, created_by, created_at, class_id";

/** Versículos visíveis ao usuário; com classId filtra a sala (incluindo os antigos sem sala). */
export function useWeeklyVerses(classId?: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["weekly-verses", classId ?? null, session?.user.id],
    queryFn: async (): Promise<WeeklyVerse[]> => {
      let query = supabase.from("weekly_verses").select(VERSE_COLUMNS);
      if (classId) query = query.or(`class_id.eq.${classId},class_id.is.null`);
      const { data, error } = await query
        .order("release_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as WeeklyVerse[];
    },
  });
}

/** Versículo vigente: o mais recente já liberado até hoje. */
export function currentVerse(verses: WeeklyVerse[] | undefined): WeeklyVerse | null {
  const today = todayInSaoPaulo();
  return verses?.find((v) => v.release_date <= today) ?? null;
}

export function verseDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function useSaveWeeklyVerse() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      classId,
      releaseDate,
      reference,
      verseText,
      theme,
    }: {
      id?: string;
      classId?: string;
      releaseDate: string;
      reference: string;
      verseText: string;
      theme: string;
    }) => {
      const row = {
        release_date: releaseDate,
        reference,
        verse_text: verseText,
        theme: theme || null,
      };
      if (id) {
        const { error } = await supabase.from("weekly_verses").update(row).eq("id", id);
        if (error) throw error;
        return;
      }
      if (!classId) throw new Error("Selecione a sala do versículo");
      const { error } = await supabase
        .from("weekly_verses")
        .insert({ ...row, class_id: classId, created_by: session!.user.id });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe um versículo para essa data");
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weekly-verses"] }),
  });
}

export function useDeleteWeeklyVerse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weekly_verses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weekly-verses"] }),
  });
}
