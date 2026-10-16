CREATE OR REPLACE FUNCTION public.search_ordens_servico(_filters jsonb DEFAULT '{}'::jsonb, _page integer DEFAULT 1, _page_size integer DEFAULT 20)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _result jsonb; _total integer; _sum numeric;
  _size integer := LEAST(GREATEST(COALESCE(_page_size,20),1),5000);
  _offset integer := (GREATEST(COALESCE(_page,1),1) - 1) * LEAST(GREATEST(COALESCE(_page_size,20),1),5000);
  f jsonb := COALESCE(_filters,'{}'::jsonb);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para buscar ordens de serviço';
  END IF;
  CREATE TEMP TABLE IF NOT EXISTS _os_hits (id uuid) ON COMMIT DROP;
  TRUNCATE _os_hits;
  INSERT INTO _os_hits
  SELECT os.id FROM public.ordens_servico os
  WHERE os.archived_at IS NULL
    AND (f->>'status_id' IS NULL OR os.status_id = ANY(string_to_array(f->>'status_id', ',')::int[]))
    AND (f->>'nao_finalizadas' IS NULL OR os.status_id NOT IN (3,7))
    AND (f->>'tipo_id' IS NULL OR os.tipo_id = ANY(string_to_array(f->>'tipo_id', ',')::int[]))
    AND (f->>'numero' IS NULL OR os.numero::text LIKE '%' || (f->>'numero') || '%')
    AND (f->>'centro_custo_id' IS NULL OR os.centro_custo_id::text = ANY(string_to_array(f->>'centro_custo_id', ',')))
    AND (f->>'recuperado' IS NULL OR COALESCE(os.recuperado,false) = (f->>'recuperado')::boolean)
    AND (f->>'externa_ref' IS NULL OR os.externa_ref ILIKE '%' || (f->>'externa_ref') || '%')
    AND (f->>'data_inicial' IS NULL OR os.opened_at >= (f->>'data_inicial')::date)
    AND (f->>'data_final' IS NULL OR os.opened_at < ((f->>'data_final')::date + 1))
    AND (f->>'palavra_chave' IS NULL OR concat_ws(' ', os.plate, os.obs1, os.obs2, os.modelo, os.operador, os.cliente, os.condutor_nome, os.externa_ref, os.nf, os.pendencia_desc) ILIKE '%' || (f->>'palavra_chave') || '%'
         OR EXISTS (SELECT 1 FROM public.os_itens i WHERE i.os_id = os.id AND i.description ILIKE '%' || (f->>'palavra_chave') || '%'))
    AND (f->>'workshop_id' IS NULL OR os.workshop_id::text = ANY(string_to_array(f->>'workshop_id', ',')))
    AND (f->>'com_pendencia' IS NULL OR os.pendencia = (f->>'com_pendencia')::boolean)
    AND (f->>'store_id' IS NULL OR os.store_id = ANY(string_to_array(f->>'store_id', ',')::int[]))
    AND (f->>'plate' IS NULL OR public.norm_plate(os.plate) LIKE '%' || public.norm_plate(f->>'plate') || '%')
    AND (f->>'tipo_atendimento' IS NULL OR os.tipo_atendimento = ANY(string_to_array(f->>'tipo_atendimento', ',')))
    AND public.os_contrato_match(os, f->>'contrato')
    AND (f->>'pagamento_status' IS NULL OR os.pagamento_status = (f->>'pagamento_status'))
    AND (f->>'montadora' IS NULL OR public.norm_name(os.montadora) = public.norm_name(f->>'montadora'))
    AND (f->>'modelo' IS NULL OR os.modelo ILIKE '%' || (f->>'modelo') || '%')
    AND (f->>'cliente' IS NULL OR os.cliente ILIKE '%' || (f->>'cliente') || '%')
    AND (f->>'numero_compra' IS NULL OR EXISTS (SELECT 1 FROM public.os_compras c WHERE c.os_id = os.id AND c.numero_compra ILIKE '%' || (f->>'numero_compra') || '%'))
    AND (f->>'peca' IS NULL OR EXISTS (SELECT 1 FROM public.os_itens i WHERE i.os_id = os.id AND (i.part_code ILIKE '%' || (f->>'peca') || '%' OR (i.item_type <> 'S' AND i.description ILIKE '%' || (f->>'peca') || '%'))))
    AND (f->>'mecanico' IS NULL OR EXISTS (SELECT 1 FROM public.os_itens i WHERE i.os_id = os.id AND public.norm_name(i.mechanic_name) = public.norm_name(f->>'mecanico')));

  SELECT count(*), COALESCE(sum(os.total_os),0) INTO _total, _sum FROM _os_hits h JOIN public.ordens_servico os ON os.id = h.id;

  SELECT jsonb_agg(row_to_json(r)) INTO _result FROM (
    SELECT os.id, os.numero, os.plate, os.opened_at, os.closed_at, os.status_id, os.km, os.tipo_atendimento, os.pendencia,
           os.previsao_conclusao, os.externa_ref, os.condutor_nome, os.obs1, os.total_os, os.total_compras, os.modelo, os.montadora,
           os.operador, os.cliente, os.pagamento_status, os.contrato_id, os.contrato_ref, os.posicao_inicial, os.nf,
           st.label AS status_label, st.color AS status_color, tp.label AS tipo_label,
           w.name AS workshop_name, cc.name AS centro_custo_name, s.code AS store_code
    FROM _os_hits h JOIN public.ordens_servico os ON os.id = h.id
    LEFT JOIN public.os_status st ON os.status_id = st.id
    LEFT JOIN public.os_tipos tp ON os.tipo_id = tp.id
    LEFT JOIN public.workshops w ON os.workshop_id = w.id
    LEFT JOIN public.centros_custo cc ON os.centro_custo_id = cc.id
    LEFT JOIN public.sgloc_stores s ON os.store_id = s.store_id
    ORDER BY os.opened_at DESC, os.numero DESC
    LIMIT _size OFFSET _offset) r;

  RETURN jsonb_build_object('rows', COALESCE(_result, '[]'::jsonb), 'total', _total, 'sum_total', _sum);
END $function$;