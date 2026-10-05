CREATE OR REPLACE FUNCTION public.rename_status_appointments()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF OLD.label IS DISTINCT FROM NEW.label THEN
   PERFORM set_config('app.status_rename', '1', true);
   UPDATE public.appointments SET status = NEW.label WHERE status = OLD.label;
   PERFORM set_config('app.status_rename', '', true);
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_status_option()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _total integer; _archived integer;
BEGIN
 IF TG_OP = 'DELETE' THEN
   IF OLD.is_completion THEN RAISE EXCEPTION 'Marque outra situação como conclusão antes de remover esta'; END IF;
   SELECT count(*), count(*) FILTER (WHERE archived_at IS NOT NULL) INTO _total, _archived FROM public.appointments WHERE status = OLD.label;
   IF _total > 0 THEN
     RAISE EXCEPTION '% agendamento(s) usam esta situação (% na Lixeira); restaure ou troque a situação deles antes de remover.', _total, _archived;
   END IF;
   RETURN OLD;
 END IF;
 IF TG_OP = 'UPDATE' AND OLD.is_completion AND NOT NEW.is_completion AND pg_trigger_depth() = 1 THEN
   RAISE EXCEPTION 'Marque outra situação como conclusão antes de desmarcar esta';
 END IF;
 IF NEW.is_completion AND (TG_OP = 'INSERT' OR NOT OLD.is_completion) THEN
   PERFORM pg_advisory_xact_lock(728143, 1);
   UPDATE public.status_options SET is_completion = false WHERE is_completion AND id <> NEW.id;
 END IF;
 RETURN NEW;
END $function$;

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
   IF current_setting('app.status_rename', true) = '1' AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
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