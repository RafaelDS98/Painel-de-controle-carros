CREATE TABLE public.news_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kicker text NOT NULL DEFAULT '',
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Geral',
  related text[] NOT NULL DEFAULT ARRAY[]::text[],
  image_path text,
  video_path text,
  video_url text,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_posts TO authenticated;
GRANT ALL ON public.news_posts TO service_role;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.home_layout (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  widgets jsonb NOT NULL DEFAULT '["destaques","noticias","resumo","atalhos"]'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.home_layout TO authenticated;
GRANT ALL ON public.home_layout TO service_role;
ALTER TABLE public.home_layout ENABLE ROW LEVEL SECURITY;
INSERT INTO public.home_layout(id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.permission_default(_uid uuid, _perm text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT CASE
  WHEN NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid) THEN false
  WHEN public.has_role(_uid,'master') THEN true
  WHEN _perm = 'module.agenda' THEN NOT public.has_role(_uid,'oficina')
  WHEN _perm = 'module.historicos' THEN NOT public.has_role(_uid,'oficina')
  WHEN _perm = 'module.os' THEN NOT public.has_role(_uid,'oficina')
  WHEN _perm = 'module.oficina' THEN public.has_role(_uid,'oficina')
  WHEN _perm = 'module.veiculos' THEN coalesce((SELECT allowed FROM public.vehicle_screen_access WHERE user_id=_uid), true)
  WHEN _perm IN ('action.forward_workshop','action.create_os') THEN public.has_role(_uid,'gerente') OR public.has_role(_uid,'atendimento')
  WHEN _perm = 'action.manage_vehicles' THEN public.has_role(_uid,'gerente')
  WHEN _perm IN ('module.noticias','action.news_create','action.news_edit','action.news_delete','action.home_layout') THEN public.has_role(_uid,'gerente')
  ELSE false END $$;

CREATE OR REPLACE FUNCTION public.get_my_permissions() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT coalesce(array_agg(p), ARRAY[]::text[]) FROM unnest(ARRAY['module.agenda','module.oficina','module.historicos','module.os','module.veiculos','module.noticias','action.forward_workshop','action.create_os','action.manage_vehicles','action.news_create','action.news_edit','action.news_delete','action.home_layout']) p WHERE public.has_permission(auth.uid(), p) $$;

CREATE POLICY news_read ON public.news_posts FOR SELECT TO authenticated
  USING (public.has_access(auth.uid()) AND (published OR public.has_permission(auth.uid(),'action.news_edit') OR created_by = auth.uid()));
CREATE POLICY news_insert ON public.news_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'action.news_create') AND created_by = auth.uid());
CREATE POLICY news_update ON public.news_posts FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'action.news_edit') OR public.has_permission(auth.uid(),'action.home_layout'))
  WITH CHECK (public.has_permission(auth.uid(),'action.news_edit') OR public.has_permission(auth.uid(),'action.home_layout'));
CREATE POLICY news_delete ON public.news_posts FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'action.news_delete'));

CREATE POLICY home_layout_read ON public.home_layout FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY home_layout_write ON public.home_layout FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'action.home_layout')) WITH CHECK (public.has_permission(auth.uid(),'action.home_layout'));

CREATE POLICY noticias_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'noticias' AND public.has_access(auth.uid()));
CREATE POLICY noticias_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'noticias' AND (public.has_permission(auth.uid(),'action.news_create') OR public.has_permission(auth.uid(),'action.news_edit')));
CREATE POLICY noticias_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'noticias' AND public.has_permission(auth.uid(),'action.news_delete'));