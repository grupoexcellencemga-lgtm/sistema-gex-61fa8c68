ALTER TABLE public.produtos ADD COLUMN parcelas_cartao integer DEFAULT 12;
ALTER TABLE public.produtos ADD COLUMN valor_parcela numeric DEFAULT 0;