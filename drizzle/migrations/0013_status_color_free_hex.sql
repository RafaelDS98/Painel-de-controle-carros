DO $$
DECLARE _c text;
BEGIN
  FOR _c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.status_options'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%color_token%' LOOP
    EXECUTE format('ALTER TABLE public.status_options DROP CONSTRAINT %I', _c);
  END LOOP;
END $$;
ALTER TABLE public.status_options ADD CONSTRAINT status_options_color_token_check
  CHECK (color_token IN ('status-blue','status-amber','status-orange','status-green','status-purple','status-gray') OR color_token ~ '^#[0-9A-Fa-f]{6}$');