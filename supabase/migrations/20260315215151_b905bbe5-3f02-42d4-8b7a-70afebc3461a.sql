
CREATE TABLE public.processos_individuais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT DEFAULT NULL,
  cliente_telefone TEXT DEFAULT NULL,
  aluno_id UUID REFERENCES public.alunos(id) DEFAULT NULL,
  responsavel TEXT NOT NULL,
  percentual_empresa NUMERIC NOT NULL DEFAULT 50,
  percentual_profissional NUMERIC NOT NULL DEFAULT 50,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  parcelas INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ativo',
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id) DEFAULT NULL,
  forma_pagamento TEXT DEFAULT NULL,
  observacoes TEXT DEFAULT NULL,
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_fim DATE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.processos_individuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view processos_individuais" ON public.processos_individuais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert processos_individuais" ON public.processos_individuais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update processos_individuais" ON public.processos_individuais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete processos_individuais" ON public.processos_individuais FOR DELETE TO authenticated USING (true);
