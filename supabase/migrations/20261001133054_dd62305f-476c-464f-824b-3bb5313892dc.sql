CREATE TABLE public.status_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), label text NOT NULL UNIQUE, color_token text NOT NULL CHECK (color_token IN ('status-blue','status-amber','status-orange','status-green','status-purple','status-gray')), sort_order int NOT NULL DEFAULT 0, is_completion boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_options TO authenticated;
GRANT ALL ON public.status_options TO service_role;
ALTER TABLE public.status_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read statuses" ON public.status_options FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Masters create statuses" ON public.status_options FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'));
CREATE POLICY "Masters update statuses" ON public.status_options FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'));
CREATE POLICY "Masters remove statuses" ON public.status_options FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'));
CREATE UNIQUE INDEX status_only_one_completion ON public.status_options (is_completion) WHERE is_completion;

CREATE TABLE public.custom_field_definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), field_key text NOT NULL UNIQUE CHECK (field_key ~ '^[a-z][a-z0-9_]*$'), label text NOT NULL, field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','textarea','date','select')), select_options jsonb CHECK (select_options IS NULL OR (jsonb_typeof(select_options) = 'array' AND field_type = 'select')), storage text NOT NULL CHECK (storage IN ('column','custom')), visible boolean NOT NULL DEFAULT true, required boolean NOT NULL DEFAULT false, sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT known_column_field CHECK (storage <> 'column' OR field_key IN ('store','model','contact','workshop','issue','note','operator','external_order','current_deadline'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_field_definitions TO authenticated;
GRANT ALL ON public.custom_field_definitions TO service_role;
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read fields" ON public.custom_field_definitions FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Masters create fields" ON public.custom_field_definitions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'));
CREATE POLICY "Masters update fields" ON public.custom_field_definitions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'));
CREATE POLICY "Masters remove fields" ON public.custom_field_definitions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'));
ALTER TABLE public.appointments ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(custom_fields) = 'object');

CREATE OR REPLACE FUNCTION public.touch_config_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public.touch_config_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER status_touch_updated BEFORE UPDATE ON public.status_options FOR EACH ROW EXECUTE FUNCTION public.touch_config_updated_at();
CREATE TRIGGER fields_touch_updated BEFORE UPDATE ON public.custom_field_definitions FOR EACH ROW EXECUTE FUNCTION public.touch_config_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_status_option() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
   IF OLD.is_completion THEN RAISE EXCEPTION 'Marque outra situação como conclusão antes de remover esta'; END IF;
   IF EXISTS (SELECT 1 FROM public.appointments WHERE status = OLD.label) THEN RAISE EXCEPTION 'Existem agendamentos usando esta situação; troque a situação deles antes de remover'; END IF;
   RETURN OLD;
 END IF;
 IF TG_OP = 'UPDATE' AND OLD.is_completion AND NOT NEW.is_completion AND NOT EXISTS (SELECT 1 FROM public.status_options WHERE is_completion AND id <> OLD.id) THEN
   RAISE EXCEPTION 'Marque outra situação como conclusão antes de desmarcar esta';
 END IF;
 IF NEW.is_completion THEN
   PERFORM pg_advisory_xact_lock(728143, 1);
   UPDATE public.status_options SET is_completion = false WHERE is_completion AND id <> NEW.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_status_option() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_status_before_save BEFORE INSERT OR UPDATE ON public.status_options FOR EACH ROW EXECUTE FUNCTION public.enforce_status_option();
CREATE TRIGGER enforce_status_before_delete BEFORE DELETE ON public.status_options FOR EACH ROW EXECUTE FUNCTION public.enforce_status_option();

CREATE OR REPLACE FUNCTION public.protect_system_field() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
   IF OLD.storage = 'column' THEN RAISE EXCEPTION 'Campos originais do sistema não podem ser removidos, apenas ocultados'; END IF;
   RETURN OLD;
 END IF;
 IF OLD.storage <> NEW.storage OR OLD.field_key <> NEW.field_key THEN RAISE EXCEPTION 'Chave e armazenamento do campo não podem ser alterados'; END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.protect_system_field() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER fields_protect_before_delete BEFORE DELETE ON public.custom_field_definitions FOR EACH ROW EXECUTE FUNCTION public.protect_system_field();
CREATE TRIGGER fields_protect_before_update BEFORE UPDATE ON public.custom_field_definitions FOR EACH ROW EXECUTE FUNCTION public.protect_system_field();

INSERT INTO public.status_options (label,color_token,sort_order,is_completion) VALUES
 ('Recebido','status-blue',1,false),('Em execução','status-amber',2,false),('Peça','status-orange',3,false),('Finalizado','status-green',4,true);
INSERT INTO public.custom_field_definitions (field_key,label,field_type,storage,sort_order) VALUES
 ('store','Loja','text','column',10),('model','Modelo','text','column',20),('contact','Contato','text','column',30),('workshop','Local/Oficina','text','column',40),('issue','Problema Relatado','textarea','column',60),('note','Observação','textarea','column',70),('operator','Operador','text','column',80),('external_order','O.S Externa','text','column',90),('current_deadline','Previsão de Entrega','date','column',100),('mecanico_responsavel','Mecânico Responsável','text','custom',50);
UPDATE public.appointments SET custom_fields = jsonb_set(custom_fields, '{mecanico_responsavel}', to_jsonb(note)) WHERE note <> '' AND custom_fields ->> 'mecanico_responsavel' IS NULL;

CREATE OR REPLACE FUNCTION public.log_appointment_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o jsonb := to_jsonb(OLD); _n jsonb := to_jsonb(NEW); _col text; _key text;
BEGIN
 FOREACH _col IN ARRAY ARRAY['status','date','time','plate','store','model','contact','workshop','issue','note','operator','external_order','original_deadline','current_deadline','priority_urgent','rework_of','rework_reason','sgloc_reference'] LOOP
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
END $$;
REVOKE EXECUTE ON FUNCTION public.log_appointment_changes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_appointment_edit_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role app_role; _business_changed boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
 IF _role IS NULL THEN RAISE EXCEPTION 'Seu perfil não tem permissão para alterar agendamentos'; END IF;
 IF _role = 'master' THEN RETURN NEW; END IF;
 _business_changed := ROW(NEW.status,NEW.date,NEW.time,NEW.plate,NEW.store,NEW.model,NEW.contact,NEW.workshop,NEW.issue,NEW.note,NEW.operator,NEW.external_order,NEW.original_deadline,NEW.current_deadline,NEW.priority_urgent,NEW.rework_of,NEW.rework_reason,NEW.sgloc_reference,NEW.registered_at,NEW.sheet_id,NEW.created_by,NEW.creator_edits_used,NEW.manager_edit_used,NEW.custom_fields) IS DISTINCT FROM ROW(OLD.status,OLD.date,OLD.time,OLD.plate,OLD.store,OLD.model,OLD.contact,OLD.workshop,OLD.issue,OLD.note,OLD.operator,OLD.external_order,OLD.original_deadline,OLD.current_deadline,OLD.priority_urgent,OLD.rework_of,OLD.rework_reason,OLD.sgloc_reference,OLD.registered_at,OLD.sheet_id,OLD.created_by,OLD.creator_edits_used,OLD.manager_edit_used,OLD.custom_fields);
 IF _role = 'gerente' THEN
  IF NOT _business_changed AND NEW.creator_edits_allowed = OLD.creator_edits_allowed + 1 THEN RETURN NEW; END IF;
  IF OLD.manager_edit_used THEN RAISE EXCEPTION 'Limite de edição do gerente já foi usado neste agendamento'; END IF;
  NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.creator_edits_used := OLD.creator_edits_used; NEW.manager_edit_used := true; RETURN NEW;
 END IF;
 IF OLD.creator_edits_used >= OLD.creator_edits_allowed THEN RAISE EXCEPTION 'Limite de edições deste agendamento já foi atingido'; END IF;
 NEW.creator_edits_allowed := OLD.creator_edits_allowed; NEW.manager_edit_used := OLD.manager_edit_used; NEW.creator_edits_used := OLD.creator_edits_used + 1; RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_appointment_edit_rules() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rename_status_appointments() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF OLD.label IS DISTINCT FROM NEW.label THEN UPDATE public.appointments SET status = NEW.label WHERE status = OLD.label; END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.rename_status_appointments() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rename_status_after_update AFTER UPDATE OF label ON public.status_options FOR EACH ROW EXECUTE FUNCTION public.rename_status_appointments();