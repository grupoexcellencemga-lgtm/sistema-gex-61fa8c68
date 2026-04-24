INSERT INTO storage.buckets (id, name, public) VALUES ('mindmap_videos', 'mindmap_videos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read mindmap_videos" ON storage.objects FOR SELECT USING (bucket_id = 'mindmap_videos');
CREATE POLICY "Allow auth upload mindmap_videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mindmap_videos');
CREATE POLICY "Allow auth delete mindmap_videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'mindmap_videos');