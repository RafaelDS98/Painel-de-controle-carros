CREATE OR REPLACE FUNCTION public.enforce_appointment_edit_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role app_role;
  _business_changed boolean;
BEGIN
  -- Backend maintenance (no signed-in user) is not restricted
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  IF _role IS NULL THEN
    RAISE EXCEPTION 'Seu perfil não tem permissão para alterar agendamentos';
  END IF;

  IF _role = 'master' THEN RETURN NEW; END IF;

  _business_changed := (
    ROW(NEW.status, NEW.date, NEW.time, NEW.plate, NEW.store, NEW.model, NEW.contact, NEW.workshop,
        NEW.issue, NEW.note, NEW.operator, NEW.external_order, NEW.original_deadline, NEW.current_deadline,
        NEW.priority_urgent, NEW.rework_of, NEW.rework_reason, NEW.sgloc_reference, NEW.registered_at,
        NEW.sheet_id, NEW.created_by, NEW.creator_edits_used, NEW.manager_edit_used)
    IS DISTINCT FROM
    ROW(OLD.status, OLD.date, OLD.time, OLD.plate, OLD.store, OLD.model, OLD.contact, OLD.workshop,
        OLD.issue, OLD.note, OLD.operator, OLD.external_order, OLD.original_deadline, OLD.current_deadline,
        OLD.priority_urgent, OLD.rework_of, OLD.rework_reason, OLD.sgloc_reference, OLD.registered_at,
        OLD.sheet_id, OLD.created_by, OLD.creator_edits_used, OLD.manager_edit_used)
  );

  IF _role = 'gerente' THEN
    IF NOT _business_changed AND NEW.creator_edits_allowed = OLD.creator_edits_allowed + 1 THEN
      RETURN NEW;
    END IF;
    IF OLD.manager_edit_used THEN
      RAISE EXCEPTION 'Limite de edição do gerente já foi usado neste agendamento';
    END IF;
    NEW.creator_edits_allowed := OLD.creator_edits_allowed;
    NEW.creator_edits_used := OLD.creator_edits_used;
    NEW.manager_edit_used := true;
    RETURN NEW;
  END IF;

  -- atendimento
  IF OLD.creator_edits_used >= OLD.creator_edits_allowed THEN
    RAISE EXCEPTION 'Limite de edições deste agendamento já foi atingido';
  END IF;
  NEW.creator_edits_allowed := OLD.creator_edits_allowed;
  NEW.manager_edit_used := OLD.manager_edit_used;
  NEW.creator_edits_used := OLD.creator_edits_used + 1;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_appointment_edit_rules() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER appointments_enforce_edit_rules
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_edit_rules();

CREATE OR REPLACE FUNCTION public.log_appointment_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _o jsonb := to_jsonb(OLD);
  _n jsonb := to_jsonb(NEW);
  _col text;
BEGIN
  FOREACH _col IN ARRAY ARRAY['status','date','time','plate','store','model','contact','workshop','issue','note',
    'operator','external_order','original_deadline','current_deadline','priority_urgent','rework_of',
    'rework_reason','sgloc_reference'] LOOP
    IF _o -> _col IS DISTINCT FROM _n -> _col THEN
      INSERT INTO public.edit_log (appointment_id, changed_by, changed_at, field_changed, old_value, new_value)
      VALUES (NEW.id, auth.uid(), now(), _col, _o ->> _col, _n ->> _col);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_appointment_changes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER appointments_log_changes
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.log_appointment_changes();

-- UPDATE stays open to any approved user; the trigger decides.
DROP POLICY IF EXISTS "Approved users full access" ON public.appointments;
CREATE POLICY "Approved users read" ON public.appointments FOR SELECT TO authenticated USING (has_access(auth.uid()));
CREATE POLICY "Approved users insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (has_access(auth.uid()));
CREATE POLICY "Approved users attempt update" ON public.appointments FOR UPDATE TO authenticated USING (has_access(auth.uid())) WITH CHECK (has_access(auth.uid()));
CREATE POLICY "Masters delete" ON public.appointments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'));

-- Log is written only by the trigger; users can read it.
DROP POLICY IF EXISTS "Approved users full access" ON public.edit_log;
CREATE POLICY "Approved users read log" ON public.edit_log FOR SELECT TO authenticated USING (has_access(auth.uid()));