
CREATE TABLE public.reembolsos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_nome TEXT NOT NULL,
  pessoa_tipo TEXT NOT NULL DEFAULT 'profissional',
  pessoa_id UUID,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  data_despesa DATE NOT NULL DEFAULT CURRENT_DATE,
  data_reembolso DATE,
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  forma_pagamento TEXT,
  despesa_id UUID REFERENCES public.despesas(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reembolsos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reembolsos" ON public.reembolsos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert reembolsos" ON public.reembolsos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update reembolsos" ON public.reembolsos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete reembolsos" ON public.reembolsos FOR DELETE TO authenticated USING (true);
