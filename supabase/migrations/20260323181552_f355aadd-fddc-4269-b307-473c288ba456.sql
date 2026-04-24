ALTER TABLE public.participantes_eventos 
ADD COLUMN conta_bancaria_id uuid REFERENCES public.contas_bancarias(id);