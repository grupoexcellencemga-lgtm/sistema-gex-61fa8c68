-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 / MIG 1 — Preparar pagamentos para suportar permuta
-- Adiciona : gera_caixa, created_by, updated_by
-- Corrige  : pagamentos_status_check (+ pendente_permuta)
-- Cria novo: pagamentos_forma_pagamento_check (não existia no banco)
-- Cria     : 2 índices para relatórios de caixa e lookup de permutas
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Coluna de caixa: permuta = false; todo pagamento existente fica true via DEFAULT
ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS gera_caixa BOOLEAN NOT NULL DEFAULT true;

-- 1b. Auditoria de criação/alteração
ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- 1c. Status CHECK
-- Constraint confirmada no banco: pagamentos_status_check
-- Definição atual: CHECK (status = ANY (ARRAY['pago','pendente','vencido','cancelado']))
-- Acrescenta 'pendente_permuta' preservando todos os valores existentes.
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_status_check;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_status_check
  CHECK (status IN ('pago', 'pendente', 'vencido', 'cancelado', 'pendente_permuta'));

-- 1d. forma_pagamento CHECK
-- Constraint NÃO existia no banco (inline do CREATE TABLE nunca chegou ao prod).
-- DESVIO vs plano: dados reais têm 'link' (51), 'credito' (28), 'probono' (6) além
-- dos valores planejados. Todos incluídos para não violar rows existentes.
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_forma_pagamento_check;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_forma_pagamento_check
  CHECK (forma_pagamento IN ('cartao', 'boleto', 'pix', 'dinheiro', 'permuta', 'link', 'credito', 'probono'));

-- 1e. Índice para filtros de caixa em relatórios financeiros
CREATE INDEX IF NOT EXISTS idx_pagamentos_caixa_status
  ON pagamentos (empresa_id, gera_caixa, status)
  WHERE deleted_at IS NULL;

-- 1f. Índice para lookup de permutas por matrícula
CREATE INDEX IF NOT EXISTS idx_pagamentos_permuta_matricula
  ON pagamentos (matricula_id)
  WHERE deleted_at IS NULL
    AND forma_pagamento = 'permuta';
