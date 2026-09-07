-- Tabela de inscrições públicas em turmas (checkout público)
CREATE TABLE IF NOT EXISTS public.inscricoes_turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text,
  telefone text,
  observacoes text,
  utm_source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inscricoes_turmas ENABLE ROW LEVEL SECURITY;

-- Acesso interno (autenticado)
CREATE POLICY "Authenticated can view inscricoes_turmas" ON public.inscricoes_turmas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update inscricoes_turmas" ON public.inscricoes_turmas
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete inscricoes_turmas" ON public.inscricoes_turmas
  FOR DELETE TO authenticated USING (true);

-- Acesso público anônimo (checkout)
CREATE POLICY "Anon can insert inscricoes_turmas" ON public.inscricoes_turmas
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated can insert inscricoes_turmas" ON public.inscricoes_turmas
  FOR INSERT TO authenticated WITH CHECK (true);

-- Turmas: anon pode ler dados básicos para o checkout
CREATE POLICY "Anon can view turmas for checkout" ON public.turmas
  FOR SELECT TO anon USING (deleted_at IS NULL);

-- Produtos: anon pode ler para exibir preço/nome no checkout
CREATE POLICY "Anon can view produtos for checkout" ON public.produtos
  FOR SELECT TO anon USING (true);

-- Correção: participantes_eventos também precisa permitir anon insert (page /inscricao)
CREATE POLICY "Anon can insert participantes_eventos" ON public.participantes_eventos
  FOR INSERT TO anon WITH CHECK (true);

-- Eventos: anon pode ler para exibir dados no checkout de eventos
CREATE POLICY "Anon can view eventos for checkout" ON public.eventos
  FOR SELECT TO anon USING (deleted_at IS NULL);
