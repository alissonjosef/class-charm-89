-- Prazo do quiz vale até o fim do dia escolhido (antes era meia-noite, então o quiz
-- com prazo "hoje" já aparecia encerrado e sumia da visão do aluno).
UPDATE public.quizzes
SET due_date = date_trunc('day', due_date) + interval '23 hours 59 minutes 59 seconds'
WHERE due_date IS NOT NULL
  AND due_date = date_trunc('day', due_date);
