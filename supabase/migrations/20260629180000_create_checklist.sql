
-- CHECKLIST ITENS (modelos de itens, criados por administradores)
CREATE TABLE public.checklist_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'diaria' CHECK (tipo IN ('diaria', 'esporadica')),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_alvo DATE,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own checklist itens or admin" ON public.checklist_itens
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert checklist itens" ON public.checklist_itens
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update checklist itens" ON public.checklist_itens
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete checklist itens" ON public.checklist_itens
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_checklist_itens_updated_at
  BEFORE UPDATE ON public.checklist_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CHECKLIST EXECUCOES (registro de conclusao por dia/ocorrencia)
CREATE TABLE public.checklist_execucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.checklist_itens(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_em TIMESTAMPTZ,
  concluido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, data)
);
ALTER TABLE public.checklist_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own execucoes or admin" ON public.checklist_execucoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.checklist_itens i
      WHERE i.id = item_id AND (i.usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Users insert own execucoes" ON public.checklist_execucoes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.checklist_itens i
      WHERE i.id = item_id AND (i.usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Users update own execucoes" ON public.checklist_execucoes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.checklist_itens i
      WHERE i.id = item_id AND (i.usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Admins delete execucoes" ON public.checklist_execucoes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_itens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_execucoes;
