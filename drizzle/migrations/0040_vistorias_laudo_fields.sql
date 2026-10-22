ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS questionnaire text NOT NULL DEFAULT 'AUTOMOVEL',
  ADD COLUMN IF NOT EXISTS validation_code text NOT NULL DEFAULT upper(substr(md5(gen_random_uuid()::text),1,8));
COMMENT ON COLUMN public.inspections.details IS 'Campos do laudo: pertences, whatsapp, pneus, tipo de veiculo, cambio, responsavel (nome/rg/telefone)';
ALTER TABLE public.inspection_answers ADD COLUMN IF NOT EXISTS photo_taken_at timestamptz, ADD COLUMN IF NOT EXISTS photo_name text;