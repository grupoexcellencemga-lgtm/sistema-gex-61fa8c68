
-- Contas bancárias
CREATE TABLE public.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  banco text NOT NULL,
  agencia text,
  numero_conta text,
  tipo text NOT NULL DEFAULT 'corrente',
  saldo_inicial numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contas_bancarias" ON public.contas_bancarias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contas_bancarias" ON public.contas_bancarias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contas_bancarias" ON public.contas_bancarias FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contas_bancarias" ON public.contas_bancarias FOR DELETE TO authenticated USING (true);

-- Categorias de despesas
CREATE TABLE public.categorias_despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'geral',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view categorias_despesas" ON public.categorias_despesas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert categorias_despesas" ON public.categorias_despesas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update categorias_despesas" ON public.categorias_despesas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete categorias_despesas" ON public.categorias_despesas FOR DELETE TO authenticated USING (true);

-- Despesas
CREATE TABLE public.despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  categoria_id uuid REFERENCES public.categorias_despesas(id) ON DELETE SET NULL,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  fornecedor text,
  forma_pagamento text,
  comprovante_url text,
  observacoes text,
  recorrente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view despesas" ON public.despesas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert despesas" ON public.despesas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update despesas" ON public.despesas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete despesas" ON public.despesas FOR DELETE TO authenticated USING (true);

-- Adicionar conta_bancaria_id na tabela pagamentos para rastrear onde entra o dinheiro
ALTER TABLE public.pagamentos ADD COLUMN conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;

-- Inserir categorias padrão
INSERT INTO public.categorias_despesas (nome, tipo) VALUES
  ('Material Didático', 'turma'),
  ('Infraestrutura', 'empresa'),
  ('Marketing', 'empresa'),
  ('Salários', 'empresa'),
  ('Aluguel', 'empresa'),
  ('Alimentação', 'turma'),
  ('Transporte', 'turma'),
  ('Software/Tecnologia', 'empresa'),
  ('Impostos/Taxas', 'empresa'),
  ('Outros', 'geral');
