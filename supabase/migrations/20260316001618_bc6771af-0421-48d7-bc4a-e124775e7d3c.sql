
CREATE TABLE public.pagamentos_processo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos_individuais(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'entrada',
  forma_pagamento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pagamentos_processo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pagamentos_processo" ON public.pagamentos_processo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pagamentos_processo" ON public.pagamentos_processo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pagamentos_processo" ON public.pagamentos_processo FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete pagamentos_processo" ON public.pagamentos_processo FOR DELETE TO authenticated USING (true);
