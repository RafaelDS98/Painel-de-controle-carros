CREATE OR REPLACE FUNCTION public.permission_default(_uid uuid, _perm text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  WHEN _perm IN ('module.vistorias','action.inspection_create') THEN true
  WHEN _perm IN ('action.inspection_cancel','action.inspection_config') THEN public.has_role(_uid,'gerente')
  ELSE false END
$function$;

CREATE OR REPLACE FUNCTION public.get_my_permissions()
 RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
SELECT coalesce(array_agg(p), ARRAY[]::text[]) FROM unnest(ARRAY['module.agenda','module.oficina','module.historicos','module.os','module.veiculos','module.noticias','action.forward_workshop','action.create_os','action.manage_vehicles','action.news_create','action.news_edit','action.news_delete','action.home_layout','module.vistorias','action.inspection_create','action.inspection_cancel','action.inspection_config']) p WHERE public.has_permission(auth.uid(), p) $function$;