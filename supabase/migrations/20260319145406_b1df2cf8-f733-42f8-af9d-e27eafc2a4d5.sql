
-- Add comprovante_url column to participantes_eventos
ALTER TABLE public.participantes_eventos ADD COLUMN comprovante_url text DEFAULT NULL;

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes_eventos', 'comprovantes_eventos', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated can upload comprovantes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprovantes_eventos');

-- Allow authenticated users to view files
CREATE POLICY "Authenticated can view comprovantes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comprovantes_eventos');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated can delete comprovantes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'comprovantes_eventos');
