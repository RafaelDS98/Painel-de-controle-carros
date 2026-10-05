CREATE TABLE public.edit_limit_defaults (
  role app_role PRIMARY KEY CHECK (role IN ('atendimento','gerente')),
  max_edits integer NOT NULL CHECK (max_edits BETWEEN 1 AND 20),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edit_limit_defaults TO authenticated;
GRANT ALL ON public.edit_limit_defaults TO service_role;
ALTER TABLE public.edit_limit_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Masters read limit defaults" ON public.edit_limit_defaults FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters insert limit defaults" ON public.edit_limit_defaults FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters update limit defaults" ON public.edit_limit_defaults FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters delete limit defaults" ON public.edit_limit_defaults FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'master'));
INSERT INTO public.edit_limit_defaults (role, max_edits) VALUES ('atendimento',1),('gerente',1) ON CONFLICT DO NOTHING;

CREATE TABLE public.edit_limit_overrides (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  max_edits integer NOT NULL CHECK (max_edits BETWEEN 1 AND 20),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edit_limit_overrides TO authenticated;
GRANT ALL ON public.edit_limit_overrides TO service_role;
ALTER TABLE public.edit_limit_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Masters read limit overrides" ON public.edit_limit_overrides FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters insert limit overrides" ON public.edit_limit_overrides FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters update limit overrides" ON public.edit_limit_overrides FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters delete limit overrides" ON public.edit_limit_overrides FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'master'));

CREATE OR REPLACE FUNCTION public.edit_limit_for(_uid uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    (SELECT max_edits FROM public.edit_limit_overrides WHERE user_id = _uid),
    (SELECT d.max_edits FROM public.user_roles r JOIN public.edit_limit_defaults d ON d.role = r.role WHERE r.user_id = _uid LIMIT 1),
    1)
$$;
REVOKE EXECUTE ON FUNCTION public.edit_limit_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_limit_for(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_edit_limit() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT public.edit_limit_for(auth.uid()) $$;
REVOKE EXECUTE ON FUNCTION public.get_my_edit_limit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_edit_limit() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_edit_limit_default(_role app_role, _max integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _old integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Apenas master pode alterar limites'; END IF;
  IF _role NOT IN ('atendimento','gerente') THEN RAISE EXCEPTION 'Perfil inválido para limite'; END IF;
  IF _max IS NULL OR _max < 1 OR _max > 20 THEN RAISE EXCEPTION 'O limite deve ficar entre 1 e 20'; END IF;
  SELECT max_edits INTO _old FROM public.edit_limit_defaults WHERE role = _role;
  IF _old IS NOT DISTINCT FROM _max THEN RETURN; END IF;
  INSERT INTO public.edit_limit_defaults (role, max_edits, updated_at, updated_by) VALUES (_role, _max, now(), auth.uid())
  ON CONFLICT (role) DO UPDATE SET max_edits = EXCLUDED.max_edits, updated_at = now(), updated_by = auth.uid();
  INSERT INTO public.user_admin_log (actor_id, target_id, target_label, action, detail)
  VALUES (auth.uid(), NULL, CASE _role WHEN 'atendimento' THEN 'Perfil Atendimento' ELSE 'Perfil Gerente' END, 'Limite de edições alterado',
    CASE _role WHEN 'atendimento' THEN 'Atendimento' ELSE 'Gerente' END || ': ' || COALESCE(_old::text,'1') || ' → ' || _max);
END $$;
REVOKE EXECUTE ON FUNCTION public.set_edit_limit_default(app_role, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_edit_limit_default(app_role, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_edit_limit_override(_user_id uuid, _max integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _old integer; _label text;
BEGIN
  IF NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Apenas master pode alterar limites'; END IF;
  IF _max IS NOT NULL AND (_max < 1 OR _max > 20) THEN RAISE EXCEPTION 'O limite deve ficar entre 1 e 20'; END IF;
  SELECT max_edits INTO _old FROM public.edit_limit_overrides WHERE user_id = _user_id;
  SELECT COALESCE(NULLIF(p.full_name,''), u.email::text, 'usuário') INTO _label FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = _user_id;
  IF _label IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF _max IS NULL THEN
    IF _old IS NULL THEN RETURN; END IF;
    DELETE FROM public.edit_limit_overrides WHERE user_id = _user_id;
    INSERT INTO public.user_admin_log (actor_id, target_id, target_label, action, detail)
    VALUES (auth.uid(), _user_id, _label, 'Limite de edições alterado', 'Individual de ' || _label || ' removido (era ' || _old || ')');
  ELSE
    IF _old IS NOT DISTINCT FROM _max THEN RETURN; END IF;
    INSERT INTO public.edit_limit_overrides (user_id, max_edits, updated_at, updated_by) VALUES (_user_id, _max, now(), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET max_edits = EXCLUDED.max_edits, updated_at = now(), updated_by = auth.uid();
    INSERT INTO public.user_admin_log (actor_id, target_id, target_label, action, detail)
    VALUES (auth.uid(), _user_id, _label, 'Limite de edições alterado', 'Individual de ' || _label || ': ' || _max);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_edit_limit_override(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_edit_limit_override(uuid, integer) TO authenticated;

ALTER TABLE public.appointments ADD COLUMN manager_edits_used integer NOT NULL DEFAULT 0;
UPDATE public.appointments SET manager_edits_used = 1 WHERE manager_edit_used = true;

CREATE OR REPLACE FUNCTION public.enforce_appointment_edit_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _role app_role; _business_changed boolean; _limit integer;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid();
 IF _role IS NULL THEN RAISE EXCEPTION 'Seu perfil não tem permissão para alterar agendamentos'; END IF;
 _business_changed := ROW(NEW.status,NEW.date,NEW.time,NEW.plate,NEW.store,NEW.model,NEW.contact,NEW.workshop,NEW.issue,NEW.note,NEW.operator,NEW.external_order,NEW.original_deadline,NEW.current_deadline,NEW.priority_urgent,NEW.rework_of,NEW.rework_reason,NEW.sgloc_reference,NEW.registered_at,NEW.sheet_id,NEW.created_by,NEW.creator_edits_used,NEW.manager_edit_used,NEW.custom_fields,NEW.store_id,NEW.brand,NEW.contact_number,NEW.operator_id,NEW.schedule_type,NEW.os_number,NEW.supplier_id,NEW.km_scheduled,NEW.client_id)
  IS DISTINCT FROM ROW(OLD.status,OLD.date,OLD.time,OLD.plate,OLD.store,OLD.model,OLD.contact,OLD.workshop,OLD.issue,OLD.note,OLD.operator,OLD.external_order,OLD.original_deadline,OLD.current_deadline,OLD.priority_urgent,OLD.rework_of,OLD.rework_reason,OLD.sgloc_reference,OLD.registered_at,OLD.sheet_id,OLD.created_by,OLD.creator_edits_used,OLD.manager_edit_used,OLD.custom_fields,OLD.store_id,OLD.brand,OLD.contact_number,OLD.operator_id,OLD.schedule_type,OLD.os_number,OLD.supplier_id,OLD.km_scheduled,OLD.client_id);
 IF (NEW.archived_at IS DISTINCT FROM OLD.archived_at OR NEW.archived_by IS DISTINCT FROM OLD.archived_by) AND _role <> 'master' THEN
   RAISE EXCEPTION 'Apenas master pode excluir ou restaurar agendamentos';
 END IF;
 IF OLD.archived_at IS NOT NULL THEN
   IF NEW.archived_at IS NOT NULL OR _business_changed OR NEW.creator_edits_allowed IS DISTINCT FROM OLD.creator_edits_allowed THEN
     RAISE EXCEPTION 'Agendamento está na Lixeira; restaure antes de editar';
   END IF;
   NEW.archived_by := NULL; RETURN NEW;
 END IF;
 IF NEW.archived_at IS NOT NULL THEN
   IF _business_changed THEN RAISE EXCEPTION 'Exclua sem alterar outros campos ao mesmo tempo'; END IF;
   NEW.archived_at := now(); NEW.archived_by := auth.uid(); RETURN NEW;
 END IF;
 IF _role = 'master' THEN RETURN NEW; END IF;
 NEW.sgloc_reference := OLD.sgloc_reference; NEW.sgloc_sync_state := OLD.sgloc_sync_state; NEW.sgloc_synced_at := OLD.sgloc_synced_at;
 NEW.sgloc_last_error := OLD.sgloc_last_error; NEW.sgloc_missing_count := OLD.sgloc_missing_count;
 NEW.sgloc_performed := OLD.sgloc_performed; NEW.sgloc_confirmed := OLD.sgloc_confirmed;
 NEW.manager_edits_used := OLD.manager_edits_used;
 IF _role = 'atendimento' THEN NEW.priority_urgent := OLD.priority_urgent; END IF;
 _business_changed := ROW(NEW.status,NEW.date,NEW.time,NEW.plate,NEW.store,NEW.model,NEW.contact,NEW.workshop,NEW.issue,NEW.note,NEW.operator,NEW.external_order,NEW.original_deadline,NEW.current_deadline,NEW.priority_urgent,NEW.rework_of,NEW.rework_reason,NEW.sgloc_reference,NEW.registered_at,NEW.sheet_id,NEW.created_by,NEW.creator_edits_used,NEW.manager_edit_used,NEW.custom_fields,NEW.store_id,NEW.brand,NEW.contact_number,NEW.operator_id,NEW.schedule_type,NEW.os_number,NEW.supplier_id,NEW.km_scheduled,NEW.client_id)
  IS DISTINCT FROM ROW(OLD.status,OLD.date,OLD.time,OLD.plate,OLD.store,OLD.model,OLD.contact,OLD.workshop,OLD.issue,OLD.note,OLD.operator,OLD.external_order,OLD.original_deadline,OLD.current_deadline,OLD.priority_urgent,OLD.rework_of,OLD.rework_reason,OLD.sgloc_reference,OLD.registered_at,OLD.sheet_id,OLD.created_by,OLD.creator_edits_used,OLD.manager_edit_used,OLD.custom_fields,OLD.store_id,OLD.brand,OLD.contact_number,OLD.operator_id,OLD.schedule_type,OLD.os_number,OLD.supplier_id,OLD.km_scheduled,OLD.client_id);
 _limit := public.edit_limit_for(auth.uid());
 IF _role = 'gerente' THEN
  IF NOT _business_changed AND NEW.creator_edits_allowed = OLD.creator_edits_allowed + 1 THEN NEW.manager_edit_used := OLD.manager_edit_used; RETURN NEW; END IF;
  IF OLD.manager_edits_used >= _limit THEN RAISE EXCEPTION 'Limite de % edição(ões) do gerente já foi usado neste agendamento', _limit; END IF;
  NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.creator_edits_used := OLD.creator_edits_used;
  NEW.manager_edits_used := OLD.manager_edits_used + 1; NEW.manager_edit_used := true; RETURN NEW;
 END IF;
 IF NOT _business_changed THEN
  NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.manager_edit_used := OLD.manager_edit_used; NEW.creator_edits_used := OLD.creator_edits_used; NEW.priority_urgent := OLD.priority_urgent; RETURN NEW;
 END IF;
 IF OLD.creator_edits_used >= _limit + (OLD.creator_edits_allowed - 1) THEN
   RAISE EXCEPTION 'Limite de % edição(ões) do atendimento já foi atingido neste agendamento', _limit + (OLD.creator_edits_allowed - 1);
 END IF;
 NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.manager_edit_used := OLD.manager_edit_used; NEW.creator_edits_used := OLD.creator_edits_used + 1; NEW.priority_urgent := OLD.priority_urgent; RETURN NEW;
END $function$;