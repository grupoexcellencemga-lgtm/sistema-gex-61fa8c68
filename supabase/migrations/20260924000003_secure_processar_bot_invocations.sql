-- Autenticação interna de processar-bot.
-- Webhook/Edge Functions usam service role; cron e trigger usam segredo no Vault.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'processar_bot_internal_secret'
  ) THEN
    PERFORM vault.create_secret(
      gen_random_uuid()::text || gen_random_uuid()::text,
      'processar_bot_internal_secret',
      'Credencial interna para cron e trigger chamarem processar-bot'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_processar_bot_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT p_secret IS NOT NULL AND EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'processar_bot_internal_secret'
      AND decrypted_secret = p_secret
  );
$$;

REVOKE ALL ON FUNCTION public.verify_processar_bot_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_processar_bot_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_trigger_bot_ativo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_secret text;
BEGIN
  IF NEW.bot_ativo = true AND (OLD.bot_ativo = false OR OLD.bot_ativo IS NULL) THEN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'processar_bot_internal_secret'
    LIMIT 1;

    IF v_secret IS NULL THEN
      RAISE WARNING 'processar-bot não foi chamado: segredo interno ausente';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := 'https://nsxigkgfvbzhpxrpwvhw.supabase.co/functions/v1/processar-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-processar-bot-secret', v_secret
      ),
      body := jsonb_build_object('forceLeadId', NEW.id::text)
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('processar-bot', 'processar-bot-cron')
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'processar-bot',
  '*/2 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nsxigkgfvbzhpxrpwvhw.supabase.co/functions/v1/processar-bot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-processar-bot-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'processar_bot_internal_secret'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
