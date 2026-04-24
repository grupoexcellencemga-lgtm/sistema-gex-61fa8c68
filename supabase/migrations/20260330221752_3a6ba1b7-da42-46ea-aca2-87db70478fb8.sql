
-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_nome text,
  acao text NOT NULL,
  tabela text NOT NULL,
  registro_id uuid,
  registro_nome text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: only admins can read
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Index for common queries
CREATE INDEX idx_audit_logs_tabela ON public.audit_logs(tabela);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_registro_id ON public.audit_logs(registro_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _user_nome text;
  _acao text;
  _registro_id uuid;
  _registro_nome text;
  _old jsonb;
  _new jsonb;
BEGIN
  _user_id := auth.uid();
  
  SELECT nome INTO _user_nome FROM public.profiles WHERE user_id = _user_id LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    _acao := 'excluir';
    _registro_id := OLD.id;
    _old := to_jsonb(OLD);
    _new := NULL;
    _registro_nome := COALESCE(
      OLD.nome, OLD.cliente_nome, OLD.empresa_nome, OLD.descricao, OLD.titulo, OLD.id::text
    );
  ELSIF TG_OP = 'INSERT' THEN
    _acao := 'criar';
    _registro_id := NEW.id;
    _old := NULL;
    _new := to_jsonb(NEW);
    _registro_nome := COALESCE(
      NEW.nome, NEW.cliente_nome, NEW.empresa_nome, NEW.descricao, NEW.titulo, NEW.id::text
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detect soft delete
    IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
      _acao := 'excluir';
    ELSE
      _acao := 'editar';
    END IF;
    _registro_id := NEW.id;
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _registro_nome := COALESCE(
      NEW.nome, NEW.cliente_nome, NEW.empresa_nome, NEW.descricao, NEW.titulo, NEW.id::text
    );
  END IF;

  INSERT INTO public.audit_logs (user_id, user_nome, acao, tabela, registro_id, registro_nome, dados_anteriores, dados_novos)
  VALUES (_user_id, _user_nome, _acao, TG_TABLE_NAME, _registro_id, _registro_nome, _old, _new);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers for all specified tables
CREATE TRIGGER audit_alunos AFTER INSERT OR UPDATE OR DELETE ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_matriculas AFTER INSERT OR UPDATE OR DELETE ON public.matriculas FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_pagamentos AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_leads AFTER INSERT OR UPDATE OR DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_despesas AFTER INSERT OR UPDATE OR DELETE ON public.despesas FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_comissoes AFTER INSERT OR UPDATE OR DELETE ON public.comissoes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_processos_individuais AFTER INSERT OR UPDATE OR DELETE ON public.processos_individuais FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_processos_empresariais AFTER INSERT OR UPDATE OR DELETE ON public.processos_empresariais FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_produtos AFTER INSERT OR UPDATE OR DELETE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_turmas AFTER INSERT OR UPDATE OR DELETE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_eventos AFTER INSERT OR UPDATE OR DELETE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
