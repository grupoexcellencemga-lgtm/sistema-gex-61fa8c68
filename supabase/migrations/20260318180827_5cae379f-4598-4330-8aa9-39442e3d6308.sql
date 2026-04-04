
-- Table: encontros (sessions per turma)
CREATE TABLE public.encontros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  sessao_numero integer NOT NULL,
  data date,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: presencas (attendance per student per session)
CREATE TABLE public.presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ausente',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, encontro_id)
);

-- Enable RLS
ALTER TABLE public.encontros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

-- RLS for encontros: linked to turma's responsavel
CREATE POLICY "Authenticated can insert encontros" ON public.encontros
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Filtered view encontros" ON public.encontros
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.turmas t
      WHERE t.id = encontros.turma_id
      AND public.can_access_by_responsavel(auth.uid(), t.responsavel)
    )
  );

CREATE POLICY "Filtered update encontros" ON public.encontros
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.turmas t
      WHERE t.id = encontros.turma_id
      AND public.can_access_by_responsavel(auth.uid(), t.responsavel)
    )
  );

CREATE POLICY "Filtered delete encontros" ON public.encontros
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.turmas t
      WHERE t.id = encontros.turma_id
      AND public.can_access_by_responsavel(auth.uid(), t.responsavel)
    )
  );

-- RLS for presencas: linked to turma's responsavel
CREATE POLICY "Authenticated can insert presencas" ON public.presencas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Filtered view presencas" ON public.presencas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.turmas t
      WHERE t.id = presencas.turma_id
      AND public.can_access_by_responsavel(auth.uid(), t.responsavel)
    )
  );

CREATE POLICY "Filtered update presencas" ON public.presencas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.turmas t
      WHERE t.id = presencas.turma_id
      AND public.can_access_by_responsavel(auth.uid(), t.responsavel)
    )
  );

CREATE POLICY "Filtered delete presencas" ON public.presencas
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.turmas t
      WHERE t.id = presencas.turma_id
      AND public.can_access_by_responsavel(auth.uid(), t.responsavel)
    )
  );

-- Trigger for updated_at on presencas
CREATE TRIGGER update_presencas_updated_at
  BEFORE UPDATE ON public.presencas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
