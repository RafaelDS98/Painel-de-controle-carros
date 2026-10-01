CREATE OR REPLACE FUNCTION public.enforce_status_option() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
   IF OLD.is_completion THEN RAISE EXCEPTION 'Marque outra situação como conclusão antes de remover esta'; END IF;
   IF EXISTS (SELECT 1 FROM public.appointments WHERE status = OLD.label) THEN RAISE EXCEPTION 'Existem agendamentos usando esta situação; troque a situação deles antes de remover'; END IF;
   RETURN OLD;
 END IF;
 IF TG_OP = 'UPDATE' AND OLD.is_completion AND NOT NEW.is_completion AND pg_trigger_depth() = 1 THEN
   RAISE EXCEPTION 'Marque outra situação como conclusão antes de desmarcar esta';
 END IF;
 IF NEW.is_completion AND (TG_OP = 'INSERT' OR NOT OLD.is_completion) THEN
   PERFORM pg_advisory_xact_lock(728143, 1);
   UPDATE public.status_options SET is_completion = false WHERE is_completion AND id <> NEW.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_status_option() FROM PUBLIC, anon, authenticated;