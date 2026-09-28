-- Adiciona nome_whatsapp para armazenar o pushName atual do WhatsApp separado
-- do nome curado (que pode vir da agenda ou edição manual).
-- nome_whatsapp: sempre atualizado a cada mensagem recebida com o pushName.
-- nome: mantém a lógica atual (agenda > manual > primeiro pushName).
-- O {nome} nos fluxos passa a usar nome_whatsapp ?? nome para refletir o
-- nome real que a pessoa usa no WhatsApp, não o que estava salvo no CRM.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS nome_whatsapp TEXT;
