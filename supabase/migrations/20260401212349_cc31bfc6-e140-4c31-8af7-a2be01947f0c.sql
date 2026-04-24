
ALTER TABLE public.eventos ADD COLUMN produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL;
ALTER TABLE public.eventos ADD COLUMN turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL;
