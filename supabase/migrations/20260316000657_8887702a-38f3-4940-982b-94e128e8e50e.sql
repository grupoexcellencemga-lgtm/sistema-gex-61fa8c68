
ALTER TABLE public.processos_individuais 
  ADD COLUMN cpf TEXT,
  ADD COLUMN data_nascimento DATE,
  ADD COLUMN sessoes INTEGER DEFAULT 1,
  ADD COLUMN data_finalizacao DATE;

-- Update existing status values
UPDATE public.processos_individuais SET status = 'aberto' WHERE status = 'ativo';
UPDATE public.processos_individuais SET status = 'finalizado' WHERE status = 'concluido';
