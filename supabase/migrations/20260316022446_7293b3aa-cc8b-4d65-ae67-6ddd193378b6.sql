
-- Table to track payments made BY the company TO professionals
CREATE TABLE public.pagamentos_profissional (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.processos_individuais(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento TEXT,
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  observacoes TEXT,
  despesa_id UUID REFERENCES public.despesas(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pagamentos_profissional ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view pagamentos_profissional" ON public.pagamentos_profissional FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pagamentos_profissional" ON public.pagamentos_profissional FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pagamentos_profissional" ON public.pagamentos_profissional FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete pagamentos_profissional" ON public.pagamentos_profissional FOR DELETE TO authenticated USING (true);
