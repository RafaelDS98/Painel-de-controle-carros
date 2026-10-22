DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inspections;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS inspections_created_at_idx ON public.inspections (created_at DESC);
CREATE INDEX IF NOT EXISTS inspections_plate_idx ON public.inspections (plate);