CREATE TYPE public.app_role AS ENUM ('atendimento', 'gerente', 'master');
CREATE TYPE public.contact_type AS ENUM ('ligação', 'mensagem');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role public.app_role,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role IS NOT NULL)
$$;

CREATE POLICY "Own profile readable" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_access(auth.uid()));
CREATE POLICY "Own profile name editable" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id text NOT NULL DEFAULT '',
  registered_at date,
  date date,
  time text NOT NULL DEFAULT '',
  plate text NOT NULL DEFAULT '',
  store text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  workshop text NOT NULL DEFAULT '',
  issue text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  operator text NOT NULL DEFAULT '',
  external_order text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '' CHECK (status IN ('', 'Recebido', 'Em execução', 'Peça', 'Finalizado')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  original_deadline date,
  current_deadline date,
  priority_urgent boolean NOT NULL DEFAULT false,
  rework_of uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  rework_reason text,
  sgloc_reference text,
  creator_edits_used int NOT NULL DEFAULT 0,
  creator_edits_allowed int NOT NULL DEFAULT 1,
  manager_edit_used boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON public.appointments FOR ALL TO authenticated USING (public.has_access(auth.uid())) WITH CHECK (public.has_access(auth.uid()));

CREATE TABLE public.edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_changed text NOT NULL,
  old_value text,
  new_value text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edit_log TO authenticated;
GRANT ALL ON public.edit_log TO service_role;
ALTER TABLE public.edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON public.edit_log FOR ALL TO authenticated USING (public.has_access(auth.uid())) WITH CHECK (public.has_access(auth.uid()));

CREATE TABLE public.contact_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  contact_type public.contact_type NOT NULL,
  contact_at timestamptz NOT NULL DEFAULT now(),
  registered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_log TO authenticated;
GRANT ALL ON public.contact_log TO service_role;
ALTER TABLE public.contact_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON public.contact_log FOR ALL TO authenticated USING (public.has_access(auth.uid())) WITH CHECK (public.has_access(auth.uid()));

-- Carga inicial única: 21 registros de src/lib/agenda-data.ts
INSERT INTO public.appointments (sheet_id, registered_at, date, time, plate, store, model, contact, workshop, issue, note, operator, external_order) VALUES
('1083','2026-09-17','2026-09-24','08:30','RXD8C18','OFICINA','POLO TRACK MA','SESMA','OFICINA MECANICA ARRAIS','REVISÃO DE 64.363','HERONDI','josiele sena alves',''),
('1075','2026-09-16','2026-09-24','09:00','SZW7B25','OFICINA','STRADA FREEDOM CABINE DUPLA','COHAB','OFICINA MECANICA ARRAIS','REVISÃO DE 52.000 KM, ALINHAS ,BALANCEAR E VERIFICAR OS PNEUS E SUSPENSÃO','SUSANE','josiele sena alves',''),
('1085','2026-09-18','2026-09-24','09:30','SZC4G23','OFICINA','C3 LIVE','FASEPA','OFICINA MECANICA ARRAIS','BARULHO FEIO  NA RODA DIANTEIRA DIRETA AO ANDAR','LAURO','josiele sena alves',''),
('1089','2026-09-18','2026-09-24','10:00','TWT8I72','OFICINA','RANGER XLS CABINE DUPLA DIESEL','PARAPAZ','FENIX AUTOMOVEIS LTDA (FORD)','REVISÃO DE 16.000 KM, E VERIFICAR FREIOS','PAULO','josiele sena alves',''),
('1091','2026-09-19','2026-09-24','10:00','SZB2F86','OFICINA','TORO FREED T270','SEASTER','OFICINA MECANICA ARRAIS','REVISÃO DE KM, SUSPENSÃO, TROCA DE PNEUS, SISTEMA DE FREIO','ALTAIR','josiele sena alves',''),
('1078','2026-09-16','2026-09-23','08:00','SZM5G61','OFICINA','OROCH PRO 1.6','FASEPA','OFICINA MECANICA ARRAIS','REVISÃO DE KM','LAURO','josiele sena alves',''),
('1063','2026-09-11','2026-09-23','08:30','TVP0J56','OFICINA','C3 AIRCROSS FLPK7','SEASTER','PEUGEOT CITROEN DO BRASIL AUTOMOVEIS LTD','REAGENDADO FAZER MANUTENÇÃO DE 20.000, TROCAR OS PNEUS E TROCAR O SUPORTE DO FAROL','ALTAIR','josiele sena alves',''),
('1069','2026-09-15','2026-09-23','09:00','TWT8H52','OFICINA','ONIX PLUS 10MT NB','SEASTER','RR CHEVROET ANANINDEUA','REVISÃO 10.000 KM','ALTAIR','josiele sena alves',''),
('1082','2026-09-17','2026-09-23','09:30','RWL8G39','OFICINA','RANGER XLSCD4A32','ACARÁ - EDUCAÇÃO','OFICINA MECANICA ARRAIS','FALHA NO FREIO, BAIXA DE OLEO, LUZ DA INJEÇÃO ACESA','RODRIGO','josiele sena alves',''),
('1074','2026-09-16','2026-09-23','10:00','SZI4D27','OFICINA','C3 - AIRCROSS FL 7','SESMA','PEUGEOT CITROEN DO BRASIL AUTOMOVEIS LTD','REVISÃO DE 30.000 KM, SUSPENSÃO DIANTEIRA E VERIFICAR FREIOS','MAURO','josiele sena alves',''),
('1079','2026-09-16','2026-09-22','08:00','SZD3A68','OFICINA','SPIN  PREMIER 1.8','MELHOR EM CASA - SESMA','','REVISÃO DE KM, SUSPENSÃO DIANTEIRA, VERIFICAR FREIOS, COMPLETAE O LIQUIDO DO ARREFERCIMENTO','','josiele sena alves',''),
('1080','2026-09-16','2026-09-22','08:30','RWQ6J49','OFICINA','RANGER XLSCD4A32','SEMEC','OFICINA MECANICA ARRAIS','REVISÃO DE KM','SANTANA','josiele sena alves',''),
('1071','2026-09-15','2026-09-22','09:00','RXD8C78','OFICINA','POLO TRACK MA','SESMA','OFICINA MECANICA ARRAIS','REVISÃO DE KM, TROCA DE PNEUS. E LAVAGEM','MAURO','josiele sena alves',''),
('1073','2026-09-15','2026-09-22','09:30','SZC1E07','OFICINA','OROCH PRO 16','COHAB','OFICINA MECANICA ARRAIS','REVISÃO DE 50.000 KM, ALINHAMENTO E  BALANCEAMENTO, SUSPENSÃO ESTÁ SACUDINDO EMBAIXO ,O BICO INJETOR ESTÁ SUJO, O CARRO ESTÁ FALHANDO E DESLIGANDO AUTOMATICAMENTE, QUANDO PARA EM QUALQUER LUGAR','SUSANE - PRECISAR DE RESERVA','josiele sena alves',''),
('1077','2026-09-16','2026-09-22','10:00','SZH1J06','OFICINA','TORO VOLCANO AT9','SEASTER','OFICINA MECANICA ARRAIS','REVISÃO DE KM: 60.000','DANIEL','josiele sena alves',''),
('1084','2026-09-18','2026-09-21','08:00','RWX9F57','OFICINA','RANGER XL CD4 2.2 C','FASEPA','OFICINA MECANICA ARRAIS','REVISÃO DE KM, SUSPENSÃO, TROCA DE PNEUS E LAVAGEM','LAURO','josiele sena alves',''),
('1072','2026-09-15','2026-09-21','08:30','TWF6F31','OFICINA','HB20 10M COMFORT','SEAP','HYUNDAI UNIQUE','REVISÃO 20.000 KM','RENATO','josiele sena alves',''),
('1067','2026-09-14','2026-09-21','09:00','SZA6C95','OFICINA','POLO TRACK','SEZEL','OFICINA MECANICA ARRAIS','REVISÃO GERAL','ROSE','josiele sena alves',''),
('1068','2026-09-14','2026-09-21','09:30','SZE8G54','OFICINA','CRONOS DRIVE','SEASTER','GRUPO MONACO VEÍCULOS LTDA','REVISÃO DE 40.000 KM','ALTAIR','josiele sena alves',''),
('1070','2026-09-15','2026-09-21','10:00','SZO4C70','OFICINA','HB20 10M COMFORT','SEGBEL','HYUNDAI UNIQUE','REVISÃO DE 10.000 KM','HENRIQUE','josiele sena alves',''),
('1076','2026-09-16','2026-09-21','10:30','QVX2A68','OFICINA','GOL 1.0 MC 4','FUNPAPA','OFICINA MECANICA ARRAIS','REVISÃO DE KM E AR CONDICIONADO NÃO FUNCIONA','MATHEUS','josiele sena alves','');