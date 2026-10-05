-- Perfil Oficina (valor 'oficina' do enum já adicionado), setores/módulos e encaminhamento para oficina.
-- 1) Oficina nunca entra pelo caminho comum de acesso; só pelas políticas explícitas abaixo.
CREATE OR REPLACE FUNCTION public.has_access(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role <> 'oficina') $$;

-- 2) Setores e módulos
CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  modules text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sectors_name_unique ON public.sectors (lower(btrim(name)));
CREATE TABLE public.user_sectors (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, sector_id)
);
CREATE TABLE public.workshop_users (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, workshop_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors, public.user_sectors, public.workshop_users TO authenticated;
GRANT ALL ON public.sectors, public.user_sectors, public.workshop_users TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Masters manage sectors" ON public.sectors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Masters manage user sectors" ON public.user_sectors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Own user sectors readable" ON public.user_sectors FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Masters manage workshop users" ON public.workshop_users FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY "Own workshop links readable" ON public.workshop_users FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Master vê tudo; os demais veem a união dos módulos dos seus setores; sem setor, vale o padrão do perfil.
CREATE OR REPLACE FUNCTION public.user_modules(_uid uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT CASE
  WHEN _uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid) THEN ARRAY[]::text[]
  WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'master') THEN ARRAY['agenda','historicos','oficina']
  WHEN EXISTS (SELECT 1 FROM public.user_sectors WHERE user_id = _uid)
    THEN COALESCE((SELECT array_agg(DISTINCT m ORDER BY m) FROM public.user_sectors us JOIN public.sectors s ON s.id = us.sector_id, unnest(s.modules) m WHERE us.user_id = _uid), ARRAY[]::text[])
  WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'oficina') THEN ARRAY['oficina']
  ELSE ARRAY['agenda','historicos'] END $$;
REVOKE EXECUTE ON FUNCTION public.user_modules(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_modules(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.has_module(_uid uuid, _module text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT _module = ANY(public.user_modules(_uid)) $$;
REVOKE EXECUTE ON FUNCTION public.has_module(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module(uuid, text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.get_my_modules() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT public.user_modules(auth.uid()) $$;
REVOKE EXECUTE ON FUNCTION public.get_my_modules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_modules() TO authenticated;

-- Trilha de auditoria das mudanças de setor/vínculo
CREATE OR REPLACE FUNCTION public.log_access_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _row jsonb := to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END); _label text;
BEGIN
  _label := CASE TG_TABLE_NAME WHEN 'sectors' THEN 'Setor ' || COALESCE(_row ->> 'name','')
    WHEN 'user_sectors' THEN 'Setor de usuário' ELSE 'Vínculo de oficina' END;
  INSERT INTO public.user_admin_log (actor_id, target_id, target_label, action, detail)
  VALUES (auth.uid(), NULLIF(_row ->> 'user_id','')::uuid, _label,
    CASE TG_OP WHEN 'INSERT' THEN 'Criado' WHEN 'DELETE' THEN 'Removido' ELSE 'Alterado' END || ' (' || TG_TABLE_NAME || ')',
    CASE WHEN TG_TABLE_NAME = 'sectors' THEN 'Módulos: ' || COALESCE((SELECT string_agg(m, ', ') FROM jsonb_array_elements_text(_row -> 'modules') m), 'nenhum')
      ELSE COALESCE((SELECT s.name FROM public.sectors s WHERE s.id = NULLIF(_row ->> 'sector_id','')::uuid), (SELECT w.name FROM public.workshops w WHERE w.id = NULLIF(_row ->> 'workshop_id','')::uuid), '') END);
  RETURN NULL;
END $$;
CREATE TRIGGER log_sectors AFTER INSERT OR UPDATE OR DELETE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.log_access_admin();
CREATE TRIGGER log_user_sectors AFTER INSERT OR DELETE ON public.user_sectors FOR EACH ROW EXECUTE FUNCTION public.log_access_admin();
CREATE TRIGGER log_workshop_users AFTER INSERT OR DELETE ON public.workshop_users FOR EACH ROW EXECUTE FUNCTION public.log_access_admin();

-- 3) Encaminhamento para oficina
ALTER TABLE public.appointments
  ADD COLUMN forwarded_workshop_id uuid REFERENCES public.workshops(id) ON DELETE SET NULL,
  ADD COLUMN forwarded_at timestamptz,
  ADD COLUMN forwarded_by uuid;
CREATE INDEX appointments_forwarded_workshop_idx ON public.appointments (forwarded_workshop_id) WHERE forwarded_workshop_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_appointment_edit_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _role app_role; _business_changed boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid();
 IF _role IS NULL THEN RAISE EXCEPTION 'Seu perfil não tem permissão para alterar agendamentos'; END IF;
 IF _role = 'oficina' THEN RAISE EXCEPTION 'O perfil Oficina só consulta os veículos encaminhados'; END IF;
 _business_changed := (to_jsonb(NEW) - ARRAY['archived_at','archived_by','updated_at','creator_edits_allowed','creator_edits_used','manager_edit_used','manager_edits_used','sgloc_sync_state','sgloc_synced_at','sgloc_last_error','sgloc_missing_count','sgloc_performed','sgloc_confirmed','forwarded_at','forwarded_by'])
  IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['archived_at','archived_by','updated_at','creator_edits_allowed','creator_edits_used','manager_edit_used','manager_edits_used','sgloc_sync_state','sgloc_synced_at','sgloc_last_error','sgloc_missing_count','sgloc_performed','sgloc_confirmed','forwarded_at','forwarded_by']);
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
 IF _role = 'atendimento' THEN
   NEW.priority_urgent := OLD.priority_urgent;
   IF NEW.current_deadline IS DISTINCT FROM OLD.current_deadline OR NEW.original_deadline IS DISTINCT FROM OLD.original_deadline THEN
     RAISE EXCEPTION 'Apenas gerente ou master pode alterar a Previsão de Entrega';
   END IF;
 END IF;
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

-- 4) Políticas: módulos no banco e acesso restrito da oficina
DROP POLICY "Approved users read" ON public.appointments;
DROP POLICY "Approved users insert" ON public.appointments;
DROP POLICY "Approved users attempt update" ON public.appointments;
CREATE POLICY "Module users read" ON public.appointments FOR SELECT TO authenticated USING (
  public.has_access(auth.uid()) AND (public.has_module(auth.uid(),'agenda') OR public.has_module(auth.uid(),'historicos'))
  AND (archived_at IS NULL OR public.has_role(auth.uid(),'master')));
CREATE POLICY "Workshop reads forwarded" ON public.appointments FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'oficina') AND public.has_module(auth.uid(),'oficina') AND archived_at IS NULL AND forwarded_workshop_id IS NOT NULL
  AND forwarded_workshop_id IN (SELECT workshop_id FROM public.workshop_users WHERE user_id = auth.uid()));
CREATE POLICY "Agenda users insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.has_access(auth.uid()) AND public.has_module(auth.uid(),'agenda'));
CREATE POLICY "Agenda users attempt update" ON public.appointments FOR UPDATE TO authenticated USING (public.has_access(auth.uid()) AND public.has_module(auth.uid(),'agenda')) WITH CHECK (public.has_access(auth.uid()) AND public.has_module(auth.uid(),'agenda'));
DROP POLICY "Approved users read log" ON public.edit_log;
CREATE POLICY "Historicos users read log" ON public.edit_log FOR SELECT TO authenticated USING (public.has_access(auth.uid()) AND public.has_module(auth.uid(),'historicos'));
CREATE POLICY "Workshop reads statuses" ON public.status_options FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'oficina'));
CREATE POLICY "Workshop reads fields" ON public.custom_field_definitions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'oficina'));
