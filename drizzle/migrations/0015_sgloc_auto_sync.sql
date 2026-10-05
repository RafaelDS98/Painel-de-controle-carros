ALTER TABLE public.sgloc_settings
  ADD COLUMN IF NOT EXISTS sync_user_id uuid,
  ADD COLUMN IF NOT EXISTS sync_live boolean NOT NULL DEFAULT false;
ALTER TABLE public.sgloc_settings ALTER COLUMN interval_minutes SET DEFAULT 480;
UPDATE public.sgloc_settings SET interval_minutes = 480,
  sync_user_id = COALESCE(sync_user_id, (SELECT id FROM auth.users WHERE lower(email) = 'rafael344960@gmail.com' LIMIT 1)),
  sync_live = false;
ALTER TABLE public.sgloc_settings ADD CONSTRAINT sgloc_settings_interval_range CHECK (interval_minutes BETWEEN 15 AND 1440);
ALTER TABLE public.sgloc_settings ADD CONSTRAINT sgloc_settings_window_range CHECK (window_days_back BETWEEN 0 AND 60 AND window_days_ahead BETWEEN 0 AND 180);

ALTER TABLE public.sgloc_sync_runs
  ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS protected integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS not_returned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ambiguous integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sample jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS sgloc_sync_runs_one_running ON public.sgloc_sync_runs ((true)) WHERE status = 'running';

CREATE OR REPLACE FUNCTION public.list_sgloc_connected_users()
RETURNS TABLE(user_id uuid, full_name text, sgloc_email text, token_expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Apenas master'; END IF;
  RETURN QUERY SELECT a.user_id, p.full_name, a.sgloc_email, a.token_expires_at
    FROM public.sgloc_accounts a LEFT JOIN public.profiles p ON p.id = a.user_id ORDER BY p.full_name;
END $$;
REVOKE ALL ON FUNCTION public.list_sgloc_connected_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_sgloc_connected_users() TO authenticated;