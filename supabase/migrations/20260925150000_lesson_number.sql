-- Número da lição dentro do semestre (1 a 13), para a "caixinha" de lições da aba Aula.
ALTER TABLE public.lessons
  ADD COLUMN lesson_number INTEGER CHECK (lesson_number BETWEEN 1 AND 13);
