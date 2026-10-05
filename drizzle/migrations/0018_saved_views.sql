CREATE TABLE IF NOT EXISTS public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS saved_views_user_name ON public.saved_views (user_id, lower(btrim(name)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_views TO authenticated;
GRANT ALL ON public.saved_views TO service_role;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own views read" ON public.saved_views FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own views insert" ON public.saved_views FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_access(auth.uid()));
CREATE POLICY "Own views update" ON public.saved_views FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own views delete" ON public.saved_views FOR DELETE TO authenticated USING (user_id = auth.uid());
