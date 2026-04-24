
-- Add valor (price) to produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS valor numeric DEFAULT 0;

-- Add contract fields to matriculas
ALTER TABLE public.matriculas ADD COLUMN IF NOT EXISTS valor_total numeric DEFAULT 0;
ALTER TABLE public.matriculas ADD COLUMN IF NOT EXISTS desconto numeric DEFAULT 0;
ALTER TABLE public.matriculas ADD COLUMN IF NOT EXISTS valor_final numeric DEFAULT 0;

-- Add matricula_id to pagamentos to link payments to enrollments
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS matricula_id uuid REFERENCES public.matriculas(id) ON DELETE SET NULL;

-- Add late fee fields to pagamentos
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS multa numeric DEFAULT 0;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS juros numeric DEFAULT 0;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS valor_pago numeric DEFAULT 0;
