
CREATE TABLE public.contas_a_pagar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  categoria TEXT,
  fornecedor TEXT,
  forma_pagamento TEXT,
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  observacoes TEXT,
  recorrente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_a_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contas_a_pagar" ON public.contas_a_pagar FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contas_a_pagar" ON public.contas_a_pagar FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contas_a_pagar" ON public.contas_a_pagar FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contas_a_pagar" ON public.contas_a_pagar FOR DELETE TO authenticated USING (true);
