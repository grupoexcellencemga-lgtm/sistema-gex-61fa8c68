
CREATE TABLE public.fechamentos_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_bancaria_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  saldo_fechamento numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(conta_bancaria_id, mes, ano)
);

ALTER TABLE public.fechamentos_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view fechamentos" ON public.fechamentos_mensais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert fechamentos" ON public.fechamentos_mensais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update fechamentos" ON public.fechamentos_mensais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete fechamentos" ON public.fechamentos_mensais FOR DELETE TO authenticated USING (true);
