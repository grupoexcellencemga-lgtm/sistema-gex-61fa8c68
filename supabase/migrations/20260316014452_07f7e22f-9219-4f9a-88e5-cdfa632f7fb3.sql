
ALTER TABLE public.processos_individuais 
  ADD COLUMN sessoes_realizadas integer NOT NULL DEFAULT 0,
  ADD COLUMN motivo_cancelamento text DEFAULT NULL;
