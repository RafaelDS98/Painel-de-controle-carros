ALTER TABLE public.sgloc_settings ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT false;

-- Setor do criador do agendamento (só o rótulo do setor; nada mais do usuário).
CREATE OR REPLACE FUNCTION public.appointment_creator_sectors()
RETURNS TABLE(user_id uuid, sector text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.sector FROM public.profiles p
  WHERE (public.has_access(auth.uid()) OR public.has_role(auth.uid(), 'oficina'))
    AND nullif(btrim(p.sector), '') IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.appointments a WHERE a.created_by = p.id)
$$;
REVOKE ALL ON FUNCTION public.appointment_creator_sectors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appointment_creator_sectors() TO authenticated;

CREATE OR REPLACE FUNCTION public.catalog_add(_kind text, _name text, _sgloc_id integer DEFAULT NULL::integer, _source text DEFAULT 'manual'::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _clean text := btrim(regexp_replace(coalesce(_name, ''), '\s+', ' ', 'g')); _id uuid; _found record;
BEGIN
  IF _source NOT IN ('manual','importação','SGLOC') THEN RAISE EXCEPTION 'Origem inválida'; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF _source = 'manual' AND NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente')) THEN
      RAISE EXCEPTION 'Apenas gerente ou master adicionam itens às listas';
    END IF;
    IF _source <> 'manual' AND NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'atendimento')) THEN
      RAISE EXCEPTION 'Seu perfil não pode adicionar itens às listas';
    END IF;
    IF _kind = 'sector' AND NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente')) THEN RAISE EXCEPTION 'Apenas gerente ou master adicionam setores'; END IF;
  END IF;
  IF _clean = '' OR length(_clean) > 200 THEN RAISE EXCEPTION 'Informe um nome com até 200 caracteres'; END IF;
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

-- catalog_update passa a aceitar gerente (mesma lógica).
DO $$
DECLARE _def text;
BEGIN
  SELECT pg_get_functiondef('public.catalog_update(text,uuid,text,integer,boolean)'::regprocedure) INTO _def;
  _def := replace(_def, 'IF NOT public.has_role(auth.uid(), ''master'') THEN RAISE EXCEPTION ''Apenas master gerencia as listas''; END IF;',
    'IF NOT (public.has_role(auth.uid(), ''master'') OR public.has_role(auth.uid(), ''gerente'')) THEN RAISE EXCEPTION ''Apenas gerente ou master gerenciam as listas''; END IF;');
  IF position('gerente' in _def) = 0 THEN RAISE EXCEPTION 'catalog_update: trava não encontrada'; END IF;
  EXECUTE _def;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_usage(_kind text, _id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _name text; _n integer := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente')) THEN RAISE EXCEPTION 'Apenas gerente ou master gerenciam as listas'; END IF;
  IF _kind = 'workshop' THEN SELECT name INTO _name FROM public.workshops WHERE id = _id;
  ELSE SELECT name INTO _name FROM public.catalog_items WHERE id = _id AND kind = _kind; END IF;
  IF _name IS NULL THEN RETURN 0; END IF;
  IF _kind = 'sector' THEN SELECT count(*) INTO _n FROM public.profiles WHERE public.norm_name(sector) = public.norm_name(_name);
  ELSIF _kind = 'store' THEN SELECT count(*) INTO _n FROM public.appointments WHERE public.norm_name(store) = public.norm_name(_name);
  ELSIF _kind = 'brand' THEN SELECT count(*) INTO _n FROM public.appointments WHERE public.norm_name(brand) = public.norm_name(_name);
  ELSIF _kind = 'operator' THEN SELECT count(*) INTO _n FROM public.appointments WHERE public.norm_name(operator) = public.norm_name(_name);
  ELSIF _kind = 'workshop' THEN SELECT count(*) INTO _n FROM public.appointments WHERE public.norm_name(workshop) = public.norm_name(_name);
  ELSIF _kind = 'mechanic' THEN SELECT count(*) INTO _n FROM public.appointments WHERE public.norm_name(custom_fields->>'mecanico_responsavel') = public.norm_name(_name);
  END IF;
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_delete(_kind text, _id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _name text; _n integer := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente')) THEN RAISE EXCEPTION 'Apenas gerente ou master gerenciam as listas'; END IF;
  _n := public.catalog_usage(_kind, _id);
  IF _kind = 'workshop' THEN
    SELECT name INTO _name FROM public.workshops WHERE id = _id;
    IF _name IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
    IF EXISTS (SELECT 1 FROM public.appointments WHERE forwarded_workshop_id = _id) THEN
      RAISE EXCEPTION 'Este local está ligado a encaminhamentos; desative em vez de excluir';
    END IF;
    DELETE FROM public.workshop_users WHERE workshop_id = _id;
    DELETE FROM public.workshops WHERE id = _id;
  ELSIF _kind IN ('store','brand','operator','mechanic','sector') THEN
    SELECT name INTO _name FROM public.catalog_items WHERE id = _id AND kind = _kind;
    IF _name IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
    IF _kind = 'sector' THEN
      UPDATE public.profiles SET sector = NULL WHERE public.norm_name(sector) = public.norm_name(_name);
    END IF;
    DELETE FROM public.catalog_items WHERE id = _id;
  ELSE RAISE EXCEPTION 'Lista inválida';
  END IF;
  INSERT INTO public.catalog_log (actor_id, kind, item_name, action, detail)
  VALUES (auth.uid(), _kind, _name, 'delete', CASE WHEN _kind = 'sector' THEN _n || ' usuário(s) ficaram sem setor' ELSE _n || ' agendamento(s) mantêm o texto' END);
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.catalog_usage(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.catalog_delete(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_usage(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_delete(text, uuid) TO authenticated;

DROP POLICY IF EXISTS "Master reads catalog log" ON public.catalog_log;
CREATE POLICY "Master and gerente read catalog log" ON public.catalog_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente'));