-- Function to update doctor's average consultation duration
CREATE OR REPLACE FUNCTION update_doctor_duration(p_doctor_id uuid, p_actual_duration integer)
RETURNS TABLE(avg_duration_seconds integer, sample_count integer) AS $$
DECLARE
    v_avg_duration integer;
    v_sample_count integer;
    new_avg float;
BEGIN
    -- Upsert the stats row for the doctor if it doesn't exist
    INSERT INTO public.doctor_duration_stats (doctor_id)
    VALUES (p_doctor_id)
    ON CONFLICT (doctor_id) DO NOTHING;

    -- Get current stats
    SELECT ds.avg_duration_seconds, ds.sample_count
    INTO v_avg_duration, v_sample_count
    FROM public.doctor_duration_stats ds
    WHERE ds.doctor_id = p_doctor_id;

    -- Calculate new rolling average, capped at 50 samples
    new_avg := ( (v_avg_duration * LEAST(v_sample_count, 50)) + p_actual_duration ) / (LEAST(v_sample_count, 50) + 1.0);

    -- Update the stats
    UPDATE public.doctor_duration_stats
    SET
        avg_duration_seconds = ROUND(new_avg),
        sample_count = v_sample_count + 1,
        updated_at = now()
    WHERE doctor_id = p_doctor_id
    RETURNING doctor_duration_stats.avg_duration_seconds, doctor_duration_stats.sample_count
    INTO avg_duration_seconds, sample_count;

    RETURN QUERY SELECT avg_duration_seconds, sample_count;
END;
$$ LANGUAGE plpgsql;

-- Function to insert an emergency booking and shift the queue
CREATE OR REPLACE FUNCTION insert_emergency_booking(
    p_clinic_id uuid,
    p_doctor_id uuid,
    p_patient_name text,
    p_patient_phone text,
    p_session_date date
)
RETURNS SETOF public.bookings AS $$
DECLARE
    new_booking_id uuid;
    v_patient_id uuid;
BEGIN
    -- Shift queue positions for all checked_in and scheduled patients for the day
    UPDATE public.bookings
    SET queue_position = queue_position + 1
    WHERE doctor_id = p_doctor_id
      AND session_date = p_session_date
      AND status IN ('checked_in', 'scheduled');

    -- Find or create the patient record
    SELECT id INTO v_patient_id FROM public.patients WHERE phone = p_patient_phone AND clinic_id = p_clinic_id;

    IF v_patient_id IS NULL THEN
        INSERT INTO public.patients (name, phone, clinic_id)
        VALUES (p_patient_name, p_patient_phone, p_clinic_id)
        RETURNING id INTO v_patient_id;
    END IF;

    -- Insert the new emergency booking at the front of the queue
    INSERT INTO public.bookings (
        clinic_id,
        doctor_id,
        patient_id,
        is_emergency,
        is_walkin,
        status,
        checked_in_at,
        session_date,
        queue_position,
        token_number -- This will be auto-assigned by the trigger
    )
    VALUES (
        p_clinic_id,
        p_doctor_id,
        v_patient_id,
        true,
        true,
        'checked_in',
        now(),
        p_session_date,
        1 -- Set as first in queue (trigger will handle token)
    )
    RETURNING id INTO new_booking_id;

    -- The trigger assign_token_number will set the token_number.
    -- We need to re-fetch to return the complete booking record.
    RETURN QUERY SELECT * FROM public.bookings WHERE id = new_booking_id;
END;
$$ LANGUAGE plpgsql;
