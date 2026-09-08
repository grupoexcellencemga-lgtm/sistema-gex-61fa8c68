-- Campos para qualificação de leads pelo agente IA
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS empresa_nome text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cargo text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS perfil_lead text CHECK (perfil_lead IN ('pf', 'pj'));

-- Permite tarefas criadas pelo bot sem responsável humano definido ainda
ALTER TABLE public.tarefas ALTER COLUMN responsavel_id DROP NOT NULL;
