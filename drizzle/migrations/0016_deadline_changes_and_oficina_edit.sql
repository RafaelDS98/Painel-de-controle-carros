ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deadline_changes_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deadline_changes_allowed integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.enforce_appointment_edit_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _role app_role; _business_changed boolean; _deadline_changed boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid();
 IF _role IS NULL THEN RAISE EXCEPTION 'Seu perfil não tem permissão para alterar agendamentos'; END IF;
 _business_changed := (to_jsonb(NEW) - ARRAY['archived_at','archived_by','updated_at','creator_edits_allowed','creator_edits_used','manager_edit_used','manager_edits_used','sgloc_sync_state','sgloc_synced_at','sgloc_last_error','sgloc_missing_count','sgloc_performed','sgloc_confirmed','forwarded_at','forwarded_by','deadline_changes_used','deadline_changes_allowed'])
  IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['archived_at','archived_by','updated_at','creator_edits_allowed','creator_edits_used','manager_edit_used','manager_edits_used','sgloc_sync_state','sgloc_synced_at','sgloc_last_error','sgloc_missing_count','sgloc_performed','sgloc_confirmed','forwarded_at','forwarded_by','deadline_changes_used','deadline_changes_allowed']);
 IF _role = 'oficina' THEN NEW.forwarded_workshop_id := OLD.forwarded_workshop_id; END IF;
 IF NEW.forwarded_workshop_id IS DISTINCT FROM OLD.forwarded_workshop_id THEN
   NEW.forwarded_at := CASE WHEN NEW.forwarded_workshop_id IS NULL THEN NULL ELSE now() END;
   NEW.forwarded_by := CASE WHEN NEW.forwarded_workshop_id IS NULL THEN NULL ELSE auth.uid() END;
 ELSE
   NEW.forwarded_at := OLD.forwarded_at; NEW.forwarded_by := OLD.forwarded_by;
 END IF;
 IF (NEW.archived_at IS DISTINCT FROM OLD.archived_at OR NEW.archived_by IS DISTINCT FROM OLD.archived_by) AND _role <> 'master' THEN
   RAISE EXCEPTION 'Apenas master pode excluir ou restaurar agendamentos';
 END IF;
 IF OLD.archived_at IS NOT NULL THEN
   IF current_setting('app.status_rename', true) = '1' AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
   IF NEW.archived_at IS NOT NULL OR _business_changed THEN
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
 NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.creator_edits_used := OLD.creator_edits_used;
 NEW.manager_edit_used := OLD.manager_edit_used; NEW.manager_edits_used := OLD.manager_edits_used;
 NEW.deadline_changes_used := OLD.deadline_changes_used;
 IF _role = 'gerente' THEN
   -- gerente só pode liberar alterações extras (aumentar), nunca reduzir
   IF NEW.deadline_changes_allowed < OLD.deadline_changes_allowed THEN NEW.deadline_changes_allowed := OLD.deadline_changes_allowed; END IF;
   RETURN NEW;
 END IF;
 -- atendimento e oficina
 NEW.priority_urgent := OLD.priority_urgent;
 NEW.deadline_changes_allowed := OLD.deadline_changes_allowed;
 _deadline_changed := NEW.current_deadline IS DISTINCT FROM OLD.current_deadline OR NEW.original_deadline IS DISTINCT FROM OLD.original_deadline;
 IF _deadline_changed THEN
   IF OLD.deadline_changes_used >= OLD.deadline_changes_allowed THEN
     RAISE EXCEPTION 'Já houve % alteração(ões) da previsão. Peça autorização ao gerente ou master.', OLD.deadline_changes_used;
   END IF;
   NEW.deadline_changes_used := OLD.deadline_changes_used + 1;
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_appointment_insert_priority()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF public.has_role(auth.uid(), 'oficina') THEN
   RAISE EXCEPTION 'O perfil Oficina não pode criar agendamentos';
 END IF;
 IF NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente')) THEN
   NEW.priority_urgent := false;
 END IF;
 NEW.deadline_changes_used := 0;
 IF NOT public.has_role(auth.uid(), 'master') THEN NEW.deadline_changes_allowed := 1; END IF;
 NEW.archived_at := NULL; NEW.archived_by := NULL;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.log_appointment_changes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
 IF NEW.deadline_changes_allowed > OLD.deadline_changes_allowed THEN
  INSERT INTO public.edit_log (appointment_id,changed_by,changed_at,field_changed,old_value,new_value)
  VALUES (NEW.id,auth.uid(),now(),'Liberada nova alteração da previsão',OLD.deadline_changes_allowed::text,NEW.deadline_changes_allowed::text);
 END IF;
 IF OLD.forwarded_workshop_id IS DISTINCT FROM NEW.forwarded_workshop_id THEN
  INSERT INTO public.edit_log (appointment_id,changed_by,changed_at,field_changed,old_value,new_value)
  VALUES (NEW.id,auth.uid(),now(),'forwarded_workshop',(SELECT name FROM public.workshops WHERE id = OLD.forwarded_workshop_id),(SELECT name FROM public.workshops WHERE id = NEW.forwarded_workshop_id));
 END IF;
 FOR _key IN SELECT key FROM jsonb_object_keys(OLD.custom_fields || NEW.custom_fields) AS key LOOP
  IF OLD.custom_fields -> _key IS DISTINCT FROM NEW.custom_fields -> _key THEN
   INSERT INTO public.edit_log (appointment_id,changed_by,changed_at,field_changed,old_value,new_value) VALUES (NEW.id,auth.uid(),now(),_key,OLD.custom_fields ->> _key,NEW.custom_fields ->> _key);
  END IF;
 END LOOP;
 RETURN NEW;
END $function$;

CREATE POLICY "Workshop updates forwarded" ON public.appointments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'oficina') AND public.has_module(auth.uid(), 'oficina') AND archived_at IS NULL AND forwarded_workshop_id IN (SELECT workshop_id FROM public.workshop_users WHERE user_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'oficina') AND archived_at IS NULL AND forwarded_workshop_id IN (SELECT workshop_id FROM public.workshop_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Gerente master insert workshops" ON public.workshops;
DROP POLICY IF EXISTS "Gerente master update workshops" ON public.workshops;
CREATE POLICY "Master insert workshops" ON public.workshops FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master update workshops" ON public.workshops FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));