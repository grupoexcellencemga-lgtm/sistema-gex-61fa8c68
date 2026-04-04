CREATE TABLE IF NOT EXISTS sessoes_processo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_tipo TEXT NOT NULL CHECK (processo_tipo IN ('individual', 'empresarial')),
  processo_id UUID NOT NULL,
  profissional_id UUID REFERENCES profissionais(id) ON DELETE SET NULL,
  data_hora TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER DEFAULT 60,
  status TEXT DEFAULT 'agendada' CHECK (status IN ('agendada', 'realizada', 'cancelada', 'reagendada')),
  local TEXT,
  link_online TEXT,
  observacoes TEXT,
  observacoes_pos TEXT,
  numero_sessao INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- RLS
ALTER TABLE sessoes_processo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessoes_processo_select" ON sessoes_processo FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "sessoes_processo_insert" ON sessoes_processo FOR INSERT TO authenticated WITH CHECK (deleted_at IS NULL);
CREATE POLICY "sessoes_processo_update" ON sessoes_processo FOR UPDATE TO authenticated USING (deleted_at IS NULL);

-- Indices
CREATE INDEX idx_sessoes_processo_deleted_at ON sessoes_processo (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_sessoes_data_hora ON sessoes_processo (data_hora);

-- Triggers (Assuming standard handles exist, typical in this schema based on instructions)
CREATE TRIGGER handle_sessoes_processo_updated_at
BEFORE UPDATE ON sessoes_processo FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER audit_sessoes_processo
AFTER INSERT OR UPDATE OR DELETE ON sessoes_processo FOR EACH ROW
EXECUTE FUNCTION audit_log_changes();
