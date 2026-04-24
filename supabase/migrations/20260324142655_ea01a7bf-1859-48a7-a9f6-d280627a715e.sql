
-- Add comprovante_url column to reembolsos
ALTER TABLE public.reembolsos ADD COLUMN IF NOT EXISTS comprovante_url text;

-- Create storage bucket for reembolso receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes_reembolsos', 'comprovantes_reembolsos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated can upload comprovantes_reembolsos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'comprovantes_reembolsos');
CREATE POLICY "Authenticated can update comprovantes_reembolsos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'comprovantes_reembolsos');
CREATE POLICY "Authenticated can delete comprovantes_reembolsos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'comprovantes_reembolsos');
CREATE POLICY "Public can view comprovantes_reembolsos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'comprovantes_reembolsos');
