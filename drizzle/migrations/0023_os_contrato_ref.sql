ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS contrato_ref text;
CREATE OR REPLACE FUNCTION public.os_contrato_match(_os public.ordens_servico, _q text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _q IS NULL OR _os.contrato_id::text = _q OR _os.contrato_ref ILIKE '%' || _q || '%'
$$;