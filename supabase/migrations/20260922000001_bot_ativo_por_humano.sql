-- Rastreia qual agente de IA enviou cada mensagem de saída.
-- NULL = mensagem enviada por humano. NOT NULL = enviada pelo bot.
ALTER TABLE mensagens_crm
  ADD COLUMN IF NOT EXISTS agente_bot_id UUID REFERENCES agentes_bot(id) ON DELETE SET NULL;

-- Quando um humano envia uma mensagem (saida + agente_bot_id IS NULL),
-- desativa automaticamente o bot para aquele lead.
-- Isso permite que Julia atenda leads novos sem invadir conversas
-- que um humano já assumiu.
CREATE OR REPLACE FUNCTION trg_fn_humano_desativa_bot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.direcao = 'saida'
     AND NEW.agente_bot_id IS NULL
     AND NEW.lead_id IS NOT NULL
  THEN
    UPDATE leads
    SET bot_ativo = false
    WHERE id = NEW.lead_id
      AND bot_ativo = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_humano_desativa_bot ON mensagens_crm;
CREATE TRIGGER trg_humano_desativa_bot
  AFTER INSERT ON mensagens_crm
  FOR EACH ROW EXECUTE FUNCTION trg_fn_humano_desativa_bot();
