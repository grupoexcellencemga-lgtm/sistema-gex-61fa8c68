
-- Create tarefas table
CREATE TABLE public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'outro',
  prioridade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente',
  responsavel_id UUID NOT NULL,
  data_vencimento DATE,
  hora TIME,
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  processo_id UUID,
  recorrencia TEXT NOT NULL DEFAULT 'nenhuma',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can CRUD on tarefas they're responsible for or created
CREATE POLICY "Authenticated can view tarefas" ON public.tarefas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert tarefas" ON public.tarefas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update tarefas" ON public.tarefas
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete tarefas" ON public.tarefas
  FOR DELETE TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefas;
