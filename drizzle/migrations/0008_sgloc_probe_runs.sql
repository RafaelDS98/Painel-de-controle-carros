ALTER TABLE public.sgloc_settings ADD COLUMN IF NOT EXISTS base_url text, ADD COLUMN IF NOT EXISTS request_timeout_seconds integer NOT NULL DEFAULT 15;
ALTER TABLE public.sgloc_settings DROP CONSTRAINT IF EXISTS sgloc_settings_timeout_range;
ALTER TABLE public.sgloc_settings ADD CONSTRAINT sgloc_settings_timeout_range CHECK (request_timeout_seconds BETWEEN 3 AND 60);

CREATE TABLE public.sgloc_probe_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  run_by uuid,
  step text NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  http_status integer,
  latency_ms integer,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);
REVOKE ALL ON public.sgloc_probe_runs FROM anon, PUBLIC;
GRANT SELECT ON public.sgloc_probe_runs TO authenticated;
GRANT ALL ON public.sgloc_probe_runs TO service_role;
ALTER TABLE public.sgloc_probe_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Masters read probe runs" ON public.sgloc_probe_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'::app_role));
CREATE INDEX sgloc_probe_runs_run_at_idx ON public.sgloc_probe_runs (run_at DESC);

-- Token só no servidor: nenhum papel de cliente acessa a tabela (nem master).
REVOKE ALL ON public.sgloc_accounts FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.sgloc_accounts TO service_role;
ALTER TABLE public.sgloc_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgloc_accounts ADD COLUMN IF NOT EXISTS token_encrypted boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.sgloc_accounts.token IS 'Token SGLOC; quando token_encrypted=true, formato v1:<iv b64>:<cifra b64> (AES-GCM, chave SGLOC_TOKEN_KEY no servidor).';