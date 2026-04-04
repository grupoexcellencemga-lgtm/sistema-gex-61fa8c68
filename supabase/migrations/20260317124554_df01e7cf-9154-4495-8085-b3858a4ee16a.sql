
-- Add proposta_url column to processos_empresariais
ALTER TABLE public.processos_empresariais ADD COLUMN proposta_url text;

-- Create storage bucket for proposals
INSERT INTO storage.buckets (id, name, public) VALUES ('propostas', 'propostas', true);

-- RLS policies for the propostas bucket
CREATE POLICY "Authenticated can upload propostas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'propostas');

CREATE POLICY "Authenticated can view propostas"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'propostas');

CREATE POLICY "Authenticated can delete propostas"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'propostas');

CREATE POLICY "Authenticated can update propostas"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'propostas');
