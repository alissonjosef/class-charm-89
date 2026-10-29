export type QuizAnswerType = "multiple_choice" | "written";

export type QuizQuestion = {
  id: string;
  statement: string;
  answerType: QuizAnswerType;
  options: string[];
  correctOption: number;
  points: number;
};

export type QuizAnswer = number | string;

export type Quiz = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  questions: QuizQuestion[];
  published: boolean;
  created_at: string;
  class_id: string | null;
  open_at: string | null;
  closed_at: string | null;
  term: string;
};

export type QuizStatus = "rascunho" | "agendado" | "aberto" | "encerrado";

export function quizStatus(quiz: Quiz, now = new Date()): QuizStatus {
  if (!quiz.published || !quiz.open_at) return "rascunho";
  if (new Date(quiz.open_at) > now) return "agendado";
  if (quiz.closed_at && new Date(quiz.closed_at) <= now) return "encerrado";
  if (quiz.due_date && new Date(quiz.due_date) <= now) return "encerrado";
  return "aberto";
}

export type PointEntry = {
  id: string;
  student_id: string;
  type: string;
  points: number;
  note: string | null;
  created_at: string;
};

export type Submission = {
  id: string;
  quiz_id: string;
  student_id: string;
  answers: QuizAnswer[];
  score_obtained: number;
  submitted_at: string;
  graded_at: string | null;
};

export const QUIZ_COLUMNS =
  "id, title, description, due_date, questions, published, created_at, class_id, open_at, closed_at, term";

export function parseQuiz(row: {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  questions: unknown;
  published: boolean;
  created_at: string;
  class_id: string | null;
  open_at: string | null;
  closed_at: string | null;
  term: string;
}): Quiz {
  const questions =
    (row.questions as (Omit<QuizQuestion, "answerType"> & {
      answerType?: QuizAnswerType;
    })[]) ?? [];
  return {
    ...row,
    questions: questions.map((question) => ({
      ...question,
      answerType: question.answerType === "written" ? "written" : "multiple_choice",
    })),
  };
}
