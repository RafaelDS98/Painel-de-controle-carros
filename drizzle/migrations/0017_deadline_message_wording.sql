DO $m$
DECLARE _src text;
BEGIN
 SELECT pg_get_functiondef('public.enforce_appointment_edit_rules()'::regprocedure) INTO _src;
 _src := replace(_src, $$RAISE EXCEPTION 'Já houve % alteração(ões) da previsão. Peça autorização ao gerente ou master.', OLD.deadline_changes_used;$$,
   $$RAISE EXCEPTION 'Já houve % da previsão. Peça autorização ao gerente ou master.', CASE WHEN OLD.deadline_changes_used = 1 THEN '1 alteração' ELSE OLD.deadline_changes_used || ' alterações' END;$$);
 EXECUTE _src;
END $m$;