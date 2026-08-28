import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Quiz } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function QuizRunner({
  quiz,
  onClose,
  onCelebrate,
}: {
  quiz: Quiz;
  onClose: () => void;
  onCelebrate: () => void;
}) {
  const { session, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(quiz.questions.length).fill(-1));
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const total = quiz.questions.reduce((sum, q) => sum + q.points, 0);
  const question = quiz.questions[step]!;

  const submit = useMutation({
    mutationFn: async () => {
      const score = quiz.questions.reduce(
        (sum, q, i) => sum + (answers[i] === q.correctOption ? q.points : 0),
        0,
      );
      const { error } = await supabase.from("submissions").insert({
        quiz_id: quiz.id,
        student_id: session!.user.id,
        answers,
        score_obtained: score,
      });
      if (error) throw error;
      return score;
    },
    onSuccess: async (score) => {
      setResult({ score, total });
      if (score > 0) onCelebrate();
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["my-history"] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["my-term-points"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar"),
  });

  if (result) {
    return (
      <div className="surface animate-pop-in p-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold text-gold-foreground">
          <PartyPopper className="size-6" />
        </span>
        <h3 className="mt-4 font-display text-xl font-semibold">Respostas enviadas!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Você acertou o equivalente a{" "}
          <b className="text-foreground">
            {result.score} de {result.total}
          </b>{" "}
          pontos — já creditados no seu saldo.
        </p>
        <Button variant="ink" className="mt-5" onClick={onClose}>
          Voltar às tarefas
        </Button>
      </div>
    );
  }

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

        <div className="mt-5 space-y-2.5">
          {question.options.map((option, index) => {
            const selected = answers[step] === index;
            return (
              <button
                key={index}
                type="button"
                onClick={() => setAnswers((prev) => prev.map((a, i) => (i === step ? index : a)))}
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

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(step - 1)}>
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          {step < quiz.questions.length - 1 ? (
            <Button variant="ink" disabled={answers[step] === -1} onClick={() => setStep(step + 1)}>
              Próxima <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              variant="gold"
              disabled={answers[step] === -1 || submit.isPending}
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
