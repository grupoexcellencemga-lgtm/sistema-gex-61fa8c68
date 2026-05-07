-- Ativa atualização em tempo real para a aba Divulgação.
-- Necessário para uma alteração feita em um computador aparecer para todos os usuários conectados.

ALTER TABLE public.divulgacoes REPLICA IDENTITY FULL;
ALTER TABLE public.divulgacao_colunas REPLICA IDENTITY FULL;
ALTER TABLE public.divulgacao_quadros REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'divulgacoes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.divulgacoes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'divulgacao_colunas'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.divulgacao_colunas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'divulgacao_quadros'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.divulgacao_quadros';
  END IF;
END $$;
