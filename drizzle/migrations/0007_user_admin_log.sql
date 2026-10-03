CREATE TABLE public.user_admin_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  target_id uuid,
  target_label text NOT NULL DEFAULT '',
  action text NOT NULL,
  detail text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.user_admin_log TO authenticated;
GRANT ALL ON public.user_admin_log TO service_role;
ALTER TABLE public.user_admin_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Masters read user admin log" ON public.user_admin_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'::app_role));

CREATE OR REPLACE FUNCTION public.revoke_user_sessions(_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, auth
AS $$ DELETE FROM auth.sessions WHERE user_id = _user_id; $$;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;