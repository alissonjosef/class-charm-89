-- Encerramento da aula do dia: depois de fechada, a chamada não lança mais pontos nela.
ALTER TABLE public.lessons ADD COLUMN closed_at TIMESTAMPTZ;
