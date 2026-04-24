
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS taxa_cartao numeric DEFAULT 0;
ALTER TABLE public.pagamentos_processo ADD COLUMN IF NOT EXISTS taxa_cartao numeric DEFAULT 0;
ALTER TABLE public.pagamentos_processo_empresarial ADD COLUMN IF NOT EXISTS taxa_cartao numeric DEFAULT 0;
