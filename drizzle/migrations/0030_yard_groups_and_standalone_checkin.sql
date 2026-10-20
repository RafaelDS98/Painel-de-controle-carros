CREATE TABLE public.yard_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX yard_groups_name_key ON public.yard_groups (public.norm_name(name));
CREATE TABLE public.yard_group_members (
  group_id uuid NOT NULL REFERENCES public.yard_groups(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, workshop_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yard_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yard_group_members TO authenticated;
GRANT ALL ON public.yard_groups TO service_role;
GRANT ALL ON public.yard_group_members TO service_role;
ALTER TABLE public.yard_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yard_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY yg_read ON public.yard_groups FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY yg_write ON public.yard_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY ygm_read ON public.yard_group_members FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY ygm_write ON public.yard_group_members FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

ALTER TABLE public.check_in_records ALTER COLUMN appointment_id DROP NOT NULL;
ALTER TABLE public.check_in_records ADD COLUMN IF NOT EXISTS plate text;
ALTER TABLE public.check_in_records ADD COLUMN IF NOT EXISTS workshop_id uuid REFERENCES public.workshops(id);
UPDATE public.check_in_records c SET plate = public.norm_plate(a.plate) FROM public.appointments a WHERE a.id = c.appointment_id AND c.plate IS NULL;
CREATE INDEX IF NOT EXISTS check_in_records_plate_idx ON public.check_in_records (plate, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.check_in_fill() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT public.norm_plate(plate) INTO NEW.plate FROM appointments WHERE id = NEW.appointment_id;
  ELSE
    NEW.plate := public.norm_plate(NEW.plate);
  END IF;
  IF NEW.plate IS NULL OR NEW.plate !~ '^[A-Z]{3}[A-Z0-9]{4}$' THEN
    RAISE EXCEPTION 'Placa inválida para check-in/check-out.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS check_in_fill_trg ON public.check_in_records;
CREATE TRIGGER check_in_fill_trg BEFORE INSERT ON public.check_in_records FOR EACH ROW EXECUTE FUNCTION public.check_in_fill();

CREATE POLICY check_read_standalone ON public.check_in_records FOR SELECT TO authenticated
  USING (appointment_id IS NULL AND public.has_access(auth.uid()));
CREATE POLICY check_write_standalone ON public.check_in_records FOR INSERT TO authenticated
  WITH CHECK (appointment_id IS NULL AND performed_by = auth.uid() AND public.has_access(auth.uid()));
GRANT SELECT, INSERT ON public.check_in_records TO authenticated;