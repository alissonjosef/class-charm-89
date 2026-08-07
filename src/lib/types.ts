export type QuizQuestion = {
  id: string;
  statement: string;
  options: string[];
  correctOption: number;
  points: number;
};

export type Quiz = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  questions: QuizQuestion[];
  published: boolean;
  created_at: string;
};

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
  answers: number[];
  score_obtained: number;
  submitted_at: string;
};

export function parseQuiz(row: {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  questions: unknown;
  published: boolean;
  created_at: string;
}): Quiz {
  return { ...row, questions: (row.questions as QuizQuestion[]) ?? [] };
}
