-- Adiciona coluna de estado de conversa persistente à tabela leads.
-- Usado pelo Atualizador de Estado da Júlia para manter memória entre mensagens.
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS conversation_state jsonb NOT NULL DEFAULT '{
  "preferred_name": null,
  "current_product": null,
  "origin": null,
  "city": null,
  "current_intent": "unknown",
  "explicit_question": null,
  "main_need": null,
  "current_objection": null,
  "funnel_stage": "novo_lead",
  "temperature": "frio",
  "purchase_intent": "none",
  "information_already_shared": [],
  "known_user_facts": [],
  "last_julia_question": null,
  "awaiting": "none",
  "agreed_next_action": null,
  "payment_method": null,
  "promised_payment_at": null,
  "handoff_active": false,
  "do_not_contact": false,
  "conversation_summary": ""
}'::jsonb;

-- Índice para buscas futuras por estado de funil via JSONB
CREATE INDEX IF NOT EXISTS idx_leads_funnel_stage
  ON leads ((conversation_state->>'funnel_stage'))
  WHERE deleted_at IS NULL;
