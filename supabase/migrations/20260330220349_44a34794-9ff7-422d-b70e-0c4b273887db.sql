
-- Table: notificacoes
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notificacoes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notificacoes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications"
  ON public.notificacoes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_notificacoes_user_lida ON public.notificacoes (user_id, lida, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- Table: configuracoes_usuario
CREATE TABLE public.configuracoes_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  notif_pagamento_vencido BOOLEAN NOT NULL DEFAULT true,
  notif_novo_cadastro BOOLEAN NOT NULL DEFAULT true,
  notif_aniversarios BOOLEAN NOT NULL DEFAULT true,
  notif_sessoes BOOLEAN NOT NULL DEFAULT true,
  notif_leads_inativos BOOLEAN NOT NULL DEFAULT true,
  tema TEXT NOT NULL DEFAULT 'system',
  dados_empresa JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own config"
  ON public.configuracoes_usuario FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config"
  ON public.configuracoes_usuario FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
  ON public.configuracoes_usuario FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
