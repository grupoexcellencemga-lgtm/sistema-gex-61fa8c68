
-- ═══ ADD deleted_at COLUMN ═══
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.mindmaps ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.pagamentos_processo ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.pagamentos_processo_empresarial ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.pagamentos_profissional ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.receitas_avulsas ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.reembolsos ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.contas_a_pagar ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.contas_bancarias ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.transferencias_entre_contas ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.comissoes ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- ═══ PARTIAL INDEXES ═══
CREATE INDEX IF NOT EXISTS idx_eventos_deleted_at ON public.eventos (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_turmas_deleted_at ON public.turmas (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_deleted_at ON public.produtos (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_metas_deleted_at ON public.metas (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mindmaps_deleted_at ON public.mindmaps (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_processo_deleted_at ON public.pagamentos_processo (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_processo_empresarial_deleted_at ON public.pagamentos_processo_empresarial (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_profissional_deleted_at ON public.pagamentos_profissional (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receitas_avulsas_deleted_at ON public.receitas_avulsas (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reembolsos_deleted_at ON public.reembolsos (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_deleted_at ON public.contas_a_pagar (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_deleted_at ON public.contas_bancarias (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transferencias_entre_contas_deleted_at ON public.transferencias_entre_contas (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comissoes_deleted_at ON public.comissoes (deleted_at) WHERE deleted_at IS NULL;

-- ═══ AUDIT TRIGGERS (drop first to avoid conflicts) ═══
DROP TRIGGER IF EXISTS audit_eventos ON public.eventos;
CREATE TRIGGER audit_eventos AFTER INSERT OR UPDATE OR DELETE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_turmas ON public.turmas;
CREATE TRIGGER audit_turmas AFTER INSERT OR UPDATE OR DELETE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_produtos ON public.produtos;
CREATE TRIGGER audit_produtos AFTER INSERT OR UPDATE OR DELETE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_metas ON public.metas;
CREATE TRIGGER audit_metas AFTER INSERT OR UPDATE OR DELETE ON public.metas FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_mindmaps ON public.mindmaps;
CREATE TRIGGER audit_mindmaps AFTER INSERT OR UPDATE OR DELETE ON public.mindmaps FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_pagamentos_processo ON public.pagamentos_processo;
CREATE TRIGGER audit_pagamentos_processo AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_processo FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_pagamentos_processo_empresarial ON public.pagamentos_processo_empresarial;
CREATE TRIGGER audit_pagamentos_processo_empresarial AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_processo_empresarial FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_pagamentos_profissional ON public.pagamentos_profissional;
CREATE TRIGGER audit_pagamentos_profissional AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_profissional FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_receitas_avulsas ON public.receitas_avulsas;
CREATE TRIGGER audit_receitas_avulsas AFTER INSERT OR UPDATE OR DELETE ON public.receitas_avulsas FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_reembolsos ON public.reembolsos;
CREATE TRIGGER audit_reembolsos AFTER INSERT OR UPDATE OR DELETE ON public.reembolsos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_contas_a_pagar ON public.contas_a_pagar;
CREATE TRIGGER audit_contas_a_pagar AFTER INSERT OR UPDATE OR DELETE ON public.contas_a_pagar FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_contas_bancarias ON public.contas_bancarias;
CREATE TRIGGER audit_contas_bancarias AFTER INSERT OR UPDATE OR DELETE ON public.contas_bancarias FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_transferencias_entre_contas ON public.transferencias_entre_contas;
CREATE TRIGGER audit_transferencias_entre_contas AFTER INSERT OR UPDATE OR DELETE ON public.transferencias_entre_contas FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_comissoes ON public.comissoes;
CREATE TRIGGER audit_comissoes AFTER INSERT OR UPDATE OR DELETE ON public.comissoes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
