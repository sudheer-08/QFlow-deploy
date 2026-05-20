-- QFlow Queue Management System Migration

-- 1A. Modify the `bookings` table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS token_number integer;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS queue_position integer;

-- Add state machine status (we use varchar to avoid enum issues, or we can use the existing enum. The prompt says varchar(20))
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'scheduled';

-- State transition timestamps 
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS called_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS no_show_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS skipped_at timestamptz;

-- Queue metadata
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_walkin boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_emergency boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS session_date date;

-- We will update session_date for existing bookings
UPDATE public.bookings SET session_date = appointment_time::date WHERE session_date IS NULL;

-- 1B. Token auto-assignment trigger
CREATE OR REPLACE FUNCTION assign_token_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Assign next sequential token for this doctor on this date
  SELECT COALESCE(MAX(token_number), 0) + 1
  INTO NEW.token_number
  FROM public.bookings
  WHERE doctor_id = NEW.doctor_id
    AND session_date = NEW.session_date
    AND status != 'no_show';

  -- queue_position starts equal to token_number
  NEW.queue_position := NEW.token_number;

  -- Set session_date from appointment_time (which acts as slot_time) if not provided
  IF NEW.session_date IS NULL THEN
    NEW.session_date := NEW.appointment_time::date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_assign_token ON public.bookings;
CREATE TRIGGER auto_assign_token
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  WHEN (NEW.token_number IS NULL)
  EXECUTE FUNCTION assign_token_number();


-- 1C. Doctor duration stats table (for ETA accuracy)
-- Modifying the existing doctor_duration_stats to match requirement
ALTER TABLE public.doctor_duration_stats ADD COLUMN IF NOT EXISTS avg_duration_seconds integer NOT NULL DEFAULT 900;
ALTER TABLE public.doctor_duration_stats ADD COLUMN IF NOT EXISTS sample_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.doctor_duration_stats ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure RLS is enabled
ALTER TABLE public.doctor_duration_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read doctor stats" ON public.doctor_duration_stats;
CREATE POLICY "staff read doctor stats"
  ON public.doctor_duration_stats FOR SELECT
  USING (auth.role() IN ('authenticated'));

DROP POLICY IF EXISTS "service role manage stats" ON public.doctor_duration_stats;
CREATE POLICY "service role manage stats"
  ON public.doctor_duration_stats FOR ALL
  USING (auth.role() = 'service_role');


-- 1D. Clinic queue settings (Using existing tenants table which correlates to clinics)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS grace_period_minutes integer DEFAULT 5;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS noshow_threshold_minutes integer DEFAULT 30;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tokens_ahead_notify integer DEFAULT 3;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS walkin_enabled boolean DEFAULT true;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS scheduled_close_time time DEFAULT '20:00:00';

-- RPC for updating doctor duration stats (Part 2D)
CREATE OR REPLACE FUNCTION update_doctor_duration(p_doctor_id uuid, p_actual_duration numeric)
RETURNS jsonb AS $$
DECLARE
  v_old_avg integer;
  v_sample_count integer;
  v_new_avg integer;
BEGIN
  SELECT avg_duration_seconds, sample_count INTO v_old_avg, v_sample_count
  FROM public.doctor_duration_stats
  WHERE doctor_id = p_doctor_id
  LIMIT 1;

  IF NOT FOUND THEN
    v_old_avg := 900;
    v_sample_count := 0;
    
    INSERT INTO public.doctor_duration_stats (doctor_id, visit_type, avg_duration_minutes, avg_duration_seconds, sample_count)
    VALUES (p_doctor_id, 'new'::public.visit_type_enum, 15, 900, 0);
  END IF;

  v_new_avg := (v_old_avg * LEAST(v_sample_count, 50) + p_actual_duration) / (LEAST(v_sample_count, 50) + 1);

  UPDATE public.doctor_duration_stats
  SET avg_duration_seconds = v_new_avg,
      sample_count = LEAST(v_sample_count + 1, 50),
      avg_duration_minutes = ROUND(v_new_avg / 60.0),
      updated_at = now()
  WHERE doctor_id = p_doctor_id;

  RETURN jsonb_build_object('avg_duration_seconds', v_new_avg, 'sample_count', LEAST(v_sample_count + 1, 50));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC for inserting emergency booking (Part 2G)
CREATE OR REPLACE FUNCTION insert_emergency_booking(
  p_clinic_id uuid,
  p_doctor_id uuid,
  p_patient_name text,
  p_patient_phone text,
  p_session_date date
) RETURNS jsonb AS $$
DECLARE
  v_patient_id uuid;
  v_booking_id uuid;
  v_token_number integer;
  v_result jsonb;
BEGIN
  -- Shift all checked_in and scheduled tokens down by 1 in queue position
  UPDATE public.bookings
  SET queue_position = queue_position + 1
  WHERE doctor_id = p_doctor_id
    AND session_date = p_session_date
    AND status IN ('checked_in', 'scheduled');

  -- Create or find patient
  SELECT id INTO v_patient_id FROM public.patients WHERE tenant_id = p_clinic_id AND phone_number = p_patient_phone LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.patients (tenant_id, name, phone_number)
    VALUES (p_clinic_id, p_patient_name, p_patient_phone)
    RETURNING id INTO v_patient_id;
  END IF;

  -- Create new emergency booking (trigger assigns token_number)
  -- We temporarily set queue_position to 0 manually or adjust it after insert
  INSERT INTO public.bookings (
    patient_id, doctor_id, tenant_id, appointment_time, session_date, 
    status, checked_in_at, is_emergency, is_walkin, source,
    patient_name_cache, patient_phone_cache, queue_position
  ) VALUES (
    v_patient_id, p_doctor_id, p_clinic_id, now(), p_session_date,
    'checked_in', now(), true, true, 'walk_in',
    p_patient_name, p_patient_phone, 0
  ) RETURNING id, token_number INTO v_booking_id, v_token_number;

  SELECT row_to_json(b) INTO v_result FROM public.bookings b WHERE id = v_booking_id;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
