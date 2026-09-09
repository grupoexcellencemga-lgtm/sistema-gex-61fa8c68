-- Cron job: executa processar-bot a cada 15 minutos
-- Isso ativa o ciclo de:
--   1) Responder leads em fila que passaram o tempo_espera_minutos
--   2) Enviar follow-ups configurados nos agentes

SELECT cron.schedule(
  'processar-bot-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.edge_function_url') || '/functions/v1/processar-bot',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
