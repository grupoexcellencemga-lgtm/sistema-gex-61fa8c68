
CREATE TABLE public.participantes_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid REFERENCES public.eventos(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  email text,
  telefone text,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.participantes_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view participantes_eventos" ON public.participantes_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert participantes_eventos" ON public.participantes_eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update participantes_eventos" ON public.participantes_eventos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete participantes_eventos" ON public.participantes_eventos FOR DELETE TO authenticated USING (true);
