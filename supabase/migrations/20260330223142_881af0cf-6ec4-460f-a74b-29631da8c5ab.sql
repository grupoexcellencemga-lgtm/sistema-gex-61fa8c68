
-- WhatsApp templates table
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  mensagem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view whatsapp_templates" ON public.whatsapp_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage whatsapp_templates" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- WhatsApp messages log table
CREATE TABLE public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  telefone text NOT NULL,
  mensagem text NOT NULL,
  template_id uuid REFERENCES public.whatsapp_templates(id),
  entidade_tipo text,
  entidade_id uuid,
  entidade_nome text,
  status text NOT NULL DEFAULT 'enviado',
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view whatsapp_mensagens" ON public.whatsapp_mensagens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert whatsapp_mensagens" ON public.whatsapp_mensagens
  FOR INSERT TO authenticated WITH CHECK (true);

-- WhatsApp config stored in dados_empresa JSONB (already exists)
-- No schema changes needed for config storage
