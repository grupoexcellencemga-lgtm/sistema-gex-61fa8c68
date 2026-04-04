
-- Tabela centralizada de taxas do sistema
CREATE TABLE public.taxas_sistema (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL, -- 'maquininha', 'link', 'imposto'
  nome text NOT NULL,
  percentual numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.taxas_sistema ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ver
CREATE POLICY "Authenticated can view taxas_sistema"
  ON public.taxas_sistema FOR SELECT
  TO authenticated
  USING (true);

-- Apenas admin pode gerenciar
CREATE POLICY "Admin can insert taxas_sistema"
  ON public.taxas_sistema FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update taxas_sistema"
  ON public.taxas_sistema FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete taxas_sistema"
  ON public.taxas_sistema FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_taxas_sistema_updated_at
  BEFORE UPDATE ON public.taxas_sistema
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ DADOS INICIAIS ═══

-- Taxas Maquininha
INSERT INTO public.taxas_sistema (tipo, nome, percentual, ordem) VALUES
  ('maquininha', 'Débito', 0.75, 1),
  ('maquininha', 'Crédito 1x', 2.69, 2),
  ('maquininha', 'Crédito 2x', 3.94, 3),
  ('maquininha', 'Crédito 3x', 4.46, 4),
  ('maquininha', 'Crédito 4x', 4.98, 5),
  ('maquininha', 'Crédito 5x', 5.49, 6),
  ('maquininha', 'Crédito 6x', 5.99, 7),
  ('maquininha', 'Crédito 7x', 6.51, 8),
  ('maquininha', 'Crédito 8x', 6.99, 9),
  ('maquininha', 'Crédito 9x', 7.51, 10),
  ('maquininha', 'Crédito 10x', 7.99, 11),
  ('maquininha', 'Crédito 11x', 8.49, 12),
  ('maquininha', 'Crédito 12x', 8.99, 13);

-- Taxas Link (também usada para Boleto)
INSERT INTO public.taxas_sistema (tipo, nome, percentual, ordem) VALUES
  ('link', '1x', 4.20, 1),
  ('link', '2x', 6.09, 2),
  ('link', '3x', 7.01, 3),
  ('link', '4x', 7.91, 4),
  ('link', '5x', 8.80, 5),
  ('link', '6x', 9.67, 6),
  ('link', '7x', 12.59, 7),
  ('link', '8x', 13.42, 8),
  ('link', '9x', 14.25, 9),
  ('link', '10x', 15.06, 10),
  ('link', '11x', 15.87, 11),
  ('link', '12x', 16.66, 12);

-- Imposto padrão sobre entradas
INSERT INTO public.taxas_sistema (tipo, nome, percentual, ordem) VALUES
  ('imposto', 'Imposto padrão sobre entradas', 9.5, 1);
