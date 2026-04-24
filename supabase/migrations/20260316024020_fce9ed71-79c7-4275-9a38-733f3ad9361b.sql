
-- Table: comerciais (sales people)
CREATE TABLE public.comerciais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comerciais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view comerciais" ON public.comerciais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert comerciais" ON public.comerciais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update comerciais" ON public.comerciais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete comerciais" ON public.comerciais FOR DELETE TO authenticated USING (true);

-- Add comercial_id to matriculas
ALTER TABLE public.matriculas ADD COLUMN comercial_id UUID REFERENCES public.comerciais(id);

-- Table: comissoes (commission tracking)
CREATE TABLE public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula_id UUID NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  comercial_id UUID NOT NULL REFERENCES public.comerciais(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  turma_id UUID REFERENCES public.turmas(id),
  valor_matricula NUMERIC NOT NULL DEFAULT 0,
  percentual NUMERIC NOT NULL DEFAULT 5,
  valor_comissao NUMERIC NOT NULL DEFAULT 0,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_pagamento DATE,
  forma_pagamento TEXT,
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  despesa_id UUID REFERENCES public.despesas(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view comissoes" ON public.comissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert comissoes" ON public.comissoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update comissoes" ON public.comissoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete comissoes" ON public.comissoes FOR DELETE TO authenticated USING (true);
