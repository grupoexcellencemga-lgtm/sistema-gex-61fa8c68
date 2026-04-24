
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS cpf text UNIQUE,
  ADD COLUMN IF NOT EXISTS tipo_vinculo text NOT NULL DEFAULT 'autonomo',
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS chave_pix_tipo text,
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta text,
  ADD COLUMN IF NOT EXISTS data_entrada date;
