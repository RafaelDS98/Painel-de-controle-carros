CREATE OR REPLACE FUNCTION public.norm_name(_v text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public AS $$
  SELECT lower(regexp_replace(btrim(translate(coalesce(_v, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')), '\s+', ' ', 'g'))
$$;

CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('store','brand','operator','mechanic')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  name_key text GENERATED ALWAYS AS (public.norm_name(name)) STORED,
  sgloc_id integer,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','importação','SGLOC','migração')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, name_key)
);
GRANT SELECT ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read catalog" ON public.catalog_items FOR SELECT TO authenticated USING (public.has_access(auth.uid()));

CREATE TABLE public.catalog_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  kind text NOT NULL,
  item_name text NOT NULL,
  action text NOT NULL,
  detail text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.catalog_log TO authenticated;
GRANT ALL ON public.catalog_log TO service_role;
ALTER TABLE public.catalog_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Master reads catalog log" ON public.catalog_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));

ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
CREATE UNIQUE INDEX IF NOT EXISTS workshops_name_key_unique ON public.workshops (public.norm_name(name));

-- Semeia as listas com os valores existentes (grafia mais comum por nome normalizado).
INSERT INTO public.catalog_items (kind, name, source)
SELECT DISTINCT ON (k, public.norm_name(v)) k, btrim(regexp_replace(v, '\s+', ' ', 'g')), 'migração'
FROM (
  SELECT 'store' k, store v, count(*) c FROM public.appointments WHERE btrim(store) <> '' GROUP BY store
  UNION ALL SELECT 'brand', brand, count(*) FROM public.appointments WHERE btrim(brand) <> '' GROUP BY brand
  UNION ALL SELECT 'operator', operator, count(*) FROM public.appointments WHERE btrim(operator) <> '' GROUP BY operator
  UNION ALL SELECT 'mechanic', custom_fields->>'mecanico_responsavel', count(*) FROM public.appointments WHERE btrim(coalesce(custom_fields->>'mecanico_responsavel','')) <> '' GROUP BY 2
  UNION ALL SELECT 'store', code, 0 FROM public.sgloc_stores WHERE btrim(code) <> ''
) s
ORDER BY k, public.norm_name(v), c DESC, v;

UPDATE public.catalog_items ci SET sgloc_id = s.store_id FROM public.sgloc_stores s WHERE ci.kind = 'store' AND ci.name_key = public.norm_name(s.code);
UPDATE public.catalog_items ci SET sgloc_id = x.sid FROM (
  SELECT DISTINCT ON (public.norm_name(store)) public.norm_name(store) k, store_id sid FROM public.appointments WHERE store_id IS NOT NULL GROUP BY store, store_id ORDER BY public.norm_name(store), count(*) DESC
) x WHERE ci.kind = 'store' AND ci.sgloc_id IS NULL AND ci.name_key = x.k;
UPDATE public.catalog_items ci SET sgloc_id = x.sid FROM (
  SELECT DISTINCT ON (public.norm_name(operator)) public.norm_name(operator) k, operator_id sid FROM public.appointments WHERE operator_id IS NOT NULL GROUP BY operator, operator_id ORDER BY public.norm_name(operator), count(*) DESC
) x WHERE ci.kind = 'operator' AND ci.name_key = x.k;

INSERT INTO public.workshops (name, active, source)
SELECT DISTINCT ON (public.norm_name(workshop)) btrim(regexp_replace(workshop, '\s+', ' ', 'g')), true, 'migração'
FROM (SELECT workshop, count(*) c FROM public.appointments WHERE btrim(workshop) <> '' GROUP BY workshop) a
WHERE NOT EXISTS (SELECT 1 FROM public.workshops w WHERE public.norm_name(w.name) = public.norm_name(a.workshop))
ORDER BY public.norm_name(workshop), c DESC, workshop;

-- Adiciona um valor à lista (master, gerente, atendimento; rotina de sistema sem usuário). Já existente = devolve o existente.
CREATE OR REPLACE FUNCTION public.catalog_add(_kind text, _name text, _sgloc_id integer DEFAULT NULL, _source text DEFAULT 'manual')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text := btrim(regexp_replace(coalesce(_name, ''), '\s+', ' ', 'g')); _id uuid; _found record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'atendimento')) THEN
    RAISE EXCEPTION 'Seu perfil não pode adicionar itens às listas';
  END IF;
  IF _clean = '' OR length(_clean) > 200 THEN RAISE EXCEPTION 'Informe um nome com até 200 caracteres'; END IF;
  IF _source NOT IN ('manual','importação','SGLOC') THEN RAISE EXCEPTION 'Origem inválida'; END IF;
  IF _kind = 'workshop' THEN
    SELECT id, name INTO _found FROM public.workshops WHERE public.norm_name(name) = public.norm_name(_clean);
    IF FOUND THEN RETURN jsonb_build_object('id', _found.id, 'name', _found.name, 'created', false); END IF;
    INSERT INTO public.workshops (name, active, created_by, source) VALUES (_clean, true, auth.uid(), _source) RETURNING id INTO _id;
  ELSIF _kind IN ('store','brand','operator','mechanic') THEN
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
END $$;
REVOKE ALL ON FUNCTION public.catalog_add(text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_add(text, text, integer, text) TO authenticated, service_role;

-- Renomear / desativar / vincular ID SGLOC (só master). Renomear atualiza os agendamentos ligados (log pelo trigger de histórico).
CREATE OR REPLACE FUNCTION public.catalog_update(_kind text, _id uuid, _name text, _sgloc_id integer, _active boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text := btrim(regexp_replace(coalesce(_name, ''), '\s+', ' ', 'g')); _old text; _old_sgloc integer; _old_active boolean; _n integer := 0; _detail text := '';
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Apenas master gerencia as listas'; END IF;
  IF _clean = '' OR length(_clean) > 200 THEN RAISE EXCEPTION 'Informe um nome com até 200 caracteres'; END IF;
  IF _kind = 'workshop' THEN
    SELECT name, NULL, active INTO _old, _old_sgloc, _old_active FROM public.workshops WHERE id = _id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
    IF EXISTS (SELECT 1 FROM public.workshops WHERE id <> _id AND public.norm_name(name) = public.norm_name(_clean)) THEN RAISE EXCEPTION 'Já existe um item com este nome'; END IF;
    UPDATE public.workshops SET name = _clean, active = _active WHERE id = _id;
  ELSIF _kind IN ('store','brand','operator','mechanic') THEN
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
  IF _active IS DISTINCT FROM _old_active THEN _detail := concat_ws(' · ', nullif(_detail, ''), CASE WHEN _active THEN 'reativado' ELSE 'desativado' END); END IF;
  IF _sgloc_id IS DISTINCT FROM _old_sgloc AND _kind IN ('store','operator') THEN _detail := concat_ws(' · ', nullif(_detail, ''), 'ID SGLOC: ' || coalesce(_sgloc_id::text, 'sem vínculo')); END IF;
  IF _detail <> '' THEN
    INSERT INTO public.catalog_log (actor_id, kind, item_name, action, detail) VALUES (auth.uid(), _kind, _clean, 'update', _detail);
  END IF;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.catalog_update(text, uuid, text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_update(text, uuid, text, integer, boolean) TO authenticated, service_role;

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
   IF OLD.deadline_changes_used >= OLD.deadline_changes_allowed THEN
     RAISE EXCEPTION 'Já houve % da previsão. Peça autorização ao gerente ou master.', CASE WHEN OLD.deadline_changes_used = 1 THEN '1 alteração' ELSE OLD.deadline_changes_used || ' alterações' END;
   END IF;
   NEW.deadline_changes_used := OLD.deadline_changes_used + 1;
 END IF;
 RETURN NEW;
END $function$;