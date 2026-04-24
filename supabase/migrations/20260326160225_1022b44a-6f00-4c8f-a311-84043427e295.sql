
INSERT INTO storage.buckets (id, name, public) VALUES ('mindmap_images', 'mindmap_images', true);

CREATE POLICY "Authenticated can upload mindmap images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mindmap_images');

CREATE POLICY "Authenticated can delete mindmap images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'mindmap_images');

CREATE POLICY "Anyone can view mindmap images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'mindmap_images');
