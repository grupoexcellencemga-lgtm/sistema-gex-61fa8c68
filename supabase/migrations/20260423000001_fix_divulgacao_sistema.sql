-- ═══════════════════════════════════════════════════════════
-- MIGRATION: Corrige tabela divulgacoes e cria divulgacao_colunas
-- ═══════════════════════════════════════════════════════════

-- 1) Criar tabela divulgacao_colunas (precisa existir antes do FK)
CREATE TABLE IF NOT EXISTS public.divulgacao_colunas (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text        NOT NULL,
  ordem      integer     NOT NULL DEFAULT 0,
  cor        text        NOT NULL DEFAULT 'blue',
  icone      text        NOT NULL DEFAULT '📋',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.divulgacao_colunas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can manage divulgacao_colunas" ON public.divulgacao_colunas;
CREATE POLICY "Authenticated can manage divulgacao_colunas"
  ON public.divulgacao_colunas
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 2) Adicionar colunas faltantes na tabela divulgacoes
ALTER TABLE public.divulgacoes
  ADD COLUMN IF NOT EXISTS coluna_id   uuid    REFERENCES public.divulgacao_colunas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS arquivo_url  text,
  ADD COLUMN IF NOT EXISTS arquivo_tipo text,
  ADD COLUMN IF NOT EXISTS arquivo_nome text,
  ADD COLUMN IF NOT EXISTS ativo        boolean NOT NULL DEFAULT true;

-- 3) Índice para performance
CREATE INDEX IF NOT EXISTS idx_divulgacoes_coluna_id ON public.divulgacao_colunas (id);
CREATE INDEX IF NOT EXISTS idx_divulgacoes_ativo    ON public.divulgacoes (ativo);

-- 4) Storage bucket para arquivos de divulgação
INSERT INTO storage.buckets (id, name, public)
  VALUES ('divulgacoes', 'divulgacoes', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public read divulgacoes bucket"   ON storage.objects;
DROP POLICY IF EXISTS "Allow auth upload divulgacoes bucket"   ON storage.objects;
DROP POLICY IF EXISTS "Allow auth delete divulgacoes bucket"   ON storage.objects;

CREATE POLICY "Allow public read divulgacoes bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'divulgacoes');

CREATE POLICY "Allow auth upload divulgacoes bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'divulgacoes');

CREATE POLICY "Allow auth delete divulgacoes bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'divulgacoes');

-- 5) Trigger updated_at para divulgacao_colunas
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_divulgacao_colunas_updated_at ON public.divulgacao_colunas;
CREATE TRIGGER set_divulgacao_colunas_updated_at
  BEFORE UPDATE ON public.divulgacao_colunas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
