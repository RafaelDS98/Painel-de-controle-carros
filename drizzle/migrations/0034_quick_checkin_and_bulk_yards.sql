CREATE OR REPLACE FUNCTION public.validate_checkin_plate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.appointment_id IS NULL THEN
    IF NEW.plate IS NULL OR NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE public.norm_plate(v.plate) = public.norm_plate(NEW.plate)) THEN
      RAISE EXCEPTION 'Placa não cadastrada — peça ao Master/Gerente para cadastrar o veículo';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_checkin_plate_trg ON public.check_in_records;
CREATE TRIGGER validate_checkin_plate_trg BEFORE INSERT ON public.check_in_records FOR EACH ROW EXECUTE FUNCTION public.validate_checkin_plate();

CREATE OR REPLACE FUNCTION public.set_own_yards(_ids uuid[], _value boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Apenas Master configura o pátio'; END IF;
  UPDATE public.workshops SET is_own_yard = _value WHERE id = ANY(_ids);
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.set_own_yards(uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_yards(uuid[], boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_group_members_bulk(_group_id uuid, _ids uuid[], _add boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Apenas Master edita grupos'; END IF;
  IF _add THEN
    INSERT INTO public.yard_group_members(group_id, workshop_id) SELECT _group_id, x FROM unnest(_ids) x ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.yard_group_members WHERE group_id = _group_id AND workshop_id = ANY(_ids);
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.set_group_members_bulk(uuid, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_members_bulk(uuid, uuid[], boolean) TO authenticated;