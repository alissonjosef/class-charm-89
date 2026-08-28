import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseQuiz, type Quiz, type QuizQuestion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/States";
import { useStudents } from "@/hooks/useStudents";

function emptyQuestion(): QuizQuestion {
  return {
    id: crypto.randomUUID(),
    statement: "",
    options: ["", ""],
    correctOption: 0,
    points: 10,
  };
}

export function useQuizzes() {
  return useQuery({
    queryKey: ["quizzes"],
    queryFn: async (): Promise<Quiz[]> => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, due_date, questions, published, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(parseQuiz);
    },
  });
}

export function QuizzesTab() {
  const [creating, setCreating] = useState(false);
  const { data: quizzes, isLoading } = useQuizzes();
  const [openQuiz, setOpenQuiz] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quizzes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quiz removido");
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });

  if (creating) return <QuizForm onDone={() => setCreating(false)} />;

  return (
    <div className="space-y-4">
      <Button variant="ink" className="w-full sm:w-auto" onClick={() => setCreating(true)}>
        <Plus className="size-4" /> Nova pergunta / quiz
      </Button>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : !quizzes?.length ? (
        <EmptyState
          title="Nenhum quiz criado"
          text="Crie um formulário com perguntas de múltipla escolha, prazo e pontuação para liberar à turma."
        />
      ) : (
        <div className="space-y-3">
          {quizzes.map((quiz) => (
            <article key={quiz.id} className="surface animate-pop-in overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-semibold">{quiz.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{quiz.questions.length} pergunta(s)</span>
                    <span>
                      {quiz.questions.reduce((sum, q) => sum + q.points, 0)} pontos possíveis
                    </span>
                    {quiz.due_date ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3" />
                        {new Date(quiz.due_date).toLocaleDateString("pt-BR")}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => setOpenQuiz(openQuiz === quiz.id ? null : quiz.id)}
                  >
                    <Users className="size-4" /> Respostas
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove.mutate(quiz.id)}
                    aria-label="Remover quiz"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              {openQuiz === quiz.id ? <SubmissionsPanel quiz={quiz} /> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionsPanel({ quiz }: { quiz: Quiz }) {
  const { data: students } = useStudents();
  const { data, isLoading } = useQuery({
    queryKey: ["submissions", quiz.id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, student_id, answers, score_obtained, submitted_at")
        .eq("quiz_id", quiz.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = quiz.questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="animate-pop-in border-t border-border bg-secondary/30 p-4">
      {isLoading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">Ninguém respondeu ainda.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((sub) => {
            const answers = (sub.answers as number[]) ?? [];
            return (
              <li key={sub.id} className="rounded-xl border border-border bg-card p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {students?.find((s) => s.id === sub.student_id)?.name ?? "Aluno"}
                  </p>
                  <span className="shrink-0 rounded-full bg-gold px-2.5 py-0.5 font-display text-xs font-bold text-gold-foreground">
                    {sub.score_obtained}/{total}
                  </span>
                </div>
                <ol className="mt-2 space-y-1">
                  {quiz.questions.map((question, i) => {
                    const chosen = answers[i];
                    const ok = chosen === question.correctOption;
                    return (
                      <li key={question.id} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{i + 1}.</span>{" "}
                        {question.options[chosen ?? -1] ?? "Sem resposta"}{" "}
                        <b className={ok ? "text-success" : "text-destructive"}>
                          {ok ? "✓" : "✕"}
                        </b>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuizForm({ onDone }: { onDone: () => void }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([emptyQuestion()]);

  function update(id: string, patch: Partial<QuizQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Informe o título do quiz");
      const clean = questions.map((q) => ({
        ...q,
        statement: q.statement.trim(),
        options: q.options.map((o) => o.trim()).filter(Boolean),
      }));
      if (clean.some((q) => !q.statement)) throw new Error("Toda pergunta precisa de enunciado");
      if (clean.some((q) => q.options.length < 2))
        throw new Error("Cada pergunta precisa de ao menos 2 alternativas");
      if (clean.some((q) => q.correctOption >= q.options.length))
        throw new Error("Marque a alternativa correta de cada pergunta");

      const { error } = await supabase.from("quizzes").insert({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        questions: clean,
        published: true,
        created_by: session!.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quiz publicado para a turma!");
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao salvar"),
  });

  return (
    <div className="space-y-4">
      <div className="surface space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Revisão da lição 4"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc">Descrição (opcional)</Label>
          <Textarea
            id="desc"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instruções para a turma"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due">Prazo</Label>
          <Input
            id="due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      {questions.map((question, index) => (
        <div key={question.id} className="surface space-y-3 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <p className="font-display text-sm font-semibold">Pergunta {index + 1}</p>
            {questions.length > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setQuestions((prev) => prev.filter((q) => q.id !== question.id))}
                aria-label="Remover pergunta"
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
          <Textarea
            value={question.statement}
            maxLength={300}
            onChange={(e) => update(question.id, { statement: e.target.value })}
            placeholder="Escreva o enunciado"
          />
          <div className="space-y-2">
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Marcar como correta"
                  onClick={() => update(question.id, { correctOption: optionIndex })}
                  className={`grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-all ${
                    question.correctOption === optionIndex
                      ? "border-success bg-success text-success-foreground"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {String.fromCharCode(65 + optionIndex)}
                </button>
                <Input
                  value={option}
                  maxLength={200}
                  onChange={(e) =>
                    update(question.id, {
                      options: question.options.map((o, i) => (i === optionIndex ? e.target.value : o)),
                    })
                  }
                  placeholder={`Alternativa ${String.fromCharCode(65 + optionIndex)}`}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Button
              variant="soft"
              size="sm"
              onClick={() => update(question.id, { options: [...question.options, ""] })}
            >
              <Plus className="size-4" /> Alternativa
            </Button>
            <div className="space-y-1">
              <Label className="text-xs">Pontos</Label>
              <Input
                type="number"
                min={0}
                max={500}
                className="h-8 w-24"
                value={question.points}
                onChange={(e) => update(question.id, { points: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="soft" onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}>
          <Plus className="size-4" /> Adicionar pergunta
        </Button>
        <Button variant="ink" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Publicar quiz
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
