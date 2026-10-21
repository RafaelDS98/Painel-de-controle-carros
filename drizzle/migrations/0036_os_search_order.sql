DO $do$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='search_ordens_servico' LIMIT 1;
  def := replace(def, 'ORDER BY os.opened_at DESC, os.numero DESC',
    'ORDER BY CASE WHEN f->>''order'' = ''asc'' THEN os.opened_at END ASC, CASE WHEN f->>''order'' = ''asc'' THEN os.numero END ASC, os.opened_at DESC, os.numero DESC');
  EXECUTE def;
END $do$;