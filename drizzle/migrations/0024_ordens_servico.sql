-- Migration 0024: Ordens de Serviço (Service Orders)
-- Módulo completo de O.S. com ciclo de status, itens/serviços, pagamentos, observações e vínculo com agendamentos.

-- ============================================================
-- 1. TABELAS DE CONFIGURAÇÃO
-- ============================================================

-- Tipos de O.S. (20 tipos do SGLOC, id = código SGLOC)
CREATE TABLE public.os_tipos (
  id integer PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.os_tipos TO authenticated;
GRANT ALL ON public.os_tipos TO service_role;
ALTER TABLE public.os_tipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read OS tipos" ON public.os_tipos FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Master manages OS tipos" ON public.os_tipos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

-- Status de O.S. (7 status, id = código SGLOC)
CREATE TABLE public.os_status (
  id integer PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  allows_finalize boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.os_status TO authenticated;
GRANT ALL ON public.os_status TO service_role;
ALTER TABLE public.os_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read OS status" ON public.os_status FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Master manages OS status" ON public.os_status FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

-- Centros de Custo (~170)
CREATE TABLE public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  name_key text GENERATED ALWAYS AS (public.norm_name(name)) STORED,
  sgloc_id integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.centros_custo TO authenticated;
GRANT ALL ON public.centros_custo TO service_role;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read centros custo" ON public.centros_custo FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Master manages centros custo" ON public.centros_custo FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

-- Posições Operacionais
CREATE TABLE public.posicoes_operacionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  is_initial boolean NOT NULL DEFAULT false,
  is_final boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.posicoes_operacionais TO authenticated;
GRANT ALL ON public.posicoes_operacionais TO service_role;
ALTER TABLE public.posicoes_operacionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read posicoes" ON public.posicoes_operacionais FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Master manages posicoes" ON public.posicoes_operacionais FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

-- Classificações de Serviço
CREATE TABLE public.classificacoes_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  name_key text GENERATED ALWAYS AS (public.norm_name(name)) STORED,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name_key)
);
GRANT SELECT ON public.classificacoes_servico TO authenticated;
GRANT ALL ON public.classificacoes_servico TO service_role;
ALTER TABLE public.classificacoes_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read classificacoes" ON public.classificacoes_servico FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Master manages classificacoes" ON public.classificacoes_servico FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

-- Contas Orçamentárias (plano de contas)
CREATE TABLE public.contas_orcamentarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contas_orcamentarias TO authenticated;
GRANT ALL ON public.contas_orcamentarias TO service_role;
ALTER TABLE public.contas_orcamentarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read contas" ON public.contas_orcamentarias FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Master manages contas" ON public.contas_orcamentarias FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

-- Autorizadores (quem pode aprovar O.S.)
CREATE TABLE public.os_autorizadores (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.os_autorizadores TO authenticated;
GRANT ALL ON public.os_autorizadores TO service_role;
ALTER TABLE public.os_autorizadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read autorizadores" ON public.os_autorizadores FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Master manages autorizadores" ON public.os_autorizadores FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

-- ============================================================
-- 2. TABELA PRINCIPAL: ordens_servico
-- ============================================================

CREATE SEQUENCE public.os_numero_seq START 1;

CREATE TABLE public.ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL UNIQUE,

  -- Campos obrigatórios
  plate text NOT NULL,
  km integer CHECK (km >= 0),
  opened_at timestamptz NOT NULL DEFAULT now(),
  store_id integer REFERENCES public.sgloc_stores(store_id),
  workshop_id uuid REFERENCES public.workshops(id),
  status_id integer NOT NULL DEFAULT 2 REFERENCES public.os_status(id),
  tipo_id integer NOT NULL REFERENCES public.os_tipos(id),
  centro_custo_id uuid REFERENCES public.centros_custo(id),

  -- Campos opcionais - Principal
  hora time,
  tanque_inicial text,
  gnv_inicial text,
  posicao_inicial text,
  tipo_atendimento text NOT NULL DEFAULT 'N' CHECK (tipo_atendimento IN ('P','E','N','D')),
  contrato_id integer,
  condutor_nome text,
  condutor_contato text,
  nf text,
  recuperado boolean,
  externa_ref text,
  obs1 text,
  obs2 text,
  previsao_conclusao date,
  pagamento_metodo text,
  solicitante text,
  autorizacao text,
  pendencia boolean NOT NULL DEFAULT false,
  pendencia_desc text,
  executado text CHECK (executado IN ('S','A','N')),
  autorizado_cliente text CHECK (autorizado_cliente IN ('Sim','Não','Pendente')),

  -- Finalização
  closed_at timestamptz,
  km_final integer CHECK (km_final >= 0),
  tanque_final text,
  gnv_final text,
  posicao_final text,

  -- Totais (recalculados por trigger em os_itens)
  total_servico numeric(12,2) NOT NULL DEFAULT 0,
  total_estoque numeric(12,2) NOT NULL DEFAULT 0,
  total_compras numeric(12,2) NOT NULL DEFAULT 0,
  total_os numeric(12,2) NOT NULL DEFAULT 0,

  -- Vínculo com agendamento
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,

  -- Auditoria
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id)
);

CREATE INDEX os_plate_idx ON public.ordens_servico (public.norm_plate(plate));
CREATE INDEX os_status_idx ON public.ordens_servico (status_id);
CREATE INDEX os_opened_idx ON public.ordens_servico (opened_at);
CREATE INDEX os_numero_idx ON public.ordens_servico (numero);
CREATE INDEX os_appointment_idx ON public.ordens_servico (appointment_id) WHERE appointment_id IS NOT NULL;

GRANT SELECT ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read OS" ON public.ordens_servico FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Create OS" ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'atendimento')
);
CREATE POLICY "Update OS" ON public.ordens_servico FOR UPDATE TO authenticated USING (public.has_access(auth.uid())) WITH CHECK (public.has_access(auth.uid()));

-- ============================================================
-- 3. TABELA FILHA: os_itens
-- ============================================================

CREATE TABLE public.os_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  approval text NOT NULL DEFAULT 'Pendente' CHECK (approval IN ('Pendente','Autorizado','Negado')),
  service_code text,
  part_code text,
  description text NOT NULL,
  qty numeric(10,3) NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) GENERATED ALWAYS AS (qty * unit_price) STORED,
  item_type text NOT NULL CHECK (item_type IN ('service','part')),
  budget_account text,
  mechanic_name text,
  classification text,
  requester text,
  authorizer text,
  observation text,
  movement_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX os_itens_os_idx ON public.os_itens (os_id);

GRANT SELECT ON public.os_itens TO authenticated;
GRANT ALL ON public.os_itens TO service_role;
ALTER TABLE public.os_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read OS items" ON public.os_itens FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Create OS items" ON public.os_itens FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'atendimento') OR public.has_role(auth.uid(), 'oficina')
);
CREATE POLICY "Update OS items" ON public.os_itens FOR UPDATE TO authenticated USING (public.has_access(auth.uid())) WITH CHECK (public.has_access(auth.uid()));
CREATE POLICY "Delete OS items" ON public.os_itens FOR DELETE TO authenticated USING (public.has_access(auth.uid()));

-- ============================================================
-- 4. TABELAS AUXILIARES
-- ============================================================

-- Observações do Cliente
CREATE TABLE public.os_observacoes_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX os_obs_os_idx ON public.os_observacoes_cliente (os_id);
GRANT SELECT ON public.os_observacoes_cliente TO authenticated;
GRANT ALL ON public.os_observacoes_cliente TO service_role;
ALTER TABLE public.os_observacoes_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read OS observations" ON public.os_observacoes_cliente FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Create OS observations" ON public.os_observacoes_cliente FOR INSERT TO authenticated WITH CHECK (public.has_access(auth.uid()));
CREATE POLICY "Delete OS observations" ON public.os_observacoes_cliente FOR DELETE TO authenticated USING (public.has_access(auth.uid()));

-- Pagamentos
CREATE TABLE public.os_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  conta_orcamentaria_id uuid REFERENCES public.contas_orcamentarias(id),
  fornecedor text,
  qtd_parcelas integer DEFAULT 1,
  intervalo_dias integer DEFAULT 0,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  forma_pagamento text,
  emissao date,
  primeiro_vencimento date,
  dia_pagamento integer,
  documento text,
  status_pagamento text DEFAULT 'Não Lançado' CHECK (status_pagamento IN ('Não Lançado','A vencer','Vencido','Pago')),
  aceito boolean DEFAULT false,
  aceito_por uuid REFERENCES auth.users(id),
  aceito_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX os_pag_os_idx ON public.os_pagamentos (os_id);
GRANT SELECT ON public.os_pagamentos TO authenticated;
GRANT ALL ON public.os_pagamentos TO service_role;
ALTER TABLE public.os_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read OS payments" ON public.os_pagamentos FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Manage OS payments" ON public.os_pagamentos FOR ALL TO authenticated USING (public.has_access(auth.uid())) WITH CHECK (public.has_access(auth.uid()));

-- Compras (UI v2)
CREATE TABLE public.os_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  numero_compra text NOT NULL,
  valor numeric(12,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX os_comp_os_idx ON public.os_compras (os_id);
GRANT SELECT ON public.os_compras TO authenticated;
GRANT ALL ON public.os_compras TO service_role;
ALTER TABLE public.os_compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read OS purchases" ON public.os_compras FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Manage OS purchases" ON public.os_compras FOR ALL TO authenticated USING (public.has_access(auth.uid())) WITH CHECK (public.has_access(auth.uid()));

-- Cotações (UI v2)
CREATE TABLE public.os_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_item_id uuid NOT NULL REFERENCES public.os_itens(id) ON DELETE CASCADE,
  fornecedor text NOT NULL,
  valor_unitario numeric(12,2) NOT NULL DEFAULT 0,
  prazo_pagamento text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX os_cot_item_idx ON public.os_cotacoes (os_item_id);
GRANT SELECT ON public.os_cotacoes TO authenticated;
GRANT ALL ON public.os_cotacoes TO service_role;
ALTER TABLE public.os_cotacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read OS quotes" ON public.os_cotacoes FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Manage OS quotes" ON public.os_cotacoes FOR ALL TO authenticated USING (public.has_access(auth.uid())) WITH CHECK (public.has_access(auth.uid()));

-- Anexos (UI v2)
CREATE TABLE public.os_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  filename text NOT NULL,
  url text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX os_anx_os_idx ON public.os_anexos (os_id);
GRANT SELECT ON public.os_anexos TO authenticated;
GRANT ALL ON public.os_anexos TO service_role;
ALTER TABLE public.os_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read OS attachments" ON public.os_anexos FOR SELECT TO authenticated USING (public.has_access(auth.uid()));
CREATE POLICY "Manage OS attachments" ON public.os_anexos FOR ALL TO authenticated USING (public.has_access(auth.uid())) WITH CHECK (public.has_access(auth.uid()));

-- Histórico de edições
CREATE TABLE public.os_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX os_edit_log_os_idx ON public.os_edit_log (os_id, changed_at);
GRANT SELECT ON public.os_edit_log TO authenticated;
GRANT ALL ON public.os_edit_log TO service_role;
ALTER TABLE public.os_edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read OS edit log" ON public.os_edit_log FOR SELECT TO authenticated USING (public.has_access(auth.uid()));

-- ============================================================
-- 5. TRIGGERS E FUNÇÕES
-- ============================================================

-- Geração automática de número
CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := nextval('public.os_numero_seq');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER os_generate_number BEFORE INSERT ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.generate_os_number();

-- Validação de regras de edição e transição de status
CREATE OR REPLACE FUNCTION public.enforce_os_edit_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role app_role; _allowed_next int[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid();
  IF _role IS NULL THEN RAISE EXCEPTION 'Sem permissão para alterar ordens de serviço'; END IF;

  -- Archive/unarchive: master only
  IF (NEW.archived_at IS DISTINCT FROM OLD.archived_at) AND _role <> 'master' THEN
    RAISE EXCEPTION 'Apenas master pode arquivar ou restaurar ordens de serviço';
  END IF;

  -- Status transitions
  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    SELECT CASE OLD.status_id
      WHEN 2 THEN ARRAY[4, 3]::int[]       -- Para aprovação → Aprovada, Cancelada
      WHEN 4 THEN ARRAY[1, 3]::int[]       -- Aprovada → Em andamento, Cancelada
      WHEN 1 THEN ARRAY[7]::int[]          -- Em andamento → Finalizada
      WHEN 6 THEN ARRAY[2, 3]::int[]       -- Em cotação → Para aprovação, Cancelada
      WHEN 5 THEN ARRAY[1, 3]::int[]       -- Aguardando entrega → Em andamento, Cancelada
      ELSE ARRAY[]::int[]
    END INTO _allowed_next;

    IF NOT (NEW.status_id = ANY(_allowed_next)) AND _role <> 'master' THEN
      RAISE EXCEPTION 'Transição de status não permitida para este perfil';
    END IF;

    -- Finalization requires Em andamento status
    IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL THEN
      IF OLD.status_id <> 1 AND _role <> 'master' THEN
        RAISE EXCEPTION 'Apenas OS Em andamento pode ser finalizada';
      END IF;
      NEW.closed_at := now();
    END IF;
  END IF;

  -- Numero is immutable
  IF NEW.numero IS DISTINCT FROM OLD.numero THEN
    RAISE EXCEPTION 'Número da OS é imutável';
  END IF;

  -- Oficina cannot change certain fields
  IF _role = 'oficina' THEN
    NEW.store_id := OLD.store_id;
    NEW.tipo_id := OLD.tipo_id;
    NEW.centro_custo_id := OLD.centro_custo_id;
    NEW.contrato_id := OLD.contrato_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER os_enforce_edit_rules BEFORE UPDATE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.enforce_os_edit_rules();

-- Log de alterações
CREATE OR REPLACE FUNCTION public.log_os_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _key text; _old text; _new text;
BEGIN
  IF current_setting('app.os_bulk_update', true) = '1' THEN RETURN NEW; END IF;
  FOR _key IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
    _old := (to_jsonb(OLD) ->> _key);
    _new := (to_jsonb(NEW) ->> _key);
    IF _old IS DISTINCT FROM _new AND _key NOT IN ('updated_at', 'created_at') THEN
      INSERT INTO public.os_edit_log (os_id, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, _key, _old, _new, auth.uid());
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER os_log_changes AFTER UPDATE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.log_os_changes();

-- Recalcular totais quando itens mudam
CREATE OR REPLACE FUNCTION public.recompute_os_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _os_id uuid;
BEGIN
  _os_id := COALESCE(NEW.os_id, OLD.os_id);
  UPDATE public.ordens_servico SET
    total_servico = (SELECT coalesce(sum(total), 0) FROM public.os_itens WHERE os_id = _os_id AND item_type = 'service'),
    total_estoque = (SELECT coalesce(sum(total), 0) FROM public.os_itens WHERE os_id = _os_id AND item_type = 'part'),
    total_os = (SELECT coalesce(sum(total), 0) FROM public.os_itens WHERE os_id = _os_id),
    updated_at = now()
  WHERE id = _os_id;
  RETURN NEW;
END $$;

CREATE TRIGGER os_recompute_totals AFTER INSERT OR UPDATE OR DELETE ON public.os_itens
FOR EACH ROW EXECUTE FUNCTION public.recompute_os_totals();

-- ============================================================
-- 6. SEED DATA
-- ============================================================

-- 20 tipos de O.S.
INSERT INTO public.os_tipos (id, code, label, sort_order) VALUES
  (35, 'ADAPTACAO', 'Adaptação', 1),
  (7, 'ASSIST_MANUTENCAO', 'Assist. manutenção', 2),
  (2, 'AVARIAS', 'Avarias', 3),
  (9, 'COMBUSTIVEL', 'Combustível', 4),
  (4, 'INST_ACESSORIOS', 'Inst. acessórios', 5),
  (6, 'LAVAGEM', 'Lavagem', 6),
  (1, 'M_CORRETIVA', 'M. corretiva', 7),
  (37, 'M_PREVENTIVA', 'M. preventiva', 8),
  (32, 'MANUT_INTERNA', 'Manut. interna locadora', 9),
  (41, 'PNEUS', 'Pneus', 10),
  (33, 'RASTREADOR', 'Rastreador', 11),
  (40, 'REPARO_DIVERSOS', 'Reparo diversos', 12),
  (38, 'RETORNO_SERVICOS', 'Retorno de serviços', 13),
  (3, 'REVISAO_CONCESSIONARIA', 'Revisão concessionária', 14),
  (8, 'SERV_GARANTIA', 'Serv. em garantia', 15),
  (31, 'FUNILARIA', 'Funilaria', 16),
  (34, 'GUINCHO', 'Guincho', 17),
  (36, 'SERVICOS_EXTERNOS', 'Serviços externos', 18),
  (39, 'SERVICOS_INTERIOR', 'Serviços interior', 19),
  (5, 'SERVICOS_ELETRICOS', 'Serviços elétricos', 20)
ON CONFLICT (id) DO NOTHING;

-- 7 status
INSERT INTO public.os_status (id, code, label, color, allows_finalize, sort_order) VALUES
  (2, 'PARA_APROVACAO', 'Para aprovação', '#f59e0b', false, 1),
  (4, 'APROVADA', 'Aprovada', '#3b82f6', false, 2),
  (1, 'EM_ANDAMENTO', 'Em andamento', '#10b981', true, 3),
  (6, 'EM_COTACAO', 'Em cotação', '#8b5cf6', false, 4),
  (5, 'AGUARDANDO_ENTREGA', 'Aguardando entrega', '#ec4899', false, 5),
  (3, 'CANCELADA', 'Cancelada', '#6b7280', false, 6),
  (7, 'FINALIZADA', 'Finalizada', '#059669', false, 7)
ON CONFLICT (id) DO NOTHING;

-- 12 posições operacionais
INSERT INTO public.posicoes_operacionais (code, label, is_initial, is_final) VALUES
  ('OR', 'Oficina Revisão', true, false),
  ('OT', 'Oficina Terceiros', true, false),
  ('OQ', 'Pátio Controle Qualidade', true, false),
  ('OF', 'Pintura e Funilaria', true, false),
  ('DQ', 'Disponível QC', false, true),
  ('DC', 'Disponível Comercial', false, true),
  ('DP', 'Disponível Pátio', false, true),
  ('DL', 'Disponível Lavagem', false, true),
  ('DT', 'Disponível Terceiros', false, true),
  ('DV', 'Disponível Vendas', false, true),
  ('DR', 'Disponível Revisão', false, true),
  ('D0', 'Disponível', false, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 7. FUNÇÕES RPC (SECURITY DEFINER)
-- ============================================================

-- Criar O.S.
CREATE OR REPLACE FUNCTION public.os_create(
  _plate text, _km integer, _store_id integer, _workshop_id uuid,
  _tipo_id integer, _centro_custo_id uuid, _tipo_atendimento text DEFAULT 'N',
  _appointment_id uuid DEFAULT NULL, _hora time DEFAULT NULL,
  _tanque_inicial text DEFAULT NULL, _gnv_inicial text DEFAULT NULL,
  _posicao_inicial text DEFAULT NULL, _contrato_id integer DEFAULT NULL,
  _condutor_nome text DEFAULT NULL, _condutor_contato text DEFAULT NULL,
  _nf text DEFAULT NULL, _recuperado boolean DEFAULT NULL,
  _externa_ref text DEFAULT NULL, _obs1 text DEFAULT NULL, _obs2 text DEFAULT NULL,
  _previsao_conclusao date DEFAULT NULL, _pagamento_metodo text DEFAULT NULL,
  _solicitante text DEFAULT NULL, _autorizacao text DEFAULT NULL,
  _pendencia boolean DEFAULT false, _pendencia_desc text DEFAULT NULL,
  _executado text DEFAULT 'N', _autorizado_cliente text DEFAULT 'Pendente'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _numero integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'atendimento')) THEN
    RAISE EXCEPTION 'Seu perfil não pode criar ordens de serviço';
  END IF;

  INSERT INTO public.ordens_servico (
    plate, km, store_id, workshop_id, tipo_id, centro_custo_id, tipo_atendimento,
    appointment_id, hora, tanque_inicial, gnv_inicial, posicao_inicial,
    contrato_id, condutor_nome, condutor_contato, nf, recuperado, externa_ref,
    obs1, obs2, previsao_conclusao, pagamento_metodo, solicitante, autorizacao,
    pendencia, pendencia_desc, executado, autorizado_cliente, created_by
  ) VALUES (
    upper(regexp_replace(coalesce(_plate, ''), '[^A-Z0-9]', '', 'g')),
    _km, _store_id, _workshop_id, _tipo_id, _centro_custo_id, _tipo_atendimento,
    _appointment_id, _hora, _tanque_inicial, _gnv_inicial, _posicao_inicial,
    _contrato_id, _condutor_nome, _condutor_contato, _nf, _recuperado, _externa_ref,
    _obs1, _obs2, _previsao_conclusao, _pagamento_metodo, _solicitante, _autorizacao,
    _pendencia, _pendencia_desc, _executado, _autorizado_cliente, auth.uid()
  ) RETURNING id, numero INTO _id, _numero;

  -- Se veio de agendamento, atualiza os_number
  IF _appointment_id IS NOT NULL THEN
    UPDATE public.appointments SET os_number = _numero WHERE id = _appointment_id;
  END IF;

  RETURN jsonb_build_object('id', _id, 'numero', _numero);
END $$;

REVOKE EXECUTE ON FUNCTION public.os_create FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_create TO authenticated;

-- Atualizar O.S.
CREATE OR REPLACE FUNCTION public.os_update(_os_id uuid, _changes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _updated integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar ordens de serviço';
  END IF;

  UPDATE public.ordens_servico SET
    plate = COALESCE((_changes->>'plate')::text, plate),
    km = COALESCE((_changes->>'km')::integer, km),
    store_id = COALESCE((_changes->>'store_id')::integer, store_id),
    workshop_id = COALESCE((_changes->>'workshop_id')::uuid, workshop_id),
    tipo_id = COALESCE((_changes->>'tipo_id')::integer, tipo_id),
    centro_custo_id = COALESCE((_changes->>'centro_custo_id')::uuid, centro_custo_id),
    tipo_atendimento = COALESCE((_changes->>'tipo_atendimento')::text, tipo_atendimento),
    hora = COALESCE((_changes->>'hora')::time, hora),
    tanque_inicial = COALESCE((_changes->>'tanque_inicial')::text, tanque_inicial),
    gnv_inicial = COALESCE((_changes->>'gnv_inicial')::text, gnv_inicial),
    posicao_inicial = COALESCE((_changes->>'posicao_inicial')::text, posicao_inicial),
    contrato_id = COALESCE((_changes->>'contrato_id')::integer, contrato_id),
    condutor_nome = COALESCE((_changes->>'condutor_nome')::text, condutor_nome),
    condutor_contato = COALESCE((_changes->>'condutor_contato')::text, condutor_contato),
    nf = COALESCE((_changes->>'nf')::text, nf),
    recuperado = COALESCE((_changes->>'recuperado')::boolean, recuperado),
    externa_ref = COALESCE((_changes->>'externa_ref')::text, externa_ref),
    obs1 = COALESCE((_changes->>'obs1')::text, obs1),
    obs2 = COALESCE((_changes->>'obs2')::text, obs2),
    previsao_conclusao = COALESCE((_changes->>'previsao_conclusao')::date, previsao_conclusao),
    pagamento_metodo = COALESCE((_changes->>'pagamento_metodo')::text, pagamento_metodo),
    solicitante = COALESCE((_changes->>'solicitante')::text, solicitante),
    autorizacao = COALESCE((_changes->>'autorizacao')::text, autorizacao),
    pendencia = COALESCE((_changes->>'pendencia')::boolean, pendencia),
    pendencia_desc = COALESCE((_changes->>'pendencia_desc')::text, pendencia_desc),
    executado = COALESCE((_changes->>'executado')::text, executado),
    autorizado_cliente = COALESCE((_changes->>'autorizado_cliente')::text, autorizado_cliente)
  WHERE id = _os_id;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated = 0 THEN RAISE EXCEPTION 'OS não encontrada'; END IF;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.os_update FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_update TO authenticated;

-- Transição de status
CREATE OR REPLACE FUNCTION public.os_transition_status(_os_id uuid, _new_status_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para alterar status';
  END IF;

  UPDATE public.ordens_servico SET status_id = _new_status_id WHERE id = _os_id;
  RETURN jsonb_build_object('success', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.os_transition_status FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_transition_status TO authenticated;

-- Finalizar O.S.
CREATE OR REPLACE FUNCTION public.os_finalize(
  _os_id uuid, _km_final integer, _tanque_final text,
  _gnv_final text, _posicao_final text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar OS';
  END IF;

  UPDATE public.ordens_servico SET
    status_id = 7,
    closed_at = now(),
    km_final = _km_final,
    tanque_final = _tanque_final,
    gnv_final = _gnv_final,
    posicao_final = _posicao_final
  WHERE id = _os_id;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.os_finalize FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_finalize TO authenticated;

-- Arquivar O.S. (master only)
CREATE OR REPLACE FUNCTION public.os_archive(_os_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Apenas master pode arquivar ordens de serviço';
  END IF;

  UPDATE public.ordens_servico SET archived_at = now(), archived_by = auth.uid() WHERE id = _os_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.os_archive FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_archive TO authenticated;

-- Adicionar item
CREATE OR REPLACE FUNCTION public.os_item_add(
  _os_id uuid, _description text, _qty numeric, _unit_price numeric,
  _item_type text, _service_code text DEFAULT NULL, _part_code text DEFAULT NULL,
  _budget_account text DEFAULT NULL, _mechanic_name text DEFAULT NULL,
  _classification text DEFAULT NULL, _requester text DEFAULT NULL,
  _authorizer text DEFAULT NULL, _observation text DEFAULT NULL,
  _movement_date date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para adicionar itens';
  END IF;

  INSERT INTO public.os_itens (
    os_id, description, qty, unit_price, item_type, service_code, part_code,
    budget_account, mechanic_name, classification, requester, authorizer,
    observation, movement_date
  ) VALUES (
    _os_id, _description, _qty, _unit_price, _item_type, _service_code, _part_code,
    _budget_account, _mechanic_name, _classification, _requester, _authorizer,
    _observation, _movement_date
  ) RETURNING id INTO _id;

  RETURN jsonb_build_object('id', _id);
END $$;

REVOKE EXECUTE ON FUNCTION public.os_item_add FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_item_add TO authenticated;

-- Atualizar item
CREATE OR REPLACE FUNCTION public.os_item_update(_item_id uuid, _changes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar itens';
  END IF;

  UPDATE public.os_itens SET
    approval = COALESCE((_changes->>'approval')::text, approval),
    description = COALESCE((_changes->>'description')::text, description),
    qty = COALESCE((_changes->>'qty')::numeric, qty),
    unit_price = COALESCE((_changes->>'unit_price')::numeric, unit_price),
    item_type = COALESCE((_changes->>'item_type')::text, item_type),
    service_code = COALESCE((_changes->>'service_code')::text, service_code),
    part_code = COALESCE((_changes->>'part_code')::text, part_code),
    budget_account = COALESCE((_changes->>'budget_account')::text, budget_account),
    mechanic_name = COALESCE((_changes->>'mechanic_name')::text, mechanic_name),
    classification = COALESCE((_changes->>'classification')::text, classification),
    requester = COALESCE((_changes->>'requester')::text, requester),
    authorizer = COALESCE((_changes->>'authorizer')::text, authorizer),
    observation = COALESCE((_changes->>'observation')::text, observation),
    movement_date = COALESCE((_changes->>'movement_date')::date, movement_date),
    updated_at = now()
  WHERE id = _item_id;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.os_item_update FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_item_update TO authenticated;

-- Excluir item
CREATE OR REPLACE FUNCTION public.os_item_delete(_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para excluir itens';
  END IF;

  DELETE FROM public.os_itens WHERE id = _item_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.os_item_delete FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_item_delete TO authenticated;

-- Aprovar/desaprovar todos os itens
CREATE OR REPLACE FUNCTION public.os_items_batch_approve(_os_id uuid, _approval text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar itens';
  END IF;

  UPDATE public.os_itens SET approval = _approval, updated_at = now() WHERE os_id = _os_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.os_items_batch_approve FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_items_batch_approve TO authenticated;

-- Buscar O.S. com filtros
CREATE OR REPLACE FUNCTION public.search_ordens_servico(
  _filters jsonb DEFAULT '{}'::jsonb,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 20
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _result jsonb; _total integer; _offset integer := (_page - 1) * _page_size;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para buscar ordens de serviço';
  END IF;

  SELECT count(*) INTO _total
  FROM public.ordens_servico os
  WHERE os.archived_at IS NULL
    AND (_filters->>'status_id' IS NULL OR os.status_id = ANY(string_to_array(_filters->>'status_id', ',')::int[]))
    AND (_filters->>'tipo_id' IS NULL OR os.tipo_id = ANY(string_to_array(_filters->>'tipo_id', ',')::int[]))
    AND (_filters->>'numero' IS NULL OR os.numero::text LIKE '%' || (_filters->>'numero') || '%')
    AND (_filters->>'centro_custo_id' IS NULL OR os.centro_custo_id::text = ANY(string_to_array(_filters->>'centro_custo_id', ',')))
    AND (_filters->>'recuperado' IS NULL OR os.recuperado = (_filters->>'recuperado')::boolean)
    AND (_filters->>'externa_ref' IS NULL OR os.externa_ref ILIKE '%' || (_filters->>'externa_ref') || '%')
    AND (_filters->>'data_inicial' IS NULL OR os.opened_at >= (_filters->>'data_inicial')::date)
    AND (_filters->>'data_final' IS NULL OR os.opened_at <= ((_filters->>'data_final')::date + interval '1 day'))
    AND (_filters->>'palavra_chave' IS NULL OR (os.plate ILIKE '%' || (_filters->>'palavra_chave') || '%' OR os.obs1 ILIKE '%' || (_filters->>'palavra_chave') || '%' OR os.obs2 ILIKE '%' || (_filters->>'palavra_chave') || '%'))
    AND (_filters->>'workshop_id' IS NULL OR os.workshop_id::text = ANY(string_to_array(_filters->>'workshop_id', ',')))
    AND (_filters->>'com_pendencia' IS NULL OR os.pendencia = (_filters->>'com_pendencia')::boolean)
    AND (_filters->>'store_id' IS NULL OR os.store_id = ANY(string_to_array(_filters->>'store_id', ',')::int[]))
    AND (_filters->>'plate' IS NULL OR os.plate ILIKE '%' || upper(regexp_replace(_filters->>'plate', '[^A-Z0-9]', '', 'g')) || '%')
    AND (_filters->>'tipo_atendimento' IS NULL OR os.tipo_atendimento = ANY(string_to_array(_filters->>'tipo_atendimento', ',')));

  SELECT jsonb_agg(row_to_json(os_row)) INTO _result
  FROM (
    SELECT os.*, st.label as status_label, st.color as status_color, tp.label as tipo_label,
           w.name as workshop_name, cc.name as centro_custo_name, s.code as store_code
    FROM public.ordens_servico os
    LEFT JOIN public.os_status st ON os.status_id = st.id
    LEFT JOIN public.os_tipos tp ON os.tipo_id = tp.id
    LEFT JOIN public.workshops w ON os.workshop_id = w.id
    LEFT JOIN public.centros_custo cc ON os.centro_custo_id = cc.id
    LEFT JOIN public.sgloc_stores s ON os.store_id = s.store_id
    WHERE os.archived_at IS NULL
      AND (_filters->>'status_id' IS NULL OR os.status_id = ANY(string_to_array(_filters->>'status_id', ',')::int[]))
      AND (_filters->>'tipo_id' IS NULL OR os.tipo_id = ANY(string_to_array(_filters->>'tipo_id', ',')::int[]))
      AND (_filters->>'numero' IS NULL OR os.numero::text LIKE '%' || (_filters->>'numero') || '%')
      AND (_filters->>'centro_custo_id' IS NULL OR os.centro_custo_id::text = ANY(string_to_array(_filters->>'centro_custo_id', ',')))
      AND (_filters->>'recuperado' IS NULL OR os.recuperado = (_filters->>'recuperado')::boolean)
      AND (_filters->>'externa_ref' IS NULL OR os.externa_ref ILIKE '%' || (_filters->>'externa_ref') || '%')
      AND (_filters->>'data_inicial' IS NULL OR os.opened_at >= (_filters->>'data_inicial')::date)
      AND (_filters->>'data_final' IS NULL OR os.opened_at <= ((_filters->>'data_final')::date + interval '1 day'))
      AND (_filters->>'palavra_chave' IS NULL OR (os.plate ILIKE '%' || (_filters->>'palavra_chave') || '%' OR os.obs1 ILIKE '%' || (_filters->>'palavra_chave') || '%' OR os.obs2 ILIKE '%' || (_filters->>'palavra_chave') || '%'))
      AND (_filters->>'workshop_id' IS NULL OR os.workshop_id::text = ANY(string_to_array(_filters->>'workshop_id', ',')))
      AND (_filters->>'com_pendencia' IS NULL OR os.pendencia = (_filters->>'com_pendencia')::boolean)
      AND (_filters->>'store_id' IS NULL OR os.store_id = ANY(string_to_array(_filters->>'store_id', ',')::int[]))
      AND (_filters->>'plate' IS NULL OR os.plate ILIKE '%' || upper(regexp_replace(_filters->>'plate', '[^A-Z0-9]', '', 'g')) || '%')
      AND (_filters->>'tipo_atendimento' IS NULL OR os.tipo_atendimento = ANY(string_to_array(_filters->>'tipo_atendimento', ',')))
    ORDER BY os.opened_at DESC, os.numero DESC
    LIMIT _page_size OFFSET _offset
  ) os_row;

  RETURN jsonb_build_object('rows', COALESCE(_result, '[]'::jsonb), 'total', _total);
END $$;

REVOKE EXECUTE ON FUNCTION public.search_ordens_servico FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_ordens_servico TO authenticated;

-- Obter detalhe completo da O.S.
CREATE OR REPLACE FUNCTION public.os_get_detail(_os_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _os jsonb; _items jsonb; _observations jsonb; _payments jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar ordens de serviço';
  END IF;

  SELECT row_to_json(os_row) INTO _os
  FROM (
    SELECT os.*, st.label as status_label, st.color as status_color, tp.label as tipo_label,
           w.name as workshop_name, cc.name as centro_custo_name, s.code as store_code
    FROM public.ordens_servico os
    LEFT JOIN public.os_status st ON os.status_id = st.id
    LEFT JOIN public.os_tipos tp ON os.tipo_id = tp.id
    LEFT JOIN public.workshops w ON os.workshop_id = w.id
    LEFT JOIN public.centros_custo cc ON os.centro_custo_id = cc.id
    LEFT JOIN public.sgloc_stores s ON os.store_id = s.store_id
    WHERE os.id = _os_id
  ) os_row;

  SELECT jsonb_agg(row_to_json(item_row)) INTO _items
  FROM (SELECT * FROM public.os_itens WHERE os_id = _os_id ORDER BY created_at) item_row;

  SELECT jsonb_agg(row_to_json(obs_row)) INTO _observations
  FROM (SELECT * FROM public.os_observacoes_cliente WHERE os_id = _os_id ORDER BY created_at DESC) obs_row;

  SELECT jsonb_agg(row_to_json(pay_row)) INTO _payments
  FROM (SELECT * FROM public.os_pagamentos WHERE os_id = _os_id ORDER BY created_at DESC) pay_row;

  RETURN jsonb_build_object(
    'os', _os,
    'items', COALESCE(_items, '[]'::jsonb),
    'observations', COALESCE(_observations, '[]'::jsonb),
    'payments', COALESCE(_payments, '[]'::jsonb)
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.os_get_detail FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_get_detail TO authenticated;

-- Listar configurações (tipos, status, centros, etc.)
CREATE OR REPLACE FUNCTION public.os_config_list()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tipos jsonb; _status jsonb; _centros jsonb; _posicoes jsonb; _classificacoes jsonb; _contas jsonb; _autorizadores jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para listar configurações';
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO _tipos FROM (SELECT * FROM public.os_tipos WHERE active = true ORDER BY sort_order) t;
  SELECT jsonb_agg(row_to_json(s)) INTO _status FROM (SELECT * FROM public.os_status ORDER BY sort_order) s;
  SELECT jsonb_agg(row_to_json(c)) INTO _centros FROM (SELECT * FROM public.centros_custo WHERE active = true ORDER BY name) c;
  SELECT jsonb_agg(row_to_json(p)) INTO _posicoes FROM (SELECT * FROM public.posicoes_operacionais WHERE active = true ORDER BY code) p;
  SELECT jsonb_agg(row_to_json(cl)) INTO _classificacoes FROM (SELECT * FROM public.classificacoes_servico WHERE active = true ORDER BY name) cl;
  SELECT jsonb_agg(row_to_json(co)) INTO _contas FROM (SELECT * FROM public.contas_orcamentarias WHERE active = true ORDER BY code) co;
  SELECT jsonb_agg(row_to_json(a)) INTO _autorizadores FROM (SELECT * FROM public.os_autorizadores) a;

  RETURN jsonb_build_object(
    'tipos', COALESCE(_tipos, '[]'::jsonb),
    'status', COALESCE(_status, '[]'::jsonb),
    'centros_custo', COALESCE(_centros, '[]'::jsonb),
    'posicoes', COALESCE(_posicoes, '[]'::jsonb),
    'classificacoes', COALESCE(_classificacoes, '[]'::jsonb),
    'contas', COALESCE(_contas, '[]'::jsonb),
    'autorizadores', COALESCE(_autorizadores, '[]'::jsonb)
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.os_config_list FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_config_list TO authenticated;

-- ============================================================
-- 8. ATUALIZAR user_modules() PARA INCLUIR 'os'
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_modules(_uid uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT CASE
  WHEN _uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid) THEN ARRAY[]::text[]
  WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'master') THEN ARRAY['agenda','historicos','oficina','os']
  WHEN EXISTS (SELECT 1 FROM public.user_sectors WHERE user_id = _uid)
    THEN COALESCE((SELECT array_agg(DISTINCT m ORDER BY m) FROM public.user_sectors us JOIN public.sectors s ON s.id = us.sector_id, unnest(s.modules) m WHERE us.user_id = _uid), ARRAY[]::text[])
  WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'oficina') THEN ARRAY['oficina']
  ELSE ARRAY['agenda','historicos','os'] END $$;