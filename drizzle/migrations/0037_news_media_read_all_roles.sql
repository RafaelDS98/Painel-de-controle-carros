DROP POLICY IF EXISTS noticias_read ON storage.objects;
CREATE POLICY noticias_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'noticias' AND (public.has_access(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid())));