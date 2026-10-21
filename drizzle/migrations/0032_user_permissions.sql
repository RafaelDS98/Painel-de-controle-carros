CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id uuid NOT NULL,
  permission text NOT NULL,
  allowed boolean NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY up_read ON public.user_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'master'));
CREATE POLICY up_write ON public.user_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master') AND user_id <> auth.uid()) WITH CHECK (public.has_role(auth.uid(),'master') AND user_id <> auth.uid());

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
  ELSE false END $$;

CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _perm text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT CASE
  WHEN _uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid) THEN false
  WHEN public.has_role(_uid,'master') THEN true
  ELSE coalesce((SELECT allowed FROM public.user_permissions WHERE user_id=_uid AND permission=_perm), public.permission_default(_uid,_perm)) END $$;

CREATE OR REPLACE FUNCTION public.get_my_permissions() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT coalesce(array_agg(p), ARRAY[]::text[]) FROM unnest(ARRAY['module.agenda','module.oficina','module.historicos','module.os','module.veiculos','action.forward_workshop','action.create_os','action.manage_vehicles']) p WHERE public.has_permission(auth.uid(), p) $$;

CREATE OR REPLACE FUNCTION public.can_view_vehicles(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid) AND (public.has_role(_uid,'master') OR coalesce((SELECT allowed FROM public.user_permissions WHERE user_id=_uid AND permission='module.veiculos'), (SELECT allowed FROM public.vehicle_screen_access WHERE user_id=_uid), true)) $$;

CREATE OR REPLACE FUNCTION public.user_modules(_uid uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT coalesce(array_agg(m ORDER BY o), ARRAY[]::text[]) FROM unnest(ARRAY['agenda','historicos','oficina','os','veiculos']) WITH ORDINALITY AS t(m,o)
WHERE public.has_permission(_uid, 'module.'||m) $$;

DROP POLICY IF EXISTS vehicle_insert ON public.vehicles;
DROP POLICY IF EXISTS vehicle_update ON public.vehicles;
CREATE POLICY vehicle_insert ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.can_view_vehicles(auth.uid()) AND public.has_permission(auth.uid(),'action.manage_vehicles'));
CREATE POLICY vehicle_update ON public.vehicles FOR UPDATE TO authenticated USING (public.can_view_vehicles(auth.uid()) AND public.has_permission(auth.uid(),'action.manage_vehicles')) WITH CHECK (public.can_view_vehicles(auth.uid()) AND public.has_permission(auth.uid(),'action.manage_vehicles'));

DO $do$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.os_create'::regproc);
  d := replace(d, $x$NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'atendimento'))$x$, $x$NOT public.has_permission(auth.uid(), 'action.create_os') AND NOT public.has_permission(auth.uid(), 'action.forward_workshop')$x$);
  EXECUTE d;
END $do$;

CREATE OR REPLACE FUNCTION public.os_forward_appointment(_appointment_id uuid, _workshop_id uuid, _km integer, _store_id integer, _tipo_id integer, _centro_custo_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE a public.appointments; w public.workshops; o public.ordens_servico; r jsonb; BEGIN
IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(),'action.forward_workshop') THEN RAISE EXCEPTION 'Você não tem permissão para encaminhar veículos'; END IF;
SELECT * INTO a FROM public.appointments WHERE id=_appointment_id AND archived_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado ou arquivado'; END IF;
SELECT * INTO w FROM public.workshops WHERE id=_workshop_id AND active; IF NOT FOUND THEN RAISE EXCEPTION 'Escolha uma oficina ativa'; END IF;
IF public.norm_plate(a.plate)='' OR _km IS NULL OR _km<0 OR NOT EXISTS(SELECT 1 FROM public.sgloc_stores WHERE store_id=_store_id) OR NOT EXISTS(SELECT 1 FROM public.os_tipos WHERE id=_tipo_id AND active) OR NOT EXISTS(SELECT 1 FROM public.centros_custo WHERE id=_centro_custo_id AND active) THEN RAISE EXCEPTION 'Preencha placa, KM, loja, tipo e centro de custo válidos'; END IF;
SELECT * INTO o FROM public.ordens_servico WHERE appointment_id=a.id AND archived_at IS NULL AND closed_at IS NULL AND status_id NOT IN(3,7) ORDER BY created_at DESC LIMIT 1;
IF o.id IS NULL THEN r:=public.os_create(a.plate,_km,_store_id,w.id,_tipo_id,_centro_custo_id,_appointment_id=>a.id,_obs1=>a.issue); SELECT * INTO o FROM public.ordens_servico WHERE id=(r->>'id')::uuid; ELSE UPDATE public.ordens_servico SET workshop_id=w.id WHERE id=o.id; END IF;
UPDATE public.ordens_servico SET vehicle_id=(SELECT id FROM public.vehicles WHERE public.norm_plate(plate)=public.norm_plate(a.plate) LIMIT 1) WHERE id=o.id AND vehicle_id IS NULL;
UPDATE public.appointments SET workshop=w.name,forwarded_workshop_id=w.id,os_number=o.numero WHERE id=a.id;
PERFORM public.record_workshop_movement(a.id,w.id,o.id);
RETURN jsonb_build_object('id',o.id,'numero',o.numero,'workshop',w.name); END $function$;
REVOKE EXECUTE ON FUNCTION public.os_forward_appointment(uuid,uuid,integer,integer,integer,uuid) FROM anon;