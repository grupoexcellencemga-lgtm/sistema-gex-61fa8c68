-- Adiciona empresa_id nas tabelas financeiras secundárias que ainda não têm isolamento multi-tenant

-- 1. comissoes
ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
UPDATE comissoes c SET empresa_id = co.empresa_id FROM comerciais co WHERE c.comercial_id = co.id AND c.empresa_id IS NULL;
UPDATE comissoes c SET empresa_id = a.empresa_id FROM alunos a WHERE c.aluno_id = a.id AND c.empresa_id IS NULL;
UPDATE comissoes SET empresa_id = '480e60de-ccd4-4472-bea5-612dbd4661e0' WHERE empresa_id IS NULL;
ALTER TABLE comissoes ALTER COLUMN empresa_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comissoes_empresa_id ON comissoes(empresa_id);

-- 2. movimentacoes_contas
ALTER TABLE movimentacoes_contas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
UPDATE movimentacoes_contas mc SET empresa_id = cb.empresa_id FROM contas_bancarias cb WHERE mc.conta_bancaria_id = cb.id AND mc.empresa_id IS NULL;
UPDATE movimentacoes_contas SET empresa_id = '480e60de-ccd4-4472-bea5-612dbd4661e0' WHERE empresa_id IS NULL;
ALTER TABLE movimentacoes_contas ALTER COLUMN empresa_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimentacoes_contas_empresa_id ON movimentacoes_contas(empresa_id);

-- 3. pagamentos_processo
ALTER TABLE pagamentos_processo ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
UPDATE pagamentos_processo pp SET empresa_id = pi.empresa_id FROM processos_individuais pi WHERE pp.processo_id = pi.id AND pp.empresa_id IS NULL;
UPDATE pagamentos_processo SET empresa_id = '480e60de-ccd4-4472-bea5-612dbd4661e0' WHERE empresa_id IS NULL;
ALTER TABLE pagamentos_processo ALTER COLUMN empresa_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_processo_empresa_id ON pagamentos_processo(empresa_id);

-- 4. pagamentos_processo_empresarial
ALTER TABLE pagamentos_processo_empresarial ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
UPDATE pagamentos_processo_empresarial ppe SET empresa_id = pe.empresa_id FROM processos_empresariais pe WHERE ppe.processo_id = pe.id AND ppe.empresa_id IS NULL;
UPDATE pagamentos_processo_empresarial SET empresa_id = '480e60de-ccd4-4472-bea5-612dbd4661e0' WHERE empresa_id IS NULL;
ALTER TABLE pagamentos_processo_empresarial ALTER COLUMN empresa_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_processo_empresarial_empresa_id ON pagamentos_processo_empresarial(empresa_id);

-- 5. pagamentos_profissional
ALTER TABLE pagamentos_profissional ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
UPDATE pagamentos_profissional pp SET empresa_id = p.empresa_id FROM profissionais p WHERE pp.profissional_id = p.id AND pp.empresa_id IS NULL;
UPDATE pagamentos_profissional SET empresa_id = '480e60de-ccd4-4472-bea5-612dbd4661e0' WHERE empresa_id IS NULL;
ALTER TABLE pagamentos_profissional ALTER COLUMN empresa_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_profissional_empresa_id ON pagamentos_profissional(empresa_id);

-- 6. transferencias_entre_contas
ALTER TABLE transferencias_entre_contas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
UPDATE transferencias_entre_contas tc SET empresa_id = cb.empresa_id FROM contas_bancarias cb WHERE tc.conta_origem_id = cb.id AND tc.empresa_id IS NULL;
UPDATE transferencias_entre_contas SET empresa_id = '480e60de-ccd4-4472-bea5-612dbd4661e0' WHERE empresa_id IS NULL;
ALTER TABLE transferencias_entre_contas ALTER COLUMN empresa_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transferencias_entre_contas_empresa_id ON transferencias_entre_contas(empresa_id);
