
CREATE TABLE public.profissionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  especialidade TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view profissionais" ON public.profissionais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert profissionais" ON public.profissionais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update profissionais" ON public.profissionais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete profissionais" ON public.profissionais FOR DELETE TO authenticated USING (true);

-- Add profissional_id to processos_individuais
ALTER TABLE public.processos_individuais ADD COLUMN profissional_id UUID REFERENCES public.profissionais(id);
