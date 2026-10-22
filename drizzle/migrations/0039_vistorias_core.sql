CREATE TABLE public.inspection_operation_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  base_type text NOT NULL DEFAULT 'entrega' CHECK (base_type IN ('pre_vistoria','entrega','cautelar','coleta','coleta_entrega','autoinspecao')),
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inspection_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tab text NOT NULL DEFAULT 'checklist' CHECK (tab IN ('campos','checklist','fotos')),
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.inspection_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.inspection_groups(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'check' CHECK (kind IN ('check','photo','text','number')),
  required boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigserial UNIQUE,
  vehicle_id uuid REFERENCES public.vehicles(id),
  plate text NOT NULL,
  operation_type_id uuid REFERENCES public.inspection_operation_types(id),
  operation_name text,
  status text NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida','cancelada')),
  km integer,
  fuel text,
  driver_name text,
  client_name text,
  notes text,
  damage_count integer NOT NULL DEFAULT 0,
  inspector_id uuid NOT NULL DEFAULT auth.uid(),
  inspector_signature text,
  driver_signature text,
  cancel_reason text,
  cancelled_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inspection_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  field_id uuid REFERENCES public.inspection_fields(id),
  group_name text,
  label text NOT NULL,
  kind text NOT NULL,
  status text CHECK (status IN ('bom','ruim','atencao','na')),
  value text,
  photo_path text,
  note text
);
GRANT SELECT ON public.inspection_operation_types, public.inspection_groups, public.inspection_fields TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inspection_operation_types, public.inspection_groups, public.inspection_fields TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inspections TO authenticated;
GRANT SELECT, INSERT ON public.inspection_answers TO authenticated;
GRANT USAGE ON SEQUENCE public.inspections_number_seq TO authenticated;
GRANT ALL ON public.inspection_operation_types, public.inspection_groups, public.inspection_fields, public.inspections, public.inspection_answers TO service_role;
ALTER TABLE public.inspection_operation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read optypes" ON public.inspection_operation_types FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'module.vistorias'));
CREATE POLICY "config optypes" ON public.inspection_operation_types FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'action.inspection_config')) WITH CHECK (public.has_permission(auth.uid(),'action.inspection_config'));
CREATE POLICY "read groups" ON public.inspection_groups FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'module.vistorias'));
CREATE POLICY "config groups" ON public.inspection_groups FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'action.inspection_config')) WITH CHECK (public.has_permission(auth.uid(),'action.inspection_config'));
CREATE POLICY "read fields" ON public.inspection_fields FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'module.vistorias'));
CREATE POLICY "config fields" ON public.inspection_fields FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'action.inspection_config')) WITH CHECK (public.has_permission(auth.uid(),'action.inspection_config'));
CREATE POLICY "read inspections" ON public.inspections FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'module.vistorias'));
CREATE POLICY "create inspections" ON public.inspections FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'action.inspection_create') AND inspector_id = auth.uid() AND status = 'concluida');
CREATE POLICY "cancel inspections" ON public.inspections FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(),'action.inspection_cancel')) WITH CHECK (public.has_permission(auth.uid(),'action.inspection_cancel'));
CREATE POLICY "read answers" ON public.inspection_answers FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'module.vistorias'));
CREATE POLICY "create answers" ON public.inspection_answers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.inspections i WHERE i.id = inspection_id AND i.inspector_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.inspection_cancel_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'cancelada' THEN RAISE EXCEPTION 'Vistoria já cancelada'; END IF;
  IF NEW.status <> 'cancelada' OR coalesce(trim(NEW.cancel_reason),'') = '' THEN RAISE EXCEPTION 'Só é possível cancelar, informando o motivo'; END IF;
  NEW := OLD || jsonb_populate_record(NULL::public.inspections, '{}'::jsonb) ;
  RETURN NEW;
END $$;
DROP FUNCTION public.inspection_cancel_guard();
CREATE OR REPLACE FUNCTION public.inspection_cancel_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE reason text := NEW.cancel_reason;
BEGIN
  IF OLD.status = 'cancelada' THEN RAISE EXCEPTION 'Vistoria já cancelada'; END IF;
  IF NEW.status <> 'cancelada' OR coalesce(trim(reason),'') = '' THEN RAISE EXCEPTION 'Só é possível cancelar, informando o motivo'; END IF;
  NEW := OLD;
  NEW.status := 'cancelada'; NEW.cancel_reason := reason; NEW.cancelled_by := auth.uid(); NEW.cancelled_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER inspection_cancel_guard BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.inspection_cancel_guard();

CREATE POLICY "vistorias read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'vistorias' AND public.has_permission(auth.uid(),'module.vistorias'));
CREATE POLICY "vistorias upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vistorias' AND public.has_permission(auth.uid(),'action.inspection_create'));

INSERT INTO public.inspection_operation_types (name, base_type, sort) VALUES
 ('Entrada manutenção','coleta',1),('Saída manutenção','entrega',2),('Entrega reserva','entrega',3),('Devolução reserva','coleta',4),
 ('Entrega definitiva','entrega',5),('Devolução definitiva','coleta',6),('Saída demanda','entrega',7),('Retorno demanda','coleta',8),
 ('Implantação','entrega',9),('Cautelar','cautelar',10);
WITH g AS (INSERT INTO public.inspection_groups (name, tab, sort) VALUES ('Fotos do veículo','fotos',1) RETURNING id)
INSERT INTO public.inspection_fields (group_id,label,kind,required,sort) SELECT id, x.l, 'photo', x.r, x.s FROM g, (VALUES ('Frente',true,1),('Lateral dianteira direita',true,2),('Lateral traseira direita',false,3),('Traseira',true,4),('Lateral traseira esquerda',false,5),('Lateral dianteira esquerda',true,6),('Painel / hodômetro',true,7),('Foto da placa',false,8)) x(l,r,s);
WITH g AS (INSERT INTO public.inspection_groups (name, tab, sort) VALUES ('Externo','checklist',2) RETURNING id)
INSERT INTO public.inspection_fields (group_id,label,kind,required,sort) SELECT id, x.l, 'check', x.r, x.s FROM g, (VALUES ('Lataria',true,1),('Pintura',true,2),('Para-brisa / vidros',true,3),('Faróis e lanternas',true,4),('Retrovisores',true,5),('Pneus',true,6),('Estepe',false,7)) x(l,r,s);
WITH g AS (INSERT INTO public.inspection_groups (name, tab, sort) VALUES ('Interno e acessórios','checklist',3) RETURNING id)
INSERT INTO public.inspection_fields (group_id,label,kind,required,sort) SELECT id, x.l, 'check', x.r, x.s FROM g, (VALUES ('Bancos e forração',true,1),('Painel e luzes de alerta',true,2),('Ar-condicionado',false,3),('Macaco e chave de roda',true,4),('Triângulo',true,5),('Documento do veículo',true,6)) x(l,r,s);