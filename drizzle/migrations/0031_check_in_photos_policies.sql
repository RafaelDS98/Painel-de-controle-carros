CREATE POLICY checkin_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'check-in-photos' AND public.has_access(auth.uid()));
CREATE POLICY checkin_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'check-in-photos' AND public.has_access(auth.uid()) AND (storage.foldername(name))[1] = auth.uid()::text);