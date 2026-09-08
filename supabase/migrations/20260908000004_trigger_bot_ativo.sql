-- Trigger: ao ligar bot_ativo em um lead, chama processar-bot imediatamente
CREATE OR REPLACE FUNCTION public.fn_trigger_bot_ativo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text;
BEGIN
  -- Só dispara quando bot_ativo muda de false para true
  IF NEW.bot_ativo = true AND (OLD.bot_ativo = false OR OLD.bot_ativo IS NULL) THEN
    v_url := current_setting('app.settings.edge_function_url', true)
             || '/functions/v1/processar-bot';

    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', current_setting('app.settings.service_role_key', true)
      ),
      body    := jsonb_build_object('forceLeadId', NEW.id::text)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ativo ON public.leads;
CREATE TRIGGER trg_bot_ativo
  AFTER UPDATE OF bot_ativo ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_bot_ativo();
