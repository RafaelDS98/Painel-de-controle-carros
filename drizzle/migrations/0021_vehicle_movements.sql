CREATE OR REPLACE FUNCTION public.norm_plate(_v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT upper(regexp_replace(coalesce(_v, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- Mesma regra de serviceCategory (src/lib/agenda-safety.ts).
CREATE OR REPLACE FUNCTION public.service_category(_issue text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN upper(coalesce(_issue,'')) LIKE '%FREIO%' THEN 'Freios'
    WHEN upper(coalesce(_issue,'')) LIKE '%SUSPENS%' THEN 'Suspensão'
    WHEN upper(coalesce(_issue,'')) ~ '(PNEU|ALINH|BALANCE)' THEN 'Pneus'
    WHEN upper(coalesce(_issue,'')) ~ '(REVIS|MANUTEN)' THEN 'Revisão'
    ELSE 'Corretiva' END
$$;

CREATE INDEX IF NOT EXISTS appointments_norm_plate_idx ON public.appointments (public.norm_plate(plate));
CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments (date);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments (status);
CREATE INDEX IF NOT EXISTS edit_log_appointment_changed_idx ON public.edit_log (appointment_id, changed_at);
CREATE INDEX IF NOT EXISTS edit_log_status_changes_idx ON public.edit_log (changed_at) WHERE field_changed = 'status';

-- Movimentações por veículo: SECURITY INVOKER (a RLS de appointments/edit_log decide o que cada perfil vê).
CREATE OR REPLACE FUNCTION public.search_vehicle_movements(
  _plate text DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL, _status text DEFAULT NULL,
  _store text DEFAULT NULL, _workshop text DEFAULT NULL, _mechanic text DEFAULT NULL, _service text DEFAULT NULL,
  _sector text DEFAULT NULL, _urgent boolean DEFAULT NULL, _rework boolean DEFAULT NULL,
  _include_archived boolean DEFAULT false, _page integer DEFAULT 1, _page_size integer DEFAULT 20)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH sec AS (SELECT user_id, sector FROM public.appointment_creator_sectors()),
m AS (
  SELECT a.*, s.sector AS creator_sector, public.norm_plate(a.plate) AS pkey
  FROM public.appointments a LEFT JOIN sec s ON s.user_id = a.created_by
  WHERE (coalesce(_include_archived, false) OR a.archived_at IS NULL)
    AND (nullif(public.norm_plate(_plate), '') IS NULL OR public.norm_plate(a.plate) LIKE '%' || public.norm_plate(_plate) || '%')
    AND ((_from IS NULL AND _to IS NULL)
      OR a.date BETWEEN coalesce(_from, '0001-01-01'::date) AND coalesce(_to, '9999-12-31'::date)
      OR (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN coalesce(_from, '0001-01-01'::date) AND coalesce(_to, '9999-12-31'::date)
      OR EXISTS (SELECT 1 FROM public.edit_log e WHERE e.appointment_id = a.id AND e.field_changed = 'status'
        AND (e.changed_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN coalesce(_from, '0001-01-01'::date) AND coalesce(_to, '9999-12-31'::date)))
    AND (nullif(_status, '') IS NULL OR public.norm_name(a.status) = public.norm_name(_status)
      OR EXISTS (SELECT 1 FROM public.edit_log e WHERE e.appointment_id = a.id AND e.field_changed = 'status' AND public.norm_name(e.new_value) = public.norm_name(_status)))
    AND (nullif(_store, '') IS NULL OR public.norm_name(a.store) = public.norm_name(_store))
    AND (nullif(_workshop, '') IS NULL OR public.norm_name(a.workshop) = public.norm_name(_workshop))
    AND (nullif(_mechanic, '') IS NULL OR public.norm_name(a.custom_fields->>'mecanico_responsavel') = public.norm_name(_mechanic))
    AND (nullif(_service, '') IS NULL OR public.service_category(a.issue) = _service)
    AND (nullif(_sector, '') IS NULL OR (_sector = '(sem valor)' AND s.sector IS NULL) OR public.norm_name(s.sector) = public.norm_name(_sector))
    AND (_urgent IS NULL OR a.priority_urgent = _urgent)
    AND (_rework IS NULL OR (a.rework_of IS NOT NULL) = _rework)
),
v AS (SELECT pkey, max(date) AS last_date, max(created_at) AS last_created, count(*) AS n FROM m GROUP BY pkey),
pg AS (SELECT * FROM v ORDER BY last_date DESC NULLS LAST, last_created DESC, pkey
  LIMIT greatest(1, least(coalesce(_page_size, 20), 100)) OFFSET (greatest(coalesce(_page, 1), 1) - 1) * greatest(1, least(coalesce(_page_size, 20), 100)))
SELECT jsonb_build_object(
  'total_vehicles', (SELECT count(*) FROM v),
  'total_passes', (SELECT coalesce(sum(n), 0) FROM v),
  'vehicles', coalesce((SELECT jsonb_agg(jsonb_build_object('plate_key', pg.pkey, 'passes', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'plate', m.plate, 'date', m.date, 'time', m.time, 'created_at', m.created_at, 'store', m.store, 'workshop', m.workshop,
        'mechanic', m.custom_fields->>'mecanico_responsavel', 'operator', m.operator, 'issue', m.issue, 'service', public.service_category(m.issue),
        'schedule_type', m.schedule_type, 'external_order', m.external_order, 'os_number', m.os_number, 'km', m.km_scheduled,
        'original_deadline', m.original_deadline, 'current_deadline', m.current_deadline, 'urgent', m.priority_urgent,
        'rework_of', m.rework_of, 'rework_reason', m.rework_reason, 'note', m.note, 'status', m.status, 'brand', m.brand, 'model', m.model,
        'sector', m.creator_sector, 'archived', m.archived_at IS NOT NULL,
        'rework_original', (SELECT jsonb_build_object('id', o.id, 'date', o.date, 'time', o.time) FROM public.appointments o WHERE o.id = m.rework_of),
        'events', (SELECT coalesce(jsonb_agg(jsonb_build_object('field', e.field_changed, 'old', e.old_value, 'new', e.new_value, 'at', e.changed_at,
            'by', CASE WHEN e.changed_by IS NULL THEN NULL ELSE coalesce(p.full_name, 'Usuário') END) ORDER BY e.changed_at), '[]'::jsonb)
          FROM public.edit_log e LEFT JOIN public.profiles p ON p.id = e.changed_by WHERE e.appointment_id = m.id)
      ) ORDER BY m.date DESC NULLS LAST, m.time DESC, m.created_at DESC) FROM m WHERE m.pkey = pg.pkey)
    ) ORDER BY pg.last_date DESC NULLS LAST, pg.last_created DESC, pg.pkey) FROM pg), '[]'::jsonb)
)
$$;
REVOKE ALL ON FUNCTION public.search_vehicle_movements(text,date,date,text,text,text,text,text,text,boolean,boolean,boolean,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_vehicle_movements(text,date,date,text,text,text,text,text,text,boolean,boolean,boolean,integer,integer) TO authenticated;