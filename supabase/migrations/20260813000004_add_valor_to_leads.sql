-- Adiciona campo valor (potencial de negócio) nos leads do funil
ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor numeric;
