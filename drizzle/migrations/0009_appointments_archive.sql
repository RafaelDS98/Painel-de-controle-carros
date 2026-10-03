ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid;
COMMENT ON COLUMN public.appointments.archived_at IS 'Excluir na tela = arquivar (lixeira). Só master arquiva/restaura; nunca DELETE físico pela aplicação.';

DROP POLICY IF EXISTS "Approved users read" ON public.appointments;
CREATE POLICY "Approved users read" ON public.appointments FOR SELECT TO authenticated
  USING (public.has_access(auth.uid()) AND (archived_at IS NULL OR public.has_role(auth.uid(), 'master')));

CREATE OR REPLACE FUNCTION public.existing_sgloc_references(_refs text[])
RETURNS SETOF text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_access(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY SELECT DISTINCT a.sgloc_reference FROM public.appointments a WHERE a.sgloc_reference = ANY(_refs);
END $$;
REVOKE ALL ON FUNCTION public.existing_sgloc_references(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.existing_sgloc_references(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_appointment_insert_priority()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente')) THEN
   NEW.priority_urgent := false;
 END IF;
 NEW.archived_at := NULL; NEW.archived_by := NULL;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_appointment_edit_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _role app_role; _business_changed boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid();
 IF _role IS NULL THEN RAISE EXCEPTION 'Seu perfil não tem permissão para alterar agendamentos'; END IF;
 _business_changed := ROW(NEW.status,NEW.date,NEW.time,NEW.plate,NEW.store,NEW.model,NEW.contact,NEW.workshop,NEW.issue,NEW.note,NEW.operator,NEW.external_order,NEW.original_deadline,NEW.current_deadline,NEW.priority_urgent,NEW.rework_of,NEW.rework_reason,NEW.sgloc_reference,NEW.registered_at,NEW.sheet_id,NEW.created_by,NEW.creator_edits_used,NEW.manager_edit_used,NEW.custom_fields,NEW.store_id,NEW.brand,NEW.contact_number,NEW.operator_id,NEW.schedule_type,NEW.os_number,NEW.supplier_id,NEW.km_scheduled,NEW.client_id)
  IS DISTINCT FROM ROW(OLD.status,OLD.date,OLD.time,OLD.plate,OLD.store,OLD.model,OLD.contact,OLD.workshop,OLD.issue,OLD.note,OLD.operator,OLD.external_order,OLD.original_deadline,OLD.current_deadline,OLD.priority_urgent,OLD.rework_of,OLD.rework_reason,OLD.sgloc_reference,OLD.registered_at,OLD.sheet_id,OLD.created_by,OLD.creator_edits_used,OLD.manager_edit_used,OLD.custom_fields,OLD.store_id,OLD.brand,OLD.contact_number,OLD.operator_id,OLD.schedule_type,OLD.os_number,OLD.supplier_id,OLD.km_scheduled,OLD.client_id);
 -- Arquivamento (lixeira): só master arquiva/restaura; arquivado não é editável
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
 IF _role = 'atendimento' THEN NEW.priority_urgent := OLD.priority_urgent; END IF;
 _business_changed := ROW(NEW.status,NEW.date,NEW.time,NEW.plate,NEW.store,NEW.model,NEW.contact,NEW.workshop,NEW.issue,NEW.note,NEW.operator,NEW.external_order,NEW.original_deadline,NEW.current_deadline,NEW.priority_urgent,NEW.rework_of,NEW.rework_reason,NEW.sgloc_reference,NEW.registered_at,NEW.sheet_id,NEW.created_by,NEW.creator_edits_used,NEW.manager_edit_used,NEW.custom_fields,NEW.store_id,NEW.brand,NEW.contact_number,NEW.operator_id,NEW.schedule_type,NEW.os_number,NEW.supplier_id,NEW.km_scheduled,NEW.client_id)
  IS DISTINCT FROM ROW(OLD.status,OLD.date,OLD.time,OLD.plate,OLD.store,OLD.model,OLD.contact,OLD.workshop,OLD.issue,OLD.note,OLD.operator,OLD.external_order,OLD.original_deadline,OLD.current_deadline,OLD.priority_urgent,OLD.rework_of,OLD.rework_reason,OLD.sgloc_reference,OLD.registered_at,OLD.sheet_id,OLD.created_by,OLD.creator_edits_used,OLD.manager_edit_used,OLD.custom_fields,OLD.store_id,OLD.brand,OLD.contact_number,OLD.operator_id,OLD.schedule_type,OLD.os_number,OLD.supplier_id,OLD.km_scheduled,OLD.client_id);
 IF _role = 'gerente' THEN
  IF NOT _business_changed AND NEW.creator_edits_allowed = OLD.creator_edits_allowed + 1 THEN RETURN NEW; END IF;
  IF OLD.manager_edit_used THEN RAISE EXCEPTION 'Limite de edição do gerente já foi usado neste agendamento'; END IF;
  NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.creator_edits_used := OLD.creator_edits_used; NEW.manager_edit_used := true; RETURN NEW;
 END IF;
 IF NOT _business_changed THEN
  NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.manager_edit_used := OLD.manager_edit_used; NEW.creator_edits_used := OLD.creator_edits_used; NEW.priority_urgent := OLD.priority_urgent; RETURN NEW;
 END IF;
 IF OLD.creator_edits_used >= OLD.creator_edits_allowed THEN RAISE EXCEPTION 'Limite de edições deste agendamento já foi atingido'; END IF;
 NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.manager_edit_used := OLD.manager_edit_used; NEW.creator_edits_used := OLD.creator_edits_used + 1; NEW.priority_urgent := OLD.priority_urgent; RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.log_appointment_changes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _o jsonb := to_jsonb(OLD); _n jsonb := to_jsonb(NEW); _col text; _key text; _summary text;
BEGIN
 IF OLD.archived_at IS DISTINCT FROM NEW.archived_at THEN
  _summary := concat_ws(' • ', 'Placa ' || nullif(NEW.plate,''), 'Data ' || to_char(NEW.date,'DD/MM/YYYY'), 'Loja ' || nullif(NEW.store,''));
  INSERT INTO public.edit_log (appointment_id,changed_by,changed_at,field_changed,old_value,new_value)
  VALUES (NEW.id,auth.uid(),now(),CASE WHEN NEW.archived_at IS NULL THEN 'Restaurado da Lixeira' ELSE 'Excluído (Lixeira)' END,NULL,_summary);
 END IF;
 FOREACH _col IN ARRAY ARRAY['status','date','time','plate','store','model','contact','workshop','issue','note','operator','external_order','original_deadline','current_deadline','priority_urgent','rework_of','rework_reason','sgloc_reference','store_id','brand','contact_number','operator_id','schedule_type','os_number','supplier_id','km_scheduled','client_id','sgloc_performed','sgloc_confirmed'] LOOP
  IF _o -> _col IS DISTINCT FROM _n -> _col THEN
   INSERT INTO public.edit_log (appointment_id,changed_by,changed_at,field_changed,old_value,new_value) VALUES (NEW.id,auth.uid(),now(),_col,_o ->> _col,_n ->> _col);
  END IF;
 END LOOP;
 FOR _key IN SELECT key FROM jsonb_object_keys(OLD.custom_fields || NEW.custom_fields) AS key LOOP
  IF OLD.custom_fields -> _key IS DISTINCT FROM NEW.custom_fields -> _key THEN
   INSERT INTO public.edit_log (appointment_id,changed_by,changed_at,field_changed,old_value,new_value) VALUES (NEW.id,auth.uid(),now(),_key,OLD.custom_fields ->> _key,NEW.custom_fields ->> _key);
  END IF;
 END LOOP;
 RETURN NEW;
END $function$;