ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS close_note text;

ALTER TABLE public.os_status ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;
UPDATE public.os_status SET is_closed = true WHERE id IN (3,7);
INSERT INTO public.os_status (id, code, label, color, allows_finalize, sort_order)
VALUES (8, 'AGUARDANDO_RETIRADA', 'Aguardando retirada', '#8b5cf6', true, 5)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS close_kind text,
  ADD COLUMN IF NOT EXISTS close_reason text,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'agendamento';
ALTER TABLE public.appointments ADD CONSTRAINT appointments_close_kind_chk CHECK (close_kind IS NULL OR close_kind IN ('finalizado','cancelado'));
ALTER TABLE public.appointments ADD CONSTRAINT appointments_origin_chk CHECK (origin IN ('agendamento','atendimento'));
CREATE INDEX IF NOT EXISTS appointments_closed_at_idx ON public.appointments (closed_at);

CREATE OR REPLACE FUNCTION public.os_locked(_os_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ordens_servico WHERE id = _os_id AND status_id IN (3,7))
    AND NOT public.has_permission(auth.uid(), 'action.os_edit_closed')
$$;

CREATE OR REPLACE FUNCTION public.enforce_os_edit_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _role app_role; _allowed_next int[]; _special boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid();
  IF _role IS NULL THEN RAISE EXCEPTION 'Sem permissão para alterar ordens de serviço'; END IF;
  _special := current_setting('app.os_closing', true) = '1' OR current_setting('app.os_reopen', true) = '1';

  IF OLD.status_id IN (3,7) AND NOT _special AND NOT public.has_permission(auth.uid(), 'action.os_edit_closed') THEN
    RAISE EXCEPTION 'O.S. finalizada ou cancelada não pode ser alterada sem permissão do Master';
  END IF;

  IF (NEW.archived_at IS DISTINCT FROM OLD.archived_at) AND _role <> 'master' THEN
    RAISE EXCEPTION 'Apenas master pode arquivar ou restaurar ordens de serviço';
  END IF;

  IF NEW.status_id IS DISTINCT FROM OLD.status_id AND NOT _special THEN
    IF NEW.status_id IN (3,7) THEN
      RAISE EXCEPTION 'Use os botões Finalizar ou Cancelar para encerrar a O.S.';
    END IF;
    SELECT CASE OLD.status_id
      WHEN 2 THEN ARRAY[4]::int[]
      WHEN 4 THEN ARRAY[1]::int[]
      WHEN 1 THEN ARRAY[8,5,6]::int[]
      WHEN 6 THEN ARRAY[2]::int[]
      WHEN 5 THEN ARRAY[1]::int[]
      WHEN 8 THEN ARRAY[1]::int[]
      ELSE ARRAY[]::int[]
    END INTO _allowed_next;
    IF NOT (NEW.status_id = ANY(_allowed_next)) AND _role <> 'master' THEN
      RAISE EXCEPTION 'Transição de status não permitida para este perfil';
    END IF;
  END IF;

  IF NEW.numero IS DISTINCT FROM OLD.numero THEN RAISE EXCEPTION 'Número da OS é imutável'; END IF;
  IF _role = 'oficina' THEN
    NEW.store_id := OLD.store_id; NEW.tipo_id := OLD.tipo_id;
    NEW.centro_custo_id := OLD.centro_custo_id; NEW.contrato_id := OLD.contrato_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.os_close(_os_id uuid, _km_final integer, _tanque_final text, _gnv_final text, _posicao_final text, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _appt uuid; _st int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_os_read(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para finalizar O.S.'; END IF;
  SELECT status_id, appointment_id INTO _st, _appt FROM public.ordens_servico WHERE id = _os_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'O.S. não encontrada'; END IF;
  IF _st IN (3,7) THEN RAISE EXCEPTION 'O.S. já está encerrada'; END IF;
  PERFORM set_config('app.os_closing', '1', true);
  UPDATE public.ordens_servico SET status_id = 7, closed_at = now(), closed_by = auth.uid(),
    km_final = _km_final, tanque_final = nullif(_tanque_final,''), gnv_final = nullif(_gnv_final,''),
    posicao_final = nullif(_posicao_final,''), close_note = nullif(btrim(coalesce(_note,'')),'')
  WHERE id = _os_id;
  IF _appt IS NOT NULL THEN
    UPDATE public.appointments SET closed_at = now(), closed_by = auth.uid(), close_kind = 'finalizado'
    WHERE id = _appt AND closed_at IS NULL;
  END IF;
  PERFORM set_config('app.os_closing', '0', true);
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.os_finalize(_os_id uuid, _km_final integer, _tanque_final text, _gnv_final text, _posicao_final text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.os_close(_os_id, _km_final, _tanque_final, _gnv_final, _posicao_final, NULL)
$$;

CREATE OR REPLACE FUNCTION public.os_cancel(_os_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _appt uuid; _st int;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gerente')) THEN
    RAISE EXCEPTION 'Apenas Master ou Gerente podem cancelar O.S.';
  END IF;
  IF btrim(coalesce(_reason,'')) = '' THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  SELECT status_id, appointment_id INTO _st, _appt FROM public.ordens_servico WHERE id = _os_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'O.S. não encontrada'; END IF;
  IF _st IN (3,7) THEN RAISE EXCEPTION 'O.S. já está encerrada'; END IF;
  PERFORM set_config('app.os_closing', '1', true);
  UPDATE public.ordens_servico SET status_id = 3, cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = btrim(_reason)
  WHERE id = _os_id;
  IF _appt IS NOT NULL THEN
    UPDATE public.appointments SET closed_at = now(), closed_by = auth.uid(), close_kind = 'cancelado', close_reason = btrim(_reason)
    WHERE id = _appt AND closed_at IS NULL;
  END IF;
  PERFORM set_config('app.os_closing', '0', true);
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.os_reopen(_os_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _appt uuid; _st int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'action.os_edit_closed') THEN
    RAISE EXCEPTION 'Sem permissão para reabrir O.S. encerrada';
  END IF;
  SELECT status_id, appointment_id INTO _st, _appt FROM public.ordens_servico WHERE id = _os_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'O.S. não encontrada'; END IF;
  IF _st NOT IN (3,7) THEN RAISE EXCEPTION 'O.S. não está encerrada'; END IF;
  PERFORM set_config('app.os_reopen', '1', true);
  UPDATE public.ordens_servico SET status_id = 1, closed_at = NULL, closed_by = NULL, close_note = NULL,
    cancelled_at = NULL, cancelled_by = NULL, cancel_reason = NULL
  WHERE id = _os_id;
  IF _appt IS NOT NULL THEN
    UPDATE public.appointments SET closed_at = NULL, closed_by = NULL, close_kind = NULL, close_reason = NULL WHERE id = _appt;
  END IF;
  PERFORM set_config('app.os_reopen', '0', true);
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.os_item_add(_os_id uuid, _description text, _qty numeric, _unit_price numeric, _item_type text, _service_code text DEFAULT NULL::text, _part_code text DEFAULT NULL::text, _budget_account text DEFAULT NULL::text, _mechanic_name text DEFAULT NULL::text, _classification text DEFAULT NULL::text, _requester text DEFAULT NULL::text, _authorizer text DEFAULT NULL::text, _observation text DEFAULT NULL::text, _movement_date date DEFAULT NULL::date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para adicionar itens'; END IF;
  IF public.os_locked(_os_id) THEN RAISE EXCEPTION 'O.S. finalizada ou cancelada não pode ser alterada sem permissão do Master'; END IF;
  INSERT INTO public.os_itens (os_id, description, qty, unit_price, item_type, service_code, part_code,
    budget_account, mechanic_name, classification, requester, authorizer, observation, movement_date)
  VALUES (_os_id, _description, _qty, _unit_price, _item_type, _service_code, _part_code,
    _budget_account, _mechanic_name, _classification, _requester, _authorizer, _observation, _movement_date)
  RETURNING id INTO _id;
  RETURN jsonb_build_object('id', _id);
END $function$;

CREATE OR REPLACE FUNCTION public.os_item_delete(_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para excluir itens'; END IF;
  IF public.os_locked((SELECT os_id FROM public.os_itens WHERE id = _item_id)) THEN
    RAISE EXCEPTION 'O.S. finalizada ou cancelada não pode ser alterada sem permissão do Master';
  END IF;
  DELETE FROM public.os_itens WHERE id = _item_id;
END $function$;

CREATE OR REPLACE FUNCTION public.os_item_update(_item_id uuid, _changes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para atualizar itens'; END IF;
  IF public.os_locked((SELECT os_id FROM public.os_itens WHERE id = _item_id)) THEN
    RAISE EXCEPTION 'O.S. finalizada ou cancelada não pode ser alterada sem permissão do Master';
  END IF;
  UPDATE public.os_itens SET
    approval = COALESCE((_changes->>'approval')::text, approval),
    description = COALESCE((_changes->>'description')::text, description),
    qty = COALESCE((_changes->>'qty')::numeric, qty),
    unit_price = COALESCE((_changes->>'unit_price')::numeric, unit_price),
    item_type = COALESCE((_changes->>'item_type')::text, item_type),
    service_code = COALESCE((_changes->>'service_code')::text, service_code),
    part_code = COALESCE((_changes->>'part_code')::text, part_code),
    budget_account = COALESCE((_changes->>'budget_account')::text, budget_account),
    mechanic_name = COALESCE((_changes->>'mechanic_name')::text, mechanic_name),
    classification = COALESCE((_changes->>'classification')::text, classification),
    requester = COALESCE((_changes->>'requester')::text, requester),
    authorizer = COALESCE((_changes->>'authorizer')::text, authorizer),
    observation = COALESCE((_changes->>'observation')::text, observation),
    movement_date = COALESCE((_changes->>'movement_date')::date, movement_date),
    updated_at = now()
  WHERE id = _item_id;
  RETURN jsonb_build_object('success', true);
END $function$;

CREATE OR REPLACE FUNCTION public.appointment_close_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _special boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  _special := current_setting('app.os_closing', true) = '1' OR current_setting('app.os_reopen', true) = '1';
  IF OLD.closed_at IS NOT NULL AND NOT _special
     AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at')
     AND NOT public.has_permission(auth.uid(), 'action.os_edit_closed')
     AND NOT (current_setting('app.status_rename', true) = '1') THEN
    RAISE EXCEPTION 'Atendimento finalizado ou cancelado não pode ser alterado sem permissão do Master';
  END IF;
  IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL THEN
    IF NEW.close_kind IS NULL THEN RAISE EXCEPTION 'Informe se o atendimento foi finalizado ou cancelado'; END IF;
    IF NEW.close_kind = 'cancelado' AND NOT _special
       AND NOT (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gerente')) THEN
      RAISE EXCEPTION 'Apenas Master ou Gerente podem cancelar';
    END IF;
    IF NEW.close_kind = 'cancelado' AND btrim(coalesce(NEW.close_reason,'')) = '' THEN
      RAISE EXCEPTION 'Informe o motivo do cancelamento';
    END IF;
    NEW.closed_at := now(); NEW.closed_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS appointment_close_guard ON public.appointments;
CREATE TRIGGER appointment_close_guard BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.appointment_close_guard();

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
SELECT coalesce(array_agg(p), ARRAY[]::text[]) FROM unnest(ARRAY['module.agenda','module.oficina','module.historicos','module.os','module.veiculos','module.noticias','action.forward_workshop','action.create_os','action.manage_vehicles','action.news_create','action.news_edit','action.news_delete','action.home_layout','module.vistorias','action.inspection_create','action.inspection_cancel','action.inspection_config','action.os_edit_closed']) p WHERE public.has_permission(auth.uid(), p) $function$;

GRANT EXECUTE ON FUNCTION public.os_close(uuid,integer,text,text,text,text), public.os_cancel(uuid,text), public.os_reopen(uuid) TO authenticated;
