import { Check, X } from "lucide-react";
import type { Quiz } from "@/lib/types";
import { Button } from "@/components/ui/button";

/** Revisão somente leitura: mostra a resposta do aluno e o gabarito. */
export function QuizReview({
  quiz,
  answers,
  score,
  onClose,
}: {
  quiz: Quiz;
  answers: number[];
  score: number;
  onClose: () => void;
}) {
  const total = quiz.questions.reduce((sum, question) => sum + question.points, 0);

  return (
    <div className="surface animate-pop-in overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold">{quiz.title}</h3>
          <p className="text-xs text-muted-foreground">Você já respondeu — respostas bloqueadas.</p>
        </div>
        <span className="shrink-0 rounded-full bg-gold px-3 py-1 font-display text-sm font-bold text-gold-foreground">
          {score}/{total}
        </span>
      </div>

      <div className="space-y-5 p-5">
        {quiz.questions.map((question, index) => {
          const chosen = answers[index] ?? -1;
          const correct = chosen === question.correctOption;
          return (
            <div key={question.id}>
              <p className="font-display text-sm font-semibold leading-snug">
                {index + 1}. {question.statement}
              </p>
              <div className="mt-2.5 space-y-2">
                {question.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === question.correctOption;
                  const isChosen = optionIndex === chosen;
                  return (
                    <div
                      key={optionIndex}
                      aria-disabled
                      className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
                        isCorrect
                          ? "border-success bg-success/10"
                          : isChosen
                            ? "border-destructive bg-destructive/8"
                            : "border-border bg-card opacity-70"
                      }`}
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                          isCorrect
                            ? "bg-success text-success-foreground"
                            : isChosen
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {isCorrect ? (
                          <Check className="size-4" />
                        ) : isChosen ? (
                          <X className="size-4" />
                        ) : (
                          String.fromCharCode(65 + optionIndex)
                        )}
                      </span>
                      <span className="min-w-0">{option}</span>
                      {isChosen ? (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          sua resposta
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p
                className={`mt-2 text-xs font-semibold ${correct ? "text-success" : "text-destructive"}`}
              >
                {correct ? `Acertou · +${question.points} pontos` : "Errou · 0 ponto"}
              </p>
            </div>
          );
        })}

        <Button variant="ink" onClick={onClose}>
          Voltar às tarefas
        </Button>
      </div>
    </div>
  );
}
