CREATE OR REPLACE FUNCTION public.enforce_appointment_edit_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _role app_role; _business_changed boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid();
 IF _role IS NULL THEN RAISE EXCEPTION 'Seu perfil não tem permissão para alterar agendamentos'; END IF;
 IF _role = 'master' THEN RETURN NEW; END IF;
 -- Atendimento nunca altera urgência: descarta a mudança antes de checar limite de edições
 IF _role = 'atendimento' THEN NEW.priority_urgent := OLD.priority_urgent; END IF;
 _business_changed := ROW(NEW.status,NEW.date,NEW.time,NEW.plate,NEW.store,NEW.model,NEW.contact,NEW.workshop,NEW.issue,NEW.note,NEW.operator,NEW.external_order,NEW.original_deadline,NEW.current_deadline,NEW.priority_urgent,NEW.rework_of,NEW.rework_reason,NEW.sgloc_reference,NEW.registered_at,NEW.sheet_id,NEW.created_by,NEW.creator_edits_used,NEW.manager_edit_used,NEW.custom_fields) IS DISTINCT FROM ROW(OLD.status,OLD.date,OLD.time,OLD.plate,OLD.store,OLD.model,OLD.contact,OLD.workshop,OLD.issue,OLD.note,OLD.operator,OLD.external_order,OLD.original_deadline,OLD.current_deadline,OLD.priority_urgent,OLD.rework_of,OLD.rework_reason,OLD.sgloc_reference,OLD.registered_at,OLD.sheet_id,OLD.created_by,OLD.creator_edits_used,OLD.manager_edit_used,OLD.custom_fields);
 IF _role = 'gerente' THEN
  IF NOT _business_changed AND NEW.creator_edits_allowed = OLD.creator_edits_allowed + 1 THEN RETURN NEW; END IF;
  IF OLD.manager_edit_used THEN RAISE EXCEPTION 'Limite de edição do gerente já foi usado neste agendamento'; END IF;
  NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.creator_edits_used := OLD.creator_edits_used; NEW.manager_edit_used := true; RETURN NEW;
 END IF;
 -- Bloco de atendimento
 IF NOT _business_changed THEN
  NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.manager_edit_used := OLD.manager_edit_used; NEW.creator_edits_used := OLD.creator_edits_used; NEW.priority_urgent := OLD.priority_urgent; RETURN NEW;
 END IF;
 IF OLD.creator_edits_used >= OLD.creator_edits_allowed THEN RAISE EXCEPTION 'Limite de edições deste agendamento já foi atingido'; END IF;
 NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.manager_edit_used := OLD.manager_edit_used; NEW.creator_edits_used := OLD.creator_edits_used + 1; NEW.priority_urgent := OLD.priority_urgent; RETURN NEW;
END $function$;