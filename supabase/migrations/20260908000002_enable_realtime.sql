-- Habilita Supabase Realtime para as tabelas principais do sistema.
-- Usa bloco idempotente para não falhar se a tabela já estiver na publicação.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'alunos',
    'pagamentos',
    'turmas',
    'eventos',
    'leads',
    'profissionais',
    'inscricoes_evento',
    'chaves_pix',
    'tarefas',
    'notificacoes',
    'checklist_itens',
    'sessoes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;
