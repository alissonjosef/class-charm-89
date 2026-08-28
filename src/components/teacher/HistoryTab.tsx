import { useQuery } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ruleLabel } from "@/lib/points";
import { EmptyState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { useStudents } from "@/hooks/useStudents";
import { ALL_CLASSES, ClassBar } from "./ClassBar";

type Row = {
  id: string;
  student_id: string;
  type: string;
  points: number;
  note: string | null;
  created_at: string;
  class_id: string | null;
};

export function HistoryTab({
  classId,
  onClassChange,
}: {
  classId: string;
  onClassChange: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: students } = useStudents();
  const { data, isLoading } = useQuery({
    queryKey: ["class-history", classId],
    queryFn: async (): Promise<Row[]> => {
      let query = supabase
        .from("points_history")
        .select("id, student_id, type, points, note, created_at, class_id")
        .order("created_at", { ascending: false })
        .limit(150);
      if (classId !== ALL_CLASSES) query = query.eq("class_id", classId);
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
    },
    onError: () => toast.error("Não foi possível estornar"),
  });

  const nameOf = (id: string) => students?.find((s) => s.id === id)?.name ?? "Aluno";

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <>
        <ClassBar classId={classId} onChange={onClassChange} />
        <EmptyState
          title="Sem lançamentos por aqui"
          text={
            classId === ALL_CLASSES
              ? "Assim que você aplicar pontos na chamada, o extrato da turma aparece nesta lista."
              : "Esta sala ainda não tem lançamentos. Faça a chamada com a sala selecionada."
          }
        />
      </>
    );
  }

  return (
    <>
      <ClassBar classId={classId} onChange={onClassChange} />
      <ul className="surface divide-y divide-border overflow-hidden">
        {data.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 transition-colors hover:bg-secondary/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{nameOf(row.student_id)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.note ?? ruleLabel(row.type)} ·{" "}
                {new Date(row.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
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
        ))}
      </ul>
    </>
  );
}
