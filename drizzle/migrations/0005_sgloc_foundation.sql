ALTER TABLE public.appointments
 ADD COLUMN IF NOT EXISTS store_id integer,
 ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS contact_number text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS operator_id integer,
 ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'N',
 ADD COLUMN IF NOT EXISTS os_number integer,
 ADD COLUMN IF NOT EXISTS supplier_id integer,
 ADD COLUMN IF NOT EXISTS km_scheduled integer,
 ADD COLUMN IF NOT EXISTS client_id integer,
 ADD COLUMN IF NOT EXISTS sgloc_performed text,
 ADD COLUMN IF NOT EXISTS sgloc_confirmed text,
 ADD COLUMN IF NOT EXISTS sgloc_sync_state text NOT NULL DEFAULT 'local_only',
 ADD COLUMN IF NOT EXISTS sgloc_synced_at timestamptz,
 ADD COLUMN IF NOT EXISTS sgloc_last_error text,
 ADD COLUMN IF NOT EXISTS sgloc_missing_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.appointments
 ADD CONSTRAINT appointments_km_scheduled_check CHECK (km_scheduled IS NULL OR km_scheduled >= 0),
 ADD CONSTRAINT appointments_sgloc_performed_check CHECK (sgloc_performed IS NULL OR sgloc_performed IN ('S','N')),
 ADD CONSTRAINT appointments_sgloc_sync_state_check CHECK (sgloc_sync_state IN ('local_only','synced','pending_push','push_failed','not_returned'));

ALTER TABLE public.appointments DISABLE TRIGGER appointments_log_changes;
ALTER TABLE public.appointments DISABLE TRIGGER appointments_enforce_edit_rules;
UPDATE public.appointments a SET sgloc_reference = a.sheet_id
 WHERE a.sheet_id ~ '^[0-9]+$' AND coalesce(a.sgloc_reference,'') = ''
 AND (SELECT count(*) FROM public.appointments b WHERE b.sheet_id = a.sheet_id) = 1
 AND NOT EXISTS (SELECT 1 FROM public.appointments c WHERE c.sgloc_reference = a.sheet_id);
ALTER TABLE public.appointments ENABLE TRIGGER appointments_enforce_edit_rules;
ALTER TABLE public.appointments ENABLE TRIGGER appointments_log_changes;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_sgloc_reference_unique ON public.appointments (sgloc_reference) WHERE sgloc_reference IS NOT NULL AND sgloc_reference <> '';

CREATE TABLE public.sgloc_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 enabled boolean NOT NULL DEFAULT false,
 window_days_back integer NOT NULL DEFAULT 7,
 window_days_ahead integer NOT NULL DEFAULT 45,
 interval_minutes integer NOT NULL DEFAULT 5,
 updated_at timestamptz DEFAULT now(),
 updated_by uuid);
GRANT SELECT, INSERT, UPDATE ON public.sgloc_settings TO authenticated;
GRANT ALL ON public.sgloc_settings TO service_role;
ALTER TABLE public.sgloc_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read sgloc settings" ON public.sgloc_settings FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Masters insert sgloc settings" ON public.sgloc_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters update sgloc settings" ON public.sgloc_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
INSERT INTO public.sgloc_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE public.sgloc_sync_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 started_at timestamptz DEFAULT now(),
 finished_at timestamptz,
 status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed')),
 trigger_source text NOT NULL DEFAULT 'schedule' CHECK (trigger_source IN ('schedule','manual')),
 fetched integer NOT NULL DEFAULT 0, inserted integer NOT NULL DEFAULT 0, updated integer NOT NULL DEFAULT 0,
 skipped integer NOT NULL DEFAULT 0, errors integer NOT NULL DEFAULT 0,
 error_detail jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_by uuid);
GRANT SELECT ON public.sgloc_sync_runs TO authenticated;
GRANT ALL ON public.sgloc_sync_runs TO service_role;
ALTER TABLE public.sgloc_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read sync runs" ON public.sgloc_sync_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gerente'));

CREATE TABLE public.sgloc_stores (store_id integer PRIMARY KEY, code text NOT NULL, label text NOT NULL DEFAULT '', updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sgloc_stores TO authenticated;
GRANT ALL ON public.sgloc_stores TO service_role;
ALTER TABLE public.sgloc_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read stores" ON public.sgloc_stores FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Masters insert stores" ON public.sgloc_stores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters update stores" ON public.sgloc_stores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters delete stores" ON public.sgloc_stores FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'master'));

CREATE TABLE public.sgloc_suppliers (supplier_id integer PRIMARY KEY, name text NOT NULL DEFAULT '', updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sgloc_suppliers TO authenticated;
GRANT ALL ON public.sgloc_suppliers TO service_role;
ALTER TABLE public.sgloc_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read suppliers" ON public.sgloc_suppliers FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Masters insert suppliers" ON public.sgloc_suppliers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters update suppliers" ON public.sgloc_suppliers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters delete suppliers" ON public.sgloc_suppliers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'master'));

CREATE TABLE public.sgloc_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 sgloc_email text NOT NULL, sgloc_user_code text, token text NOT NULL,
 token_expires_at timestamptz, updated_at timestamptz DEFAULT now());
REVOKE ALL ON public.sgloc_accounts FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.sgloc_accounts TO service_role;
ALTER TABLE public.sgloc_accounts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_sgloc_status()
RETURNS TABLE(connected boolean, sgloc_email text, token_expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT a.user_id IS NOT NULL, a.sgloc_email, a.token_expires_at
 FROM (SELECT 1) x LEFT JOIN public.sgloc_accounts a ON a.user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_sgloc_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_sgloc_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_appointment_edit_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _role app_role; _business_changed boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid();
 IF _role IS NULL THEN RAISE EXCEPTION 'Seu perfil não tem permissão para alterar agendamentos'; END IF;
 IF _role = 'master' THEN RETURN NEW; END IF;
 -- Campos de controle do SGLOC só mudam por rotina de sistema ou master
 NEW.sgloc_reference := OLD.sgloc_reference; NEW.sgloc_sync_state := OLD.sgloc_sync_state; NEW.sgloc_synced_at := OLD.sgloc_synced_at;
 NEW.sgloc_last_error := OLD.sgloc_last_error; NEW.sgloc_missing_count := OLD.sgloc_missing_count;
 NEW.sgloc_performed := OLD.sgloc_performed; NEW.sgloc_confirmed := OLD.sgloc_confirmed;
 -- Atendimento nunca altera urgência: descarta a mudança antes de checar limite de edições
 IF _role = 'atendimento' THEN NEW.priority_urgent := OLD.priority_urgent; END IF;
 _business_changed := ROW(NEW.status,NEW.date,NEW.time,NEW.plate,NEW.store,NEW.model,NEW.contact,NEW.workshop,NEW.issue,NEW.note,NEW.operator,NEW.external_order,NEW.original_deadline,NEW.current_deadline,NEW.priority_urgent,NEW.rework_of,NEW.rework_reason,NEW.sgloc_reference,NEW.registered_at,NEW.sheet_id,NEW.created_by,NEW.creator_edits_used,NEW.manager_edit_used,NEW.custom_fields,NEW.store_id,NEW.brand,NEW.contact_number,NEW.operator_id,NEW.schedule_type,NEW.os_number,NEW.supplier_id,NEW.km_scheduled,NEW.client_id)
  IS DISTINCT FROM ROW(OLD.status,OLD.date,OLD.time,OLD.plate,OLD.store,OLD.model,OLD.contact,OLD.workshop,OLD.issue,OLD.note,OLD.operator,OLD.external_order,OLD.original_deadline,OLD.current_deadline,OLD.priority_urgent,OLD.rework_of,OLD.rework_reason,OLD.sgloc_reference,OLD.registered_at,OLD.sheet_id,OLD.created_by,OLD.creator_edits_used,OLD.manager_edit_used,OLD.custom_fields,OLD.store_id,OLD.brand,OLD.contact_number,OLD.operator_id,OLD.schedule_type,OLD.os_number,OLD.supplier_id,OLD.km_scheduled,OLD.client_id);
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

CREATE OR REPLACE FUNCTION public.log_appointment_changes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _o jsonb := to_jsonb(OLD); _n jsonb := to_jsonb(NEW); _col text; _key text;
BEGIN
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