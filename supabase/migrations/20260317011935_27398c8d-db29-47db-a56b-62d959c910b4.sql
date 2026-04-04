
-- Tabela de processos empresariais (espelha processos_individuais com campos para empresa)
CREATE TABLE public.processos_empresariais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_nome text NOT NULL,
  cnpj text,
  empresa_email text,
  empresa_telefone text,
  contato_nome text,
  aluno_id uuid REFERENCES public.alunos(id),
  responsavel text NOT NULL,
  profissional_id uuid REFERENCES public.profissionais(id),
  percentual_empresa numeric NOT NULL DEFAULT 50,
  percentual_profissional numeric NOT NULL DEFAULT 50,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_entrada numeric DEFAULT 0,
  parcelas integer NOT NULL DEFAULT 1,
  sessoes integer DEFAULT 1,
  sessoes_realizadas integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  forma_pagamento text,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id),
  data_inicio date DEFAULT CURRENT_DATE,
  data_fim date,
  data_finalizacao date,
  motivo_cancelamento text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de pagamentos do processo empresarial
CREATE TABLE public.pagamentos_processo_empresarial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos_empresariais(id) ON DELETE CASCADE,
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL DEFAULT 'entrada',
  forma_pagamento text,
  observacoes text,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processos_empresariais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_processo_empresarial ENABLE ROW LEVEL SECURITY;

-- RLS policies for processos_empresariais
CREATE POLICY "Authenticated can view processos_empresariais" ON public.processos_empresariais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert processos_empresariais" ON public.processos_empresariais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update processos_empresariais" ON public.processos_empresariais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete processos_empresariais" ON public.processos_empresariais FOR DELETE TO authenticated USING (true);

-- RLS policies for pagamentos_processo_empresarial
CREATE POLICY "Authenticated can view pagamentos_processo_empresarial" ON public.pagamentos_processo_empresarial FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pagamentos_processo_empresarial" ON public.pagamentos_processo_empresarial FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pagamentos_processo_empresarial" ON public.pagamentos_processo_empresarial FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete pagamentos_processo_empresarial" ON public.pagamentos_processo_empresarial FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_processos_empresariais_updated_at
  BEFORE UPDATE ON public.processos_empresariais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
