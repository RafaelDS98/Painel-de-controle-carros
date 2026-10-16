CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL UNIQUE,
  sgloc_id integer,
  prefixo text, loja_op text, pos_operacional text, grupo text,
  categoria text, fabricante text, ano integer, ano_modelo integer, modelo text, cor text,
  chassi text, renavam text, km_atual integer, tanque numeric, status text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with access read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Managers write vehicles" ON public.vehicles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gerente')) WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'gerente'));
GRANT INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;