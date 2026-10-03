CREATE OR REPLACE FUNCTION public.enforce_appointment_insert_priority()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente')) THEN
   NEW.priority_urgent := false;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_appointment_insert_priority() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS appointments_enforce_insert_priority ON public.appointments;
CREATE TRIGGER appointments_enforce_insert_priority BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_insert_priority();