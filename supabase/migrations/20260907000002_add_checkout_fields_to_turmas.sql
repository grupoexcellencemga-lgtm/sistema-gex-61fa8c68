ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS pix_chave text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS asaas_link_pagamento text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS descricao text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pergunta_inscricao text DEFAULT NULL;
