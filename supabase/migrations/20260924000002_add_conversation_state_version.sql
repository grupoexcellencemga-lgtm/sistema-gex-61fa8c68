-- Controle otimista de concorrência para a memória estruturada da Júlia.
-- Registros existentes começam na versão 1; cada atualização confirmada incrementa o valor.
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS conversation_state_version bigint NOT NULL DEFAULT 1;

ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_conversation_state_version_positive;

ALTER TABLE public.leads
ADD CONSTRAINT leads_conversation_state_version_positive
CHECK (conversation_state_version >= 1);

COMMENT ON COLUMN public.leads.conversation_state_version IS
  'Versão usada em compare-and-swap para impedir sobrescrita concorrente de conversation_state.';
