-- Habilita pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Tabela de artigos da base de conhecimento vetorial
CREATE TABLE IF NOT EXISTS public.base_conhecimento (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  agente_id   uuid REFERENCES public.agentes_bot(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  conteudo    text NOT NULL,
  categoria   text DEFAULT 'outro'
              CHECK (categoria IN ('objecao', 'metodologia', 'faq', 'diferencial', 'script', 'outro')),
  embedding   extensions.vector(384),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS base_conhecimento_empresa_id_idx ON public.base_conhecimento (empresa_id);
CREATE INDEX IF NOT EXISTS base_conhecimento_agente_id_idx  ON public.base_conhecimento (agente_id);

ALTER TABLE public.base_conhecimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_conhecimento: leitura por empresa"
  ON public.base_conhecimento FOR SELECT
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "base_conhecimento: escrita pelo service role"
  ON public.base_conhecimento FOR ALL
  USING (true)
  WITH CHECK (true);

-- RPC: busca semântica por similaridade de cosseno
CREATE OR REPLACE FUNCTION public.buscar_conhecimento(
  p_empresa_id  uuid,
  p_agente_id   uuid,
  p_embedding   extensions.vector(384),
  p_limite      integer DEFAULT 3,
  p_limiar      float   DEFAULT 0.25
)
RETURNS TABLE (titulo text, conteudo text, categoria text, similaridade float)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    titulo,
    conteudo,
    categoria,
    1 - (embedding <=> p_embedding) AS similaridade
  FROM public.base_conhecimento
  WHERE empresa_id = p_empresa_id
    AND (agente_id = p_agente_id OR agente_id IS NULL)
    AND deleted_at IS NULL
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> p_embedding) >= p_limiar
  ORDER BY embedding <=> p_embedding
  LIMIT p_limite;
$$;
