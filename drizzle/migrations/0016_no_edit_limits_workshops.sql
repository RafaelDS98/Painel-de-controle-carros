-- 1) Lista cadastrável de oficinas/locais
CREATE TABLE IF NOT EXISTS public.workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS workshops_name_unique ON public.workshops (lower(btrim(name)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshops TO authenticated;
GRANT ALL ON public.workshops TO service_role;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read workshops" ON public.workshops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerente master insert workshops" ON public.workshops FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "Gerente master update workshops" ON public.workshops FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "Master delete workshops" ON public.workshops FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'master'));

-- Semeia com os valores já usados (uma grafia por nome, ignorando caixa/espaços) e unifica os agendamentos
INSERT INTO public.workshops (name)
SELECT DISTINCT ON (lower(btrim(workshop))) btrim(workshop) FROM public.appointments
WHERE btrim(coalesce(workshop,'')) <> '' ORDER BY lower(btrim(workshop)), btrim(workshop)
ON CONFLICT DO NOTHING;
UPDATE public.appointments a SET workshop = w.name
FROM public.workshops w WHERE lower(btrim(a.workshop)) = lower(btrim(w.name)) AND a.workshop IS DISTINCT FROM w.name;

-- Campo Local/Oficina passa a ser lista de seleção
UPDATE public.custom_field_definitions SET field_type = 'select' WHERE field_key = 'workshop' AND storage <> 'custom';

-- 2) Fim do limite de edições: qualquer perfil edita (tudo vai para o edit_log);
--    só a Previsão de Entrega continua restrita a gerente/master.
CREATE OR REPLACE FUNCTION public.enforce_appointment_edit_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _role app_role; _business_changed boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid();
 IF _role IS NULL THEN RAISE EXCEPTION 'Seu perfil não tem permissão para alterar agendamentos'; END IF;
 _business_changed := (to_jsonb(NEW) - ARRAY['archived_at','archived_by','updated_at','creator_edits_allowed','creator_edits_used','manager_edit_used','manager_edits_used','sgloc_sync_state','sgloc_synced_at','sgloc_last_error','sgloc_missing_count','sgloc_performed','sgloc_confirmed'])
  IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['archived_at','archived_by','updated_at','creator_edits_allowed','creator_edits_used','manager_edit_used','manager_edits_used','sgloc_sync_state','sgloc_synced_at','sgloc_last_error','sgloc_missing_count','sgloc_performed','sgloc_confirmed']);
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
