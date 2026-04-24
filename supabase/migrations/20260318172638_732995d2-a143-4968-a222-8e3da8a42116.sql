
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS comunidade boolean NOT NULL DEFAULT false;

ALTER TABLE public.participantes_eventos ADD COLUMN IF NOT EXISTS tipo_participante text DEFAULT NULL;
ALTER TABLE public.participantes_eventos ADD COLUMN IF NOT EXISTS convidado_por text DEFAULT NULL;
