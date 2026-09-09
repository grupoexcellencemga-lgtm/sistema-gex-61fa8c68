-- Função: fecha sessões abertas há mais de 4h sem resposta do lead
CREATE OR REPLACE FUNCTION public.auto_close_conversas_ia()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.conversas_ia
  SET
    finalizado_em = now(),
    motivo_fim    = 'sem_resposta'
  WHERE
    finalizado_em IS NULL
    AND deleted_at IS NULL
    AND iniciado_em < now() - interval '4 hours';
END;
$$;

-- Cron diário às 03:00 (horário UTC) para fechar sessões abandonadas
SELECT cron.schedule(
  'auto-close-conversas-ia',
  '0 3 * * *',
  $$ SELECT public.auto_close_conversas_ia(); $$
);
