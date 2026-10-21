CREATE OR REPLACE FUNCTION public.has_os_read(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_access(_uid) OR public.has_permission(_uid, 'module.os')
$$;
GRANT EXECUTE ON FUNCTION public.has_os_read(uuid) TO authenticated;

DO $do$
DECLARE fn text; def text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['search_ordens_servico','os_get_detail','os_config_list'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fn LIMIT 1;
    IF def IS NOT NULL THEN
      EXECUTE replace(def, 'public.has_access(auth.uid())', 'public.has_os_read(auth.uid())');
    END IF;
  END LOOP;
END $do$;

DROP POLICY IF EXISTS "Approved users read OS" ON public.ordens_servico;
CREATE POLICY "Approved users read OS" ON public.ordens_servico FOR SELECT TO authenticated USING (public.has_os_read(auth.uid()));
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['os_itens','os_status','os_tipos','os_edit_log','os_anexos','os_observacoes_cliente','os_pagamentos','os_compras','os_cotacoes','os_autorizadores'] LOOP
    EXECUTE (SELECT format('ALTER POLICY %I ON public.%I USING (%s)', policyname, t,
        replace(qual, 'has_access(auth.uid())', 'has_os_read(auth.uid())'))
      FROM pg_policies WHERE tablename=t AND cmd='SELECT' AND qual LIKE '%has_access%' LIMIT 1);
  END LOOP;
END $do$;

DROP POLICY IF EXISTS news_read ON public.news_posts;
CREATE POLICY news_read ON public.news_posts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid())
  AND (published OR public.has_permission(auth.uid(), 'action.news_edit') OR created_by = auth.uid()));

CREATE OR REPLACE FUNCTION public.permission_default(_uid uuid, _perm text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT CASE
  WHEN NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid) THEN false
  WHEN public.has_role(_uid,'master') THEN true
  WHEN _perm = 'module.agenda' THEN NOT public.has_role(_uid,'oficina')
  WHEN _perm = 'module.historicos' THEN NOT public.has_role(_uid,'oficina')
  WHEN _perm = 'module.os' THEN true
  WHEN _perm = 'module.oficina' THEN public.has_role(_uid,'oficina')
  WHEN _perm = 'module.veiculos' THEN coalesce((SELECT allowed FROM public.vehicle_screen_access WHERE user_id=_uid), true)
  WHEN _perm IN ('action.forward_workshop','action.create_os') THEN public.has_role(_uid,'gerente') OR public.has_role(_uid,'atendimento')
  WHEN _perm = 'action.manage_vehicles' THEN public.has_role(_uid,'gerente')
  WHEN _perm IN ('module.noticias','action.news_create','action.news_edit','action.news_delete','action.home_layout') THEN public.has_role(_uid,'gerente')
  ELSE false END
$$;

ALTER TABLE public.status_options ADD COLUMN IF NOT EXISTS yard_column text NOT NULL DEFAULT 'main';
ALTER TABLE public.yard_settings ADD COLUMN IF NOT EXISTS board_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;