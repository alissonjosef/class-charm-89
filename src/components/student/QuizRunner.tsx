import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Quiz, QuizAnswer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

export function QuizRunner({
  quiz,
  onClose,
  onCelebrate,
  onSubmitted,
}: {
  quiz: Quiz;
  onClose: () => void;
  onCelebrate: () => void;
  onSubmitted: (answers: QuizAnswer[], score: number, gradedAt: string | null) => void;
}) {
  const { session, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>(() =>
    quiz.questions.map((q) => (q.answerType === "written" ? "" : -1)),
  );

  const question = quiz.questions[step]!;
  const answer = answers[step]!;
  const isAnswered =
    question.answerType === "written"
      ? typeof answer === "string" && Boolean(answer.trim())
      : typeof answer === "number" && answer >= 0;

  const submit = useMutation({
    mutationFn: async () => {
      const score = quiz.questions.reduce(
        (sum, q, i) =>
          sum +
          (q.answerType === "multiple_choice" && answers[i] === q.correctOption ? q.points : 0),
        0,
      );
      const gradedAt = quiz.questions.some((q) => q.answerType === "written")
        ? null
        : new Date().toISOString();
      const { error } = await supabase.from("submissions").insert({
        quiz_id: quiz.id,
        student_id: session!.user.id,
        answers,
        score_obtained: score,
        graded_at: gradedAt,
      });
      if (error) throw error;
      return { score, gradedAt };
    },
    onSuccess: async ({ score, gradedAt }) => {
      if (score > 0) onCelebrate();
      onSubmitted(answers, score, gradedAt);
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["my-history"] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["my-term-points"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar"),
  });

  return (
    <div className="surface animate-pop-in overflow-hidden">
      <div className="border-b border-border p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h3 className="truncate font-display text-base font-semibold">{quiz.title}</h3>
          <span className="shrink-0 text-xs text-muted-foreground">
            {step + 1}/{quiz.questions.length}
          </span>
        </div>
        <Progress value={((step + 1) / quiz.questions.length) * 100} className="mt-3 h-1.5" />
      </div>

      <div className="p-5">
        <p className="font-display text-lg font-semibold leading-snug">{question.statement}</p>
        <p className="mt-1 text-xs text-muted-foreground">Vale {question.points} pontos</p>

        {question.answerType === "written" ? (
          <div className="mt-5 space-y-2">
            <label htmlFor={`answer-${question.id}`} className="text-sm font-medium">
              Sua resposta
            </label>
            <Textarea
              id={`answer-${question.id}`}
              value={typeof answer === "string" ? answer : ""}
              maxLength={5000}
              rows={6}
              onChange={(event) =>
                setAnswers((prev) =>
                  prev.map((current, i) => (i === step ? event.target.value : current)),
                )
              }
              placeholder="Escreva sua resposta com suas próprias palavras"
            />
          </div>
        ) : (
          <div className="mt-5 space-y-2.5">
            {question.options.map((option, index) => {
              const selected = answer === index;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => prev.map((current, i) => (i === step ? index : current)))
                  }
                  className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.99] ${
                    selected
                      ? "border-primary bg-accent shadow-soft"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {selected ? <Check className="size-4" /> : String.fromCharCode(65 + index)}
                  </span>
                  <span className="min-w-0 text-sm">{option}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(step - 1)}>
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          {step < quiz.questions.length - 1 ? (
            <Button variant="ink" disabled={!isAnswered} onClick={() => setStep(step + 1)}>
              Próxima <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              variant="gold"
              disabled={!isAnswered || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Enviar
              respostas
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
