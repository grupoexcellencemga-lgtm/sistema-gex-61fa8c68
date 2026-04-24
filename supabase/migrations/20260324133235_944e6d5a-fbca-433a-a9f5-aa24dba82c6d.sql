CREATE TABLE public.transferencias_entre_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_origem_id uuid NOT NULL REFERENCES public.contas_bancarias(id),
  conta_destino_id uuid NOT NULL REFERENCES public.contas_bancarias(id),
  valor numeric NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transferencias_entre_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view transferencias" ON public.transferencias_entre_contas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert transferencias" ON public.transferencias_entre_contas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update transferencias" ON public.transferencias_entre_contas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete transferencias" ON public.transferencias_entre_contas FOR DELETE TO authenticated USING (true);