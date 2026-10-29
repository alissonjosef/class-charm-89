import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  QUIZ_COLUMNS,
  parseQuiz,
  quizStatus,
  type QuizAnswer,
  type Quiz,
  type QuizQuestion,
  type QuizStatus,
} from "@/lib/types";
import { ALL_CLASSES, ClassBar } from "./ClassBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/States";
import { useStudents } from "@/hooks/useStudents";
import { useClassMembers } from "@/hooks/useClasses";

function emptyQuestion(): QuizQuestion {
  return {
    id: crypto.randomUUID(),
    statement: "",
    answerType: "multiple_choice",
    options: ["", ""],
    correctOption: 0,
    points: 10,
  };
}

export function useQuizzes(term: string, classId: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["quizzes", term, classId, session?.user.id],
    queryFn: async (): Promise<Quiz[]> => {
      let query = supabase
        .from("quizzes")
        .select(QUIZ_COLUMNS)
        .eq("term", term)
        .order("created_at", { ascending: false });
      if (classId) query = query.eq("class_id", classId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(parseQuiz);
    },
  });
}

const STATUS_STYLE: Record<QuizStatus, string> = {
  rascunho: "bg-secondary text-secondary-foreground",
  agendado: "bg-accent text-accent-foreground",
  aberto: "bg-success/12 text-success",
  encerrado: "bg-destructive/10 text-destructive",
};

export function QuizzesTab({
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
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Quiz | null>(null);
  const { isMaster } = useAuth();
  const selectedClass = classId === ALL_CLASSES || !classId ? null : classId;
  const canCreateQuiz = Boolean(selectedClass) || isMaster;
  const { data: quizzes, isLoading } = useQuizzes(term, selectedClass);
  const [openQuiz, setOpenQuiz] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const setRelease = useMutation({
    mutationFn: async ({ quiz, action }: { quiz: Quiz; action: "open" | "close" | "reopen" }) => {
      const patch =
        action === "close"
          ? { closed_at: new Date().toISOString() }
          : action === "reopen"
            ? {
                published: true,
                open_at: new Date().toISOString(),
                closed_at: null,
                due_date: null,
              }
            : { published: true, open_at: new Date().toISOString(), closed_at: null };
      const { error } = await supabase.from("quizzes").update(patch).eq("id", quiz.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quizzes"] }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar"),
  });

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

  if (creating) return <QuizForm classId={selectedClass} onDone={() => setCreating(false)} />;

  if (editing)
    return (
      <QuizForm
        classId={editing.class_id ?? selectedClass}
        quiz={editing}
        onDone={() => setEditing(null)}
      />
    );

  return (
    <div className="space-y-4">
      <ClassBar
        classId={classId}
        onChange={onClassChange}
        term={term}
        onTermChange={onTermChange}
      />
      <Button
        variant="ink"
        className="w-full sm:w-auto"
        onClick={() => setCreating(true)}
        disabled={!canCreateQuiz}
      >
        <Plus className="size-4" /> Nova pergunta / quiz
      </Button>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : !quizzes?.length ? (
        <EmptyState
          title="Nenhum quiz criado"
          text="Crie o quiz com calma: ele fica como rascunho até você liberar para a sala."
        />
      ) : (
        <div className="space-y-3">
          {quizzes.map((quiz) => (
            <article key={quiz.id} className="surface animate-pop-in overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-semibold">{quiz.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[quizStatus(quiz)]}`}
                    >
                      {quizStatus(quiz)}
                    </span>
                    <span>{quiz.questions.length} pergunta(s)</span>
                    <span>
                      {quiz.questions.reduce((sum, q) => sum + q.points, 0)} pontos possíveis
                    </span>
                    {quiz.open_at ? (
                      <span className="inline-flex items-center gap-1">
                        <Send className="size-3" />
                        {new Date(quiz.open_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    ) : null}
                    {quiz.due_date ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3" />
                        {new Date(quiz.due_date).toLocaleDateString("pt-BR")}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {quizStatus(quiz) === "aberto" ? (
                    <Button
                      variant="softDanger"
                      size="sm"
                      disabled={setRelease.isPending}
                      onClick={() => setRelease.mutate({ quiz, action: "close" })}
                    >
                      <Lock className="size-4" /> Encerrar
                    </Button>
                  ) : (
                    <Button
                      variant="softSuccess"
                      size="sm"
                      disabled={setRelease.isPending}
                      onClick={() =>
                        setRelease.mutate({
                          quiz,
                          action: quizStatus(quiz) === "encerrado" ? "reopen" : "open",
                        })
                      }
                    >
                      <Send className="size-4" />
                      {quizStatus(quiz) === "encerrado" ? "Reabrir para a sala" : "Liberar agora"}
                    </Button>
                  )}
                  <Button variant="soft" size="sm" onClick={() => setEditing(quiz)}>
                    <Pencil className="size-4" /> Editar
                  </Button>
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => setOpenQuiz(openQuiz === quiz.id ? null : quiz.id)}
                  >
                    <Users className="size-4" /> Alunos
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
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data: students } = useStudents();
  const { data: memberIds } = useClassMembers(quiz.class_id);
  const reopenings = useQuery({
    queryKey: ["quiz-reopenings", quiz.id, session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_reopenings")
        .select("student_id, until")
        .eq("quiz_id", quiz.id);
      if (error) throw error;
      return data ?? [];
    },
  });
  const toggleReopen = useMutation({
    mutationFn: async ({ studentId, grant }: { studentId: string; grant: boolean }) => {
      const query = grant
        ? supabase
            .from("quiz_reopenings")
            .upsert({ quiz_id: quiz.id, student_id: studentId, granted_by: session!.user.id })
        : supabase
            .from("quiz_reopenings")
            .delete()
            .eq("quiz_id", quiz.id)
            .eq("student_id", studentId);
      const { error } = await query;
      if (error) throw error;
      return grant;
    },
    onSuccess: (grant) => {
      toast.success(grant ? "Quiz liberado para o aluno" : "Liberação removida");
      queryClient.invalidateQueries({ queryKey: ["quiz-reopenings", quiz.id] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar"),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["submissions", quiz.id, session?.user.id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, student_id, answers, score_obtained, submitted_at, graded_at")
        .eq("quiz_id", quiz.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const grade = useMutation({
    mutationFn: async ({ submissionId, score }: { submissionId: string; score: number }) => {
      const { error } = await supabase
        .from("submissions")
        .update({ score_obtained: score, graded_at: new Date().toISOString() })
        .eq("id", submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Correção salva e pontos atualizados");
      queryClient.invalidateQueries({ queryKey: ["submissions", quiz.id] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a correção"),
  });

  const answered = new Set((data ?? []).map((sub) => sub.student_id));
  const pending = (students ?? []).filter(
    (student) => (memberIds ?? []).includes(student.id) && !answered.has(student.id),
  );
  const reopenedFor = new Set(
    (reopenings.data ?? [])
      .filter((r) => !r.until || new Date(r.until) > new Date())
      .map((r) => r.student_id),
  );

  return (
    <div className="animate-pop-in space-y-4 border-t border-border bg-secondary/30 p-4">
      {quiz.class_id && pending.length ? (
        <div>
          <p className="font-display text-sm font-semibold">
            Ainda não responderam ({pending.length})
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Libere o quiz só para quem faltou, mesmo com o quiz encerrado ou de outro trimestre.
          </p>
          <ul className="space-y-1.5">
            {pending.map((student) => {
              const reopened = reopenedFor.has(student.id);
              return (
                <li
                  key={student.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <p className="truncate text-sm">
                    {student.name}
                    {reopened ? (
                      <span className="ml-2 rounded-full bg-success/12 px-2 py-0.5 text-xs font-semibold text-success">
                        liberado
                      </span>
                    ) : null}
                  </p>
                  <Button
                    variant={reopened ? "softDanger" : "softSuccess"}
                    size="sm"
                    disabled={toggleReopen.isPending}
                    onClick={() => toggleReopen.mutate({ studentId: student.id, grant: !reopened })}
                  >
                    {reopened ? (
                      <>
                        <Lock className="size-4" /> Cancelar
                      </>
                    ) : (
                      <>
                        <LockOpen className="size-4" /> Liberar para o aluno
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {isLoading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">Ninguém respondeu ainda.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((sub) => (
            <SubmissionRow
              key={sub.id}
              quiz={quiz}
              submission={sub}
              studentName={students?.find((s) => s.id === sub.student_id)?.name ?? "Aluno"}
              saving={grade.isPending}
              onGrade={(score) => grade.mutate({ submissionId: sub.id, score })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmissionRow({
  quiz,
  submission,
  studentName,
  saving,
  onGrade,
}: {
  quiz: Quiz;
  submission: {
    id: string;
    answers: unknown;
    score_obtained: number;
    graded_at: string | null;
  };
  studentName: string;
  saving: boolean;
  onGrade: (score: number) => void;
}) {
  const answers = (submission.answers as QuizAnswer[]) ?? [];
  const automaticScore = quiz.questions.reduce(
    (sum, question, index) =>
      sum +
      (question.answerType === "multiple_choice" && answers[index] === question.correctOption
        ? question.points
        : 0),
    0,
  );
  const writtenMaximum = quiz.questions.reduce(
    (sum, question) => sum + (question.answerType === "written" ? question.points : 0),
    0,
  );
  const hasWrittenQuestions = quiz.questions.some((question) => question.answerType === "written");
  const total = quiz.questions.reduce((sum, question) => sum + question.points, 0);
  const hasPendingWrittenGrade = hasWrittenQuestions && !submission.graded_at;
  const [writtenPoints, setWrittenPoints] = useState(
    String(Math.max(0, submission.score_obtained - automaticScore)),
  );
  const parsedWrittenPoints = Number(writtenPoints);
  const validScore =
    writtenPoints.trim() !== "" &&
    Number.isInteger(parsedWrittenPoints) &&
    parsedWrittenPoints >= 0 &&
    parsedWrittenPoints <= writtenMaximum;

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="truncate text-sm font-medium">{studentName}</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 font-display text-xs font-bold ${
            hasPendingWrittenGrade
              ? "bg-accent text-accent-foreground"
              : "bg-gold text-gold-foreground"
          }`}
        >
          {hasPendingWrittenGrade ? "Correção pendente" : `${submission.score_obtained}/${total}`}
        </span>
      </div>
      <ol className="mt-3 space-y-3">
        {quiz.questions.map((question, index) => {
          const answer = answers[index];
          return (
            <li key={question.id} className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                {index + 1}. {question.statement}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words">
                {question.answerType === "written"
                  ? typeof answer === "string" && answer.trim()
                    ? answer
                    : "Sem resposta"
                  : typeof answer === "number"
                    ? (question.options[answer] ?? "Sem resposta")
                    : "Sem resposta"}
              </p>
            </li>
          );
        })}
      </ol>
      {hasWrittenQuestions ? (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div className="space-y-1">
            <Label htmlFor={`grade-${submission.id}`} className="text-xs">
              Pontos das respostas discursivas (máximo {writtenMaximum})
            </Label>
            <Input
              id={`grade-${submission.id}`}
              type="number"
              min={0}
              max={writtenMaximum}
              step={1}
              className="h-9 w-36"
              value={writtenPoints}
              onChange={(event) => setWrittenPoints(event.target.value)}
            />
          </div>
          <Button
            variant="ink"
            size="sm"
            disabled={saving || !validScore}
            onClick={() => onGrade(automaticScore + parsedWrittenPoints)}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {submission.graded_at ? "Salvar correção" : "Corrigir resposta"}
          </Button>
          {hasPendingWrittenGrade ? (
            <span className="text-xs text-muted-foreground">
              Os pontos das alternativas já foram creditados.
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toDateTimeInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Prazo vale até o fim do dia escolhido. */
function endOfDay(date: string) {
  return new Date(`${date}T23:59:59`).toISOString();
}

function QuizForm({
  classId,
  quiz,
  onDone,
}: {
  classId: string | null;
  quiz?: Quiz;
  onDone: () => void;
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(quiz?.title ?? "");
  const [description, setDescription] = useState(quiz?.description ?? "");
  const [dueDate, setDueDate] = useState(toDateInput(quiz?.due_date ?? null));
  const [openAt, setOpenAt] = useState(toDateTimeInput(quiz?.open_at ?? null));
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    quiz?.questions.length
      ? quiz.questions.map((q) => ({ ...q, options: [...q.options] }))
      : [emptyQuestion()],
  );
  const status = quiz ? quizStatus(quiz) : "rascunho";

  function update(id: string, patch: Partial<QuizQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  const save = useMutation({
    mutationFn: async (mode: "draft" | "release" | "keep") => {
      if (!title.trim()) throw new Error("Informe o título do quiz");
      if (!classId) throw new Error("Selecione a sala do quiz antes de salvar");
      const clean = questions.map((q) => ({
        ...q,
        statement: q.statement.trim(),
        options:
          q.answerType === "multiple_choice" ? q.options.map((o) => o.trim()).filter(Boolean) : [],
      }));
      if (clean.some((q) => !q.statement)) throw new Error("Toda pergunta precisa de enunciado");
      if (clean.some((q) => q.answerType === "multiple_choice" && q.options.length < 2))
        throw new Error("Cada pergunta precisa de ao menos 2 alternativas");
      if (
        clean.some(
          (q) =>
            q.answerType === "multiple_choice" &&
            (q.correctOption < 0 || q.correctOption >= q.options.length),
        )
      )
        throw new Error("Marque a alternativa correta de cada pergunta");

      const scheduled = openAt ? new Date(openAt).toISOString() : null;
      const base = {
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? endOfDay(dueDate) : null,
        questions: clean,
        class_id: classId,
      };

      if (quiz) {
        const keepRelease = mode === "keep";
        const { error } = await supabase
          .from("quizzes")
          .update(
            keepRelease
              ? { ...base, open_at: scheduled ?? quiz.open_at }
              : {
                  ...base,
                  open_at: mode === "release" ? (scheduled ?? new Date().toISOString()) : scheduled,
                  published: mode === "release" || Boolean(scheduled),
                  closed_at: mode === "release" ? null : quiz.closed_at,
                },
          )
          .eq("id", quiz.id);
        if (error) throw error;
        return mode;
      }

      const { error } = await supabase.from("quizzes").insert({
        ...base,
        open_at: mode === "release" ? (scheduled ?? new Date().toISOString()) : scheduled,
        published: mode === "release" || Boolean(scheduled),
        created_by: session!.user.id,
      });
      if (error) throw error;
      return mode;
    },
    onSuccess: (mode) => {
      toast.success(
        mode === "keep"
          ? "Quiz atualizado!"
          : mode === "draft"
            ? "Rascunho salvo. Libere quando quiser."
            : openAt
              ? "Quiz agendado para a sala!"
              : "Quiz liberado para a sala!",
      );
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao salvar"),
  });

  return (
    <div className="space-y-4">
      {quiz ? (
        <p className="text-sm text-muted-foreground">
          Editando <b className="text-foreground">{quiz.title}</b> · status atual:{" "}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}
          >
            {status}
          </span>
        </p>
      ) : null}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="open">Liberar em (opcional)</Label>
            <Input
              id="open"
              type="datetime-local"
              value={openAt}
              onChange={(e) => setOpenAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para liberar na hora ou guardar como rascunho.
            </p>
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
          <div className="space-y-1.5">
            <Label>Formato da resposta</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={question.answerType === "multiple_choice" ? "ink" : "soft"}
                size="sm"
                onClick={() => update(question.id, { answerType: "multiple_choice" })}
              >
                Alternativas
              </Button>
              <Button
                type="button"
                variant={question.answerType === "written" ? "ink" : "soft"}
                size="sm"
                onClick={() => update(question.id, { answerType: "written" })}
              >
                Discursiva
              </Button>
            </div>
          </div>
          {question.answerType === "multiple_choice" ? (
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
                        options: question.options.map((o, i) =>
                          i === optionIndex ? e.target.value : o,
                        ),
                      })
                    }
                    placeholder={`Alternativa ${String.fromCharCode(65 + optionIndex)}`}
                  />
                  {question.options.length > 2 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remover alternativa"
                      onClick={() => {
                        const options = question.options.filter((_, i) => i !== optionIndex);
                        const correctOption =
                          question.correctOption === optionIndex
                            ? 0
                            : question.correctOption > optionIndex
                              ? question.correctOption - 1
                              : question.correctOption;
                        update(question.id, { options, correctOption });
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              O aluno responderá com suas próprias palavras. A correção e a pontuação serão feitas
              por você depois do envio.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            {question.answerType === "multiple_choice" ? (
              <Button
                variant="soft"
                size="sm"
                onClick={() => update(question.id, { options: [...question.options, ""] })}
              >
                <Plus className="size-4" /> Alternativa
              </Button>
            ) : null}
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
        {quiz && status !== "rascunho" ? (
          <Button variant="ink" disabled={save.isPending} onClick={() => save.mutate("keep")}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar alterações
          </Button>
        ) : (
          <>
            <Button variant="soft" disabled={save.isPending} onClick={() => save.mutate("draft")}>
              Salvar rascunho
            </Button>
            <Button variant="ink" disabled={save.isPending} onClick={() => save.mutate("release")}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {openAt ? "Agendar liberação" : "Liberar agora"}
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
