
-- Add evento_id column to despesas table
ALTER TABLE public.despesas ADD COLUMN evento_id uuid REFERENCES public.eventos(id) ON DELETE SET NULL DEFAULT NULL;

-- Create index for performance
CREATE INDEX idx_despesas_evento_id ON public.despesas(evento_id);
