-- Migration 0026: Pátio da Oficina (Yard)
-- Aplicar no SQL Editor do Supabase antes de testar a tela WorkshopYard

-- 1. Colunas novas em appointments (check-in/check-out)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_note TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_photo_url TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_by UUID REFERENCES profiles(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_out_note TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_out_photo_url TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_out_by UUID REFERENCES profiles(id);

-- 2. Coluna is_own_yard em workshops
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS is_own_yard BOOLEAN DEFAULT FALSE;

-- 3. Colunas show_in_yard / show_external em status_options
ALTER TABLE status_options ADD COLUMN IF NOT EXISTS show_in_yard BOOLEAN DEFAULT FALSE;
ALTER TABLE status_options ADD COLUMN IF NOT EXISTS show_external BOOLEAN DEFAULT FALSE;

-- 4. Tabela check_in_records
CREATE TABLE IF NOT EXISTS check_in_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    os_number INTEGER,
    type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT,
    photo_url TEXT,
    performed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_check_in_records_appointment ON check_in_records(appointment_id);
CREATE INDEX IF NOT EXISTS idx_check_in_records_occurred ON check_in_records(occurred_at DESC);

-- 5. Tabela singleton yard_settings
CREATE TABLE IF NOT EXISTS yard_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    timer_green_hours NUMERIC DEFAULT 4,
    timer_yellow_hours NUMERIC DEFAULT 24,
    check_in_required BOOLEAN DEFAULT TRUE,
    check_out_required BOOLEAN DEFAULT TRUE,
    photo_capture_enabled BOOLEAN DEFAULT TRUE,
    photo_upload_enabled BOOLEAN DEFAULT TRUE,
    photo_max_mb INTEGER DEFAULT 10,
    notification_sound_enabled BOOLEAN DEFAULT TRUE,
    polling_seconds INTEGER DEFAULT 30,
    toast_duration_ms INTEGER DEFAULT 4000,
    new_highlight_minutes INTEGER DEFAULT 5,
    editable_fields JSONB DEFAULT '["status","note","operator","current_deadline","contact","contact_number","issue"]'::JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id),
    CONSTRAINT yard_settings_singleton CHECK (id = 1)
);
INSERT INTO yard_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 6. RPC yard_status_durations — última mudança de status por appointment via edit_log
CREATE OR REPLACE FUNCTION yard_status_durations()
RETURNS TABLE (appointment_id UUID, last_status_change_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT el.appointment_id, MAX(el.created_at) AS last_status_change_at
    FROM edit_log el
    WHERE el.field_changed = 'status'
    GROUP BY el.appointment_id;
$$;

-- 7. Trigger enforce_oficina_editable_fields — bloqueia campos não permitidos para role oficina
CREATE OR REPLACE FUNCTION enforce_oficina_editable_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    _role TEXT;
    _allowed TEXT[];
    _changed_cols TEXT[];
    _col TEXT;
BEGIN
    -- Só atua quando o usuário tem role oficina
    SELECT role INTO _role FROM profiles WHERE id = auth.uid();
    IF _role != 'oficina' THEN RETURN NEW; END IF;

    -- Carrega campos permitidos de yard_settings
    SELECT editable_fields INTO _allowed FROM yard_settings WHERE id = 1;
    IF _allowed IS NULL THEN _allowed := ARRAY['status','note','operator','current_deadline','contact','contact_number','issue']; END IF;

    -- Lista colunas alteradas neste UPDATE
    _changed_cols := ARRAY[]::TEXT[];
    IF OLD.status IS DISTINCT FROM NEW.status THEN _changed_cols := array_append(_changed_cols, 'status'); END IF;
    IF OLD.note IS DISTINCT FROM NEW.note THEN _changed_cols := array_append(_changed_cols, 'note'); END IF;
    IF OLD.operator IS DISTINCT FROM NEW.operator THEN _changed_cols := array_append(_changed_cols, 'operator'); END IF;
    IF OLD.current_deadline IS DISTINCT FROM NEW.current_deadline THEN _changed_cols := array_append(_changed_cols, 'current_deadline'); END IF;
    IF OLD.contact IS DISTINCT FROM NEW.contact THEN _changed_cols := array_append(_changed_cols, 'contact'); END IF;
    IF OLD.contact_number IS DISTINCT FROM NEW.contact_number THEN _changed_cols := array_append(_changed_cols, 'contact_number'); END IF;
    IF OLD.issue IS DISTINCT FROM NEW.issue THEN _changed_cols := array_append(_changed_cols, 'issue'); END IF;
    IF OLD.model IS DISTINCT FROM NEW.model THEN _changed_cols := array_append(_changed_cols, 'model'); END IF;
    IF OLD.brand IS DISTINCT FROM NEW.brand THEN _changed_cols := array_append(_changed_cols, 'brand'); END IF;
    IF OLD.workshop IS DISTINCT FROM NEW.workshop THEN _changed_cols := array_append(_changed_cols, 'workshop'); END IF;
    IF OLD.store IS DISTINCT FROM NEW.store THEN _changed_cols := array_append(_changed_cols, 'store'); END IF;

    -- Verifica se alguma coluna alterada NÃO está na lista permitida
    FOREACH _col IN ARRAY _changed_cols LOOP
        IF NOT (_col = ANY(_allowed)) THEN
            RAISE EXCEPTION 'Perfil Oficina não pode alterar o campo "%". Campos permitidos: %', _col, array_to_string(_allowed, ', ');
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_oficina_editable ON appointments;
CREATE TRIGGER trg_enforce_oficina_editable
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION enforce_oficina_editable_fields();

-- 8. Storage bucket check-in-photos (se ainda não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('check-in-photos', 'check-in-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- RLS para bucket: qualquer usuário autenticado pode upload/download
DROP POLICY IF EXISTS "Auth users can upload check-in photos" ON storage.objects;
CREATE POLICY "Auth users can upload check-in photos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'check-in-photos');
DROP POLICY IF EXISTS "Anyone can view check-in photos" ON storage.objects;
CREATE POLICY "Anyone can view check-in photos"
    ON storage.objects FOR SELECT USING (bucket_id = 'check-in-photos');
DROP POLICY IF EXISTS "Uploader can delete own check-in photos" ON storage.objects;
CREATE POLICY "Uploader can delete own check-in photos"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'check-in-photos' AND owner = auth.uid());