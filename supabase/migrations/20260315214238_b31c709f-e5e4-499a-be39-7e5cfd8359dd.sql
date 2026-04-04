
CREATE TABLE public.receitas_avulsas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria TEXT DEFAULT NULL,
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id) DEFAULT NULL,
  forma_pagamento TEXT DEFAULT NULL,
  observacoes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.receitas_avulsas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view receitas_avulsas" ON public.receitas_avulsas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert receitas_avulsas" ON public.receitas_avulsas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update receitas_avulsas" ON public.receitas_avulsas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete receitas_avulsas" ON public.receitas_avulsas FOR DELETE TO authenticated USING (true);
