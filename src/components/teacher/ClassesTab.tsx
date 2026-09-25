import { Loader2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClasses } from "@/hooks/useClasses";
import { EmptyState } from "@/components/States";
import { ALL_CLASSES, ClassBar } from "./ClassBar";

export function ClassesTab({
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
  const { data: classes, isLoading } = useClasses();
  const { data: memberCounts } = useQuery({
    queryKey: ["class-member-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("class_members").select("class_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.class_id] = (counts[row.class_id] ?? 0) + 1;
      return counts;
    },
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ClassBar
        classId={classId}
        onChange={onClassChange}
        term={term}
        onTermChange={onTermChange}
        manageable
        showTerm={false}
      />
      <p className="text-xs text-muted-foreground">
        Selecione uma sala para renomear, escolher os alunos, autorizar professores ou excluir. A
        sala escolhida aqui também fica ativa na Chamada, no Extrato e nos Quizzes.
      </p>
      {!classes?.length ? (
        <EmptyState
          title="Nenhuma sala criada"
          text="Use “Nova sala” para criar a primeira turma e depois escolha os alunos que fazem parte dela."
        />
      ) : (
        <ul className="surface divide-y divide-border overflow-hidden">
          {classes.map((room) => {
            const selected = room.id === classId;
            return (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => onClassChange(selected ? ALL_CLASSES : room.id)}
                  aria-pressed={selected}
                  className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition ${
                    selected ? "bg-primary/10" : "hover:bg-accent/40"
                  }`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                    <Users className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{room.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {memberCounts?.[room.id] ?? 0} aluno(s)
                    </span>
                  </span>
                  {selected ? (
                    <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                      Selecionada
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
