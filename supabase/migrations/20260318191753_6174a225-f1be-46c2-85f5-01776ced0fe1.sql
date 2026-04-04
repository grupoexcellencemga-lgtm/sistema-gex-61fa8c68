
ALTER TABLE public.processos_individuais
  ADD COLUMN IF NOT EXISTS comercial_id uuid REFERENCES public.comerciais(id),
  ADD COLUMN IF NOT EXISTS percentual_comissao numeric DEFAULT 5;

ALTER TABLE public.processos_empresariais
  ADD COLUMN IF NOT EXISTS comercial_id uuid REFERENCES public.comerciais(id),
  ADD COLUMN IF NOT EXISTS percentual_comissao numeric DEFAULT 5;
