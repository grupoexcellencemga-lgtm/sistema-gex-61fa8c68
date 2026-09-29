-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 / MIG 2 — Criar tabela permuta_itens
-- Inclui: trigger de updated_at (usa public.update_updated_at_column()),
--         3 índices, função SQL calcular_status_permuta(UUID)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE permuta_itens (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id        UUID          NOT NULL
                      REFERENCES pagamentos(id) ON DELETE CASCADE,
  empresa_id          UUID          NOT NULL
                      REFERENCES empresas(id),

  tipo                TEXT          NOT NULL
                      CHECK (tipo IN ('servico', 'produto', 'outro')),
  descricao           TEXT          NOT NULL
                      CHECK (length(trim(descricao)) >= 3),
  valor               NUMERIC(10,2) NOT NULL
                      CHECK (valor > 0),

  status              TEXT          NOT NULL DEFAULT 'acordado'
                      CHECK (status IN ('acordado', 'entregue', 'cancelado')),

  data_acordada       DATE          NOT NULL DEFAULT CURRENT_DATE,
  data_entrega        DATE,
  data_cancelamento   DATE,

  observacao          TEXT,
  comprovante_url     TEXT,
  motivo_cancelamento TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by          UUID          REFERENCES auth.users(id),
  updated_by          UUID          REFERENCES auth.users(id),
  deleted_at          TIMESTAMPTZ
);

-- Trigger de updated_at — usa função padrão do projeto (não moddatetime)
CREATE TRIGGER trg_permuta_itens_updated_at
  BEFORE UPDATE ON permuta_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para JOIN ao carregar itens de um pagamento
CREATE INDEX idx_permuta_itens_pagamento
  ON permuta_itens (pagamento_id)
  WHERE deleted_at IS NULL;

-- Índice para filtro por status nos relatórios
CREATE INDEX idx_permuta_itens_empresa_status
  ON permuta_itens (empresa_id, status)
  WHERE deleted_at IS NULL;

-- Índice para dashboard mensal de entregas
CREATE INDEX idx_permuta_itens_empresa_data_entrega
  ON permuta_itens (empresa_id, data_entrega)
  WHERE deleted_at IS NULL AND status = 'entregue';

-- ─── Função SQL helper: status derivado de um pagamento de permuta ────────────
-- Espelho exato da lógica em statusPermutaDerived() em alunoFinanceiro.ts.
-- Usada pelas RPCs da Fase 2 para sincronizar pagamentos.status após cada
-- alteração de item.
-- Invariante: pagamentos.status = calcular_status_permuta(pagamentos.id)
--             para todo pagamento com forma_pagamento = 'permuta'.
CREATE OR REPLACE FUNCTION calcular_status_permuta(p_pagamento_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'acordado') > 0 THEN 'pendente_permuta'
      WHEN COUNT(*) FILTER (WHERE status = 'entregue') > 0 THEN 'pago'
      ELSE 'cancelado'
    END
  FROM permuta_itens
  WHERE pagamento_id = p_pagamento_id
    AND deleted_at IS NULL;
$$;
