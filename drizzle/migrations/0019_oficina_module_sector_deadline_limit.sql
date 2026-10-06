-- 1) Módulos só pelo perfil
CREATE OR REPLACE FUNCTION public.user_modules(_uid uuid) RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT CASE
  WHEN _uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid) THEN ARRAY[]::text[]
  WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'master') THEN ARRAY['agenda','historicos','oficina']
  WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'oficina') THEN ARRAY['oficina']
  ELSE ARRAY['agenda','historicos'] END $$;

-- 2) Oficina vê/edita todos os ativos (temporário)
DROP POLICY IF EXISTS "Workshop reads forwarded" ON public.appointments;
DROP POLICY IF EXISTS "Workshop updates forwarded" ON public.appointments;
CREATE POLICY "Oficina reads active" ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'oficina') AND public.has_module(auth.uid(),'oficina') AND archived_at IS NULL);
CREATE POLICY "Oficina updates active" ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'oficina') AND public.has_module(auth.uid(),'oficina') AND archived_at IS NULL)
  WITH CHECK (public.has_role(auth.uid(),'oficina') AND archived_at IS NULL);
CREATE POLICY "Oficina reads catalog" ON public.catalog_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'oficina'));
CREATE POLICY "Oficina reads log" ON public.edit_log FOR SELECT TO authenticated USING (public.has_module(auth.uid(),'oficina'));
CREATE POLICY "Oficina reads profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'oficina'));
CREATE POLICY "Oficina contacts" ON public.contact_log FOR ALL TO authenticated USING (public.has_role(auth.uid(),'oficina')) WITH CHECK (public.has_role(auth.uid(),'oficina'));

-- 3) Setor do usuário (rótulo) + lista "sector"
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE public.catalog_items DROP CONSTRAINT catalog_items_kind_check;
ALTER TABLE public.catalog_items ADD CONSTRAINT catalog_items_kind_check CHECK (kind = ANY (ARRAY['store','brand','operator','mechanic','sector']));
INSERT INTO public.catalog_items (kind, name, source) VALUES ('sector','Oficina','migração') ON CONFLICT (kind, name_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.catalog_add(_kind text, _name text, _sgloc_id integer DEFAULT NULL::integer, _source text DEFAULT 'manual'::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _clean text := btrim(regexp_replace(coalesce(_name, ''), '\s+', ' ', 'g')); _id uuid; _found record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'atendimento')) THEN
    RAISE EXCEPTION 'Seu perfil não pode adicionar itens às listas';
  END IF;
  IF _kind = 'sector' AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Apenas master adiciona setores'; END IF;
  IF _clean = '' OR length(_clean) > 200 THEN RAISE EXCEPTION 'Informe um nome com até 200 caracteres'; END IF;
  IF _source NOT IN ('manual','importação','SGLOC') THEN RAISE EXCEPTION 'Origem inválida'; END IF;
  IF _kind = 'workshop' THEN
    SELECT id, name INTO _found FROM public.workshops WHERE public.norm_name(name) = public.norm_name(_clean);
    IF FOUND THEN RETURN jsonb_build_object('id', _found.id, 'name', _found.name, 'created', false); END IF;
    INSERT INTO public.workshops (name, active, created_by, source) VALUES (_clean, true, auth.uid(), _source) RETURNING id INTO _id;
  ELSIF _kind IN ('store','brand','operator','mechanic','sector') THEN
    SELECT id, name, sgloc_id INTO _found FROM public.catalog_items WHERE kind = _kind AND name_key = public.norm_name(_clean);
    IF FOUND THEN
      IF _found.sgloc_id IS NULL AND _sgloc_id IS NOT NULL AND _kind IN ('store','operator') THEN
        UPDATE public.catalog_items SET sgloc_id = _sgloc_id, updated_at = now() WHERE id = _found.id;
      END IF;
      RETURN jsonb_build_object('id', _found.id, 'name', _found.name, 'created', false);
    END IF;
    INSERT INTO public.catalog_items (kind, name, sgloc_id, source, created_by)
    VALUES (_kind, _clean, CASE WHEN _kind IN ('store','operator') THEN _sgloc_id END, _source, auth.uid()) RETURNING id INTO _id;
  ELSE RAISE EXCEPTION 'Lista inválida';
  END IF;
  IF _kind = 'store' AND _sgloc_id IS NOT NULL THEN
    INSERT INTO public.sgloc_stores (store_id, code, label) VALUES (_sgloc_id, _clean, _clean) ON CONFLICT (store_id) DO NOTHING;
  END IF;
  INSERT INTO public.catalog_log (actor_id, kind, item_name, action, detail)
  VALUES (auth.uid(), _kind, _clean, 'add', 'origem: ' || _source || CASE WHEN _sgloc_id IS NOT NULL THEN ' · ID SGLOC ' || _sgloc_id ELSE '' END);
  RETURN jsonb_build_object('id', _id, 'name', _clean, 'created', true);
END $function$;

CREATE OR REPLACE FUNCTION public.catalog_update(_kind text, _id uuid, _name text, _sgloc_id integer, _active boolean)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _clean text := btrim(regexp_replace(coalesce(_name, ''), '\s+', ' ', 'g')); _old text; _old_sgloc integer; _old_active boolean; _n integer := 0; _detail text := '';
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Apenas master gerencia as listas'; END IF;
  IF _clean = '' OR length(_clean) > 200 THEN RAISE EXCEPTION 'Informe um nome com até 200 caracteres'; END IF;
  IF _kind = 'workshop' THEN
    SELECT name, NULL, active INTO _old, _old_sgloc, _old_active FROM public.workshops WHERE id = _id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
    IF EXISTS (SELECT 1 FROM public.workshops WHERE id <> _id AND public.norm_name(name) = public.norm_name(_clean)) THEN RAISE EXCEPTION 'Já existe um item com este nome'; END IF;
    UPDATE public.workshops SET name = _clean, active = _active WHERE id = _id;
  ELSIF _kind IN ('store','brand','operator','mechanic','sector') THEN
    SELECT name, sgloc_id, active INTO _old, _old_sgloc, _old_active FROM public.catalog_items WHERE id = _id AND kind = _kind;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
    IF EXISTS (SELECT 1 FROM public.catalog_items WHERE kind = _kind AND id <> _id AND name_key = public.norm_name(_clean)) THEN RAISE EXCEPTION 'Já existe um item com este nome'; END IF;
    UPDATE public.catalog_items SET name = _clean, active = _active, updated_at = now(),
      sgloc_id = CASE WHEN _kind IN ('store','operator') THEN _sgloc_id ELSE NULL END WHERE id = _id;
    IF _kind = 'store' AND _sgloc_id IS NOT NULL THEN
      INSERT INTO public.sgloc_stores (store_id, code, label) VALUES (_sgloc_id, _clean, _clean) ON CONFLICT (store_id) DO UPDATE SET code = EXCLUDED.code, label = EXCLUDED.label;
    END IF;
  ELSE RAISE EXCEPTION 'Lista inválida';
  END IF;
  IF _clean IS DISTINCT FROM _old THEN
    IF _kind = 'sector' THEN
      UPDATE public.profiles SET sector = _clean WHERE public.norm_name(sector) = public.norm_name(_old) AND sector IS DISTINCT FROM _clean;
      GET DIAGNOSTICS _n = ROW_COUNT;
      _detail := 'renomeado de "' || _old || '" · ' || _n || ' usuário(s) atualizado(s)';
    ELSE
    PERFORM set_config('app.catalog_rename', '1', true);
    IF _kind = 'store' THEN UPDATE public.appointments SET store = _clean WHERE public.norm_name(store) = public.norm_name(_old) AND store IS DISTINCT FROM _clean;
    ELSIF _kind = 'brand' THEN UPDATE public.appointments SET brand = _clean WHERE public.norm_name(brand) = public.norm_name(_old) AND brand IS DISTINCT FROM _clean;
    ELSIF _kind = 'operator' THEN UPDATE public.appointments SET operator = _clean WHERE public.norm_name(operator) = public.norm_name(_old) AND operator IS DISTINCT FROM _clean;
    ELSIF _kind = 'workshop' THEN UPDATE public.appointments SET workshop = _clean WHERE public.norm_name(workshop) = public.norm_name(_old) AND workshop IS DISTINCT FROM _clean;
    ELSE UPDATE public.appointments SET custom_fields = jsonb_set(custom_fields, '{mecanico_responsavel}', to_jsonb(_clean))
      WHERE public.norm_name(custom_fields->>'mecanico_responsavel') = public.norm_name(_old) AND custom_fields->>'mecanico_responsavel' IS DISTINCT FROM _clean;
    END IF;
    GET DIAGNOSTICS _n = ROW_COUNT;
    PERFORM set_config('app.catalog_rename', '', true);
    _detail := 'renomeado de "' || _old || '" · ' || _n || ' agendamento(s) atualizado(s)';
    END IF;
  END IF;
  IF _active IS DISTINCT FROM _old_active THEN _detail := concat_ws(' · ', nullif(_detail, ''), CASE WHEN _active THEN 'reativado' ELSE 'desativado' END); END IF;
  IF _sgloc_id IS DISTINCT FROM _old_sgloc AND _kind IN ('store','operator') THEN _detail := concat_ws(' · ', nullif(_detail, ''), 'ID SGLOC: ' || coalesce(_sgloc_id::text, 'sem vínculo')); END IF;
  IF _detail <> '' THEN
    INSERT INTO public.catalog_log (actor_id, kind, item_name, action, detail) VALUES (auth.uid(), _kind, _clean, 'update', _detail);
  END IF;
  RETURN _n;
END $function$;

-- 4) Limite = alterações da Previsão de Entrega (atendimento/oficina)
ALTER TABLE public.edit_limit_defaults DROP CONSTRAINT edit_limit_defaults_role_check;
ALTER TABLE public.edit_limit_defaults ADD CONSTRAINT edit_limit_defaults_role_check CHECK (role = ANY (ARRAY['atendimento'::app_role, 'oficina'::app_role])) NOT VALID;

CREATE OR REPLACE FUNCTION public.set_edit_limit_default(_role app_role, _max integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _old integer; _label text := CASE _role WHEN 'atendimento' THEN 'Atendimento' ELSE 'Oficina' END;
BEGIN
  IF NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Apenas master pode alterar limites'; END IF;
  IF _role NOT IN ('atendimento','oficina') THEN RAISE EXCEPTION 'Perfil inválido para limite'; END IF;
  IF _max IS NULL OR _max < 1 OR _max > 20 THEN RAISE EXCEPTION 'O limite deve ficar entre 1 e 20'; END IF;
  SELECT max_edits INTO _old FROM public.edit_limit_defaults WHERE role = _role;
  IF _old IS NOT DISTINCT FROM _max THEN RETURN; END IF;
  INSERT INTO public.edit_limit_defaults (role, max_edits, updated_at, updated_by) VALUES (_role, _max, now(), auth.uid())
  ON CONFLICT (role) DO UPDATE SET max_edits = EXCLUDED.max_edits, updated_at = now(), updated_by = auth.uid();
  INSERT INTO public.user_admin_log (actor_id, target_id, target_label, action, detail)
  VALUES (auth.uid(), NULL, 'Perfil ' || _label, 'Limite da Previsão de Entrega alterado', _label || ': ' || COALESCE(_old::text,'1') || ' → ' || _max);
END $function$;

CREATE OR REPLACE FUNCTION public.set_edit_limit_override(_user_id uuid, _max integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _old integer; _label text;
BEGIN
  IF NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Apenas master pode alterar limites'; END IF;
  IF _max IS NOT NULL AND (_max < 1 OR _max > 20) THEN RAISE EXCEPTION 'O limite deve ficar entre 1 e 20'; END IF;
  IF _max IS NOT NULL AND NOT (public.has_role(_user_id,'atendimento') OR public.has_role(_user_id,'oficina')) THEN RAISE EXCEPTION 'Limite individual só para Atendimento ou Oficina'; END IF;
  SELECT max_edits INTO _old FROM public.edit_limit_overrides WHERE user_id = _user_id;
  SELECT COALESCE(NULLIF(p.full_name,''), u.email::text, 'usuário') INTO _label FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = _user_id;
  IF _label IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF _max IS NULL THEN
    IF _old IS NULL THEN RETURN; END IF;
    DELETE FROM public.edit_limit_overrides WHERE user_id = _user_id;
    INSERT INTO public.user_admin_log (actor_id, target_id, target_label, action, detail)
    VALUES (auth.uid(), _user_id, _label, 'Limite da Previsão de Entrega alterado', 'Individual de ' || _label || ' removido (era ' || _old || ')');
  ELSE
    IF _old IS NOT DISTINCT FROM _max THEN RETURN; END IF;
    INSERT INTO public.edit_limit_overrides (user_id, max_edits, updated_at, updated_by) VALUES (_user_id, _max, now(), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET max_edits = EXCLUDED.max_edits, updated_at = now(), updated_by = auth.uid();
    INSERT INTO public.user_admin_log (actor_id, target_id, target_label, action, detail)
    VALUES (auth.uid(), _user_id, _label, 'Limite da Previsão de Entrega alterado', 'Individual de ' || _label || ': ' || _max);
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_appointment_edit_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _role app_role; _business_changed boolean; _deadline_changed boolean; _limit integer;
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
   IF current_setting('app.catalog_rename', true) = '1' AND _role = 'master'
       AND (to_jsonb(NEW) - ARRAY['store','brand','operator','workshop','custom_fields']) = (to_jsonb(OLD) - ARRAY['store','brand','operator','workshop','custom_fields']) THEN RETURN NEW; END IF;
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
   IF NEW.deadline_changes_allowed < OLD.deadline_changes_allowed THEN NEW.deadline_changes_allowed := OLD.deadline_changes_allowed; END IF;
   RETURN NEW;
 END IF;
 NEW.priority_urgent := OLD.priority_urgent;
 NEW.deadline_changes_allowed := OLD.deadline_changes_allowed;
 _deadline_changed := NEW.current_deadline IS DISTINCT FROM OLD.current_deadline OR NEW.original_deadline IS DISTINCT FROM OLD.original_deadline;
 IF _deadline_changed THEN
   -- limite efetivo = limite do usuário (individual ou do perfil) + extras liberadas neste agendamento
   _limit := public.edit_limit_for(auth.uid()) + GREATEST(OLD.deadline_changes_allowed - 1, 0);
   IF OLD.deadline_changes_used >= _limit THEN
     RAISE EXCEPTION 'Já houve % da previsão. Peça autorização ao gerente ou master.', CASE WHEN OLD.deadline_changes_used = 1 THEN '1 alteração' ELSE OLD.deadline_changes_used || ' alterações' END;
   END IF;
   NEW.deadline_changes_used := OLD.deadline_changes_used + 1;
 END IF;
 RETURN NEW;
END $function$;

COMMENT ON COLUMN public.appointments.creator_edits_used IS 'DEPRECATED: limite por agendamento substituído por deadline_changes_*';
COMMENT ON COLUMN public.appointments.creator_edits_allowed IS 'DEPRECATED: limite por agendamento substituído por deadline_changes_*';
COMMENT ON COLUMN public.appointments.manager_edit_used IS 'DEPRECATED';
COMMENT ON COLUMN public.appointments.manager_edits_used IS 'DEPRECATED';