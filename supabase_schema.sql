-- ============================================================
-- QFlow & AI HealthCare Assistant - Combined Supabase Schema
-- ============================================================

-- Enable extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- ============================================================
-- 1. Custom Types & Enums
-- ============================================================
-- QFlow Types
DO $$ BEGIN
    CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE public.booking_source AS ENUM ('web', 'app', 'phone', 'walk_in');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE public.gender AS ENUM ('male', 'female', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE public.visit_type_enum AS ENUM ('new', 'followup', 'prescription', 'procedure', 'report_review');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AI HealthCare Types
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('patient', 'doctor', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE public.user_status AS ENUM ('Pending', 'Active', 'Inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE public.user_gender AS ENUM ('Male', 'Female', 'none');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. Tables
-- ============================================================
-- AI HealthCare Tables
CREATE TABLE if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

CREATE TABLE if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  lat text,
  lng text,
  created_at timestamptz not null default now()
);

CREATE TABLE if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text,
  username citext not null unique,
  firstname text,
  lastname text,
  email citext not null unique,
  password text,
  birthdate date,
  gender public.user_gender default 'none',
  phone text,
  country text,
  stat text,
  street text,
  zip text,
  creation_date timestamptz,
  payment_date timestamptz,
  payment_plan text,
  is_expired boolean not null default false,
  is_paid boolean not null default true,
  picture text,
  status public.user_status not null default 'Pending',
  confirmation_code text unique,
  role public.user_role,
  speciality text,
  location_id uuid references public.locations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- QFlow Tables
CREATE TABLE IF NOT EXISTS public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name character varying NOT NULL,
    subdomain character varying NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_id uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.doctors (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name character varying NOT NULL,
    specialty character varying,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    user_id uuid REFERENCES auth.users(id),
    qualifications character varying,
    bio text,
    profile_image_url text,
    slug character varying,
    UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name character varying NOT NULL,
    phone_number character varying NOT NULL,
    email character varying,
    date_of_birth date,
    gender public.gender,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    user_id uuid REFERENCES auth.users(id),
    UNIQUE (tenant_id, phone_number)
);

CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    doctor_id uuid NOT NULL REFERENCES public.doctors(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    appointment_time timestamp with time zone NOT NULL,
    source public.booking_source DEFAULT 'web'::public.booking_source,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    patient_name_cache character varying,
    patient_phone_cache character varying,
    visit_type public.visit_type_enum DEFAULT 'new'::public.visit_type_enum
);

CREATE TABLE IF NOT EXISTS public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    doctor_id uuid NOT NULL REFERENCES public.doctors(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    appointment_time timestamp with time zone NOT NULL,
    status public.appointment_status DEFAULT 'pending'::public.appointment_status NOT NULL,
    check_in_time timestamp with time zone,
    consultation_start_time timestamp with time zone,
    consultation_end_time timestamp with time zone,
    queue_position integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    patient_name_cache character varying,
    patient_phone_cache character varying,
    notes text,
    visit_type public.visit_type_enum DEFAULT 'new'::public.visit_type_enum
);

CREATE TABLE IF NOT EXISTS public.staff_pins (
    id bigint NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    pin_hash text NOT NULL,
    role text NOT NULL,
    UNIQUE(user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id bigint NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    appointment_id uuid NOT NULL REFERENCES public.appointments(id) UNIQUE,
    doctor_id uuid NOT NULL REFERENCES public.doctors(id),
    patient_id uuid REFERENCES public.patients(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    overall_rating real,
    wait_time_rating integer,
    consultation_rating integer,
    hygiene_rating integer,
    public_feedback text,
    private_feedback text,
    is_published boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.doctor_daily_schedules (
    id bigint NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    doctor_id uuid NOT NULL REFERENCES public.doctors(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean DEFAULT true,
    UNIQUE(doctor_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.doctor_holidays (
    id bigint NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    doctor_id uuid NOT NULL REFERENCES public.doctors(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    holiday_date date NOT NULL,
    reason text,
    UNIQUE(doctor_id, holiday_date)
);

CREATE TABLE IF NOT EXISTS public.doctor_duration_stats (
    id bigint NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    doctor_id uuid NOT NULL REFERENCES public.doctors(id),
    visit_type public.visit_type_enum NOT NULL,
    avg_duration_minutes integer DEFAULT 15 NOT NULL,
    UNIQUE(doctor_id, visit_type)
);

CREATE TABLE IF NOT EXISTS public.queue_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.users(id),
    doctor_id uuid NOT NULL REFERENCES public.users(id),
    status character varying DEFAULT 'waiting',
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    registration_type character varying,
    arrival_status character varying,
    token_number character varying,
    priority character varying DEFAULT 'routine',
    symptoms text,
    ai_summary text,
    consultation_fee numeric,
    visit_type character varying,
    tracker_url_token character varying,
    arrival_confirmed_at timestamp with time zone,
    called_at timestamp with time zone,
    completed_at timestamp with time zone,
    fee_collected boolean DEFAULT false,
    fee_collected_at timestamp with time zone,
    payment_method character varying,
    actual_wait_mins integer
);

CREATE TABLE IF NOT EXISTS public.consultation_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    doctor_id uuid REFERENCES public.users(id),
    patient_id uuid REFERENCES public.users(id),
    queue_entry_id uuid REFERENCES public.queue_entries(id) ON DELETE CASCADE,
    diagnosis text,
    medicines text,
    instructions text,
    follow_up_date date,
    follow_up_reason text,
    prescription_sent boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (queue_entry_id)
);

CREATE TABLE IF NOT EXISTS public.clinic_holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    date date,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clinic_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid REFERENCES public.users(id),
    queue_entry_id uuid REFERENCES public.queue_entries(id),
    rating integer CHECK (rating >= 1 AND rating <= 5),
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.doctor_slot_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    doctor_id uuid NOT NULL REFERENCES public.users(id),
    slot_duration_mins integer DEFAULT 15,
    morning_start time without time zone,
    morning_end time without time zone,
    evening_start time without time zone,
    evening_end time without time zone,
    consultation_fee numeric,
    is_accepting_appointments boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (doctor_id)
);

CREATE TABLE IF NOT EXISTS public.family_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES public.users(id),
    member_patient_id uuid REFERENCES public.users(id),
    relationship character varying NOT NULL,
    member_name character varying,
    date_of_birth date,
    gender character varying,
    phone character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.follow_ups (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    doctor_id uuid NOT NULL REFERENCES public.users(id),
    patient_id uuid NOT NULL REFERENCES public.users(id),
    queue_entry_id uuid REFERENCES public.queue_entries(id),
    follow_up_date date NOT NULL,
    reason text,
    status character varying DEFAULT 'pending',
    reminder_sent boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.intake_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    appointment_id uuid UNIQUE,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.users(id),
    chief_complaint text,
    complaint_hindi text,
    symptom_tags jsonb,
    current_medicines text,
    allergies text,
    filled_by character varying DEFAULT 'patient',
    ai_summary text,
    priority character varying DEFAULT 'routine',
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.post_visit_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    booking_id uuid,
    doctor_id uuid REFERENCES public.users(id),
    patient_id uuid REFERENCES public.users(id),
    diagnosis text,
    medicines_prescribed jsonb,
    lifestyle_advice text,
    follow_up_instructions text,
    raw_consultation_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id),
    token text NOT NULL UNIQUE,
    platform character varying,
    is_active boolean DEFAULT true,
    last_seen_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.users(id),
    status character varying DEFAULT 'waiting',
    notified_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ============================================================
-- 3. Sequences for ID auto-increment
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.staff_pins_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE public.staff_pins ALTER COLUMN id SET DEFAULT nextval('public.staff_pins_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.reviews_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.doctor_daily_schedules_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE public.doctor_daily_schedules ALTER COLUMN id SET DEFAULT nextval('public.doctor_daily_schedules_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.doctor_holidays_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE public.doctor_holidays ALTER COLUMN id SET DEFAULT nextval('public.doctor_holidays_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.doctor_duration_stats_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE public.doctor_duration_stats ALTER COLUMN id SET DEFAULT nextval('public.doctor_duration_stats_id_seq'::regclass);

-- ============================================================
-- 4. Views
-- ============================================================
CREATE OR REPLACE VIEW public.patient_brief_view AS
 SELECT a.id AS appointment_id,
    a.patient_id,
    a.doctor_id,
    a.tenant_id,
    p.name AS patient_name,
    p.gender,
    p.date_of_birth,
    (date_part('year'::text, age(p.date_of_birth::timestamp with time zone)))::integer AS age,
    ( SELECT count(*) AS count
           FROM public.appointments pa
          WHERE ((pa.patient_id = a.patient_id) AND (pa.status = 'completed'::public.appointment_status))) AS total_visits,
    ( SELECT pa.appointment_time
           FROM public.appointments pa
          WHERE ((pa.patient_id = a.patient_id) AND (pa.status = 'completed'::public.appointment_status))
          ORDER BY pa.appointment_time DESC
         LIMIT 1) AS last_visit_date
   FROM (public.appointments a
     JOIN public.patients p ON ((a.patient_id = p.id)));

CREATE OR REPLACE VIEW public.doctor_live_status AS
 SELECT d.id AS doctor_id,
    d.tenant_id,
    d.name AS doctor_name,
    (EXISTS ( SELECT 1
           FROM public.appointments a
          WHERE ((a.doctor_id = d.id) AND (a.appointment_time::date = (now() AT TIME ZONE 'utc'::text)) AND (a.status <> ALL (ARRAY['cancelled'::public.appointment_status, 'completed'::public.appointment_status, 'no_show'::public.appointment_status]))))) AS is_in_clinic,
    COALESCE(( SELECT a.status::text
           FROM public.appointments a
          WHERE ((a.doctor_id = d.id) AND (a.status = 'in_consultation'::public.appointment_status) AND (a.appointment_time::date = (now() AT TIME ZONE 'utc'::text)))
          ORDER BY a.consultation_start_time DESC
         LIMIT 1), 'available'::text) AS current_status,
    ( SELECT count(*) AS count
           FROM public.appointments a
          WHERE ((a.doctor_id = d.id) AND (a.status = 'checked_in'::public.appointment_status) AND (a.appointment_time::date = (now() AT TIME ZONE 'utc'::text)))) AS waiting_patients,
    ( SELECT avg((EXTRACT(epoch FROM (a.consultation_start_time - a.check_in_time)) / 60.0)) AS avg
           FROM public.appointments a
          WHERE ((a.doctor_id = d.id) AND (a.status = ANY (ARRAY['in_consultation'::public.appointment_status, 'completed'::public.appointment_status])) AND (a.check_in_time IS NOT NULL) AND (a.consultation_start_time IS NOT NULL) AND (a.appointment_time::date = (now() AT TIME ZONE 'utc'::text)))) AS avg_wait_time,
    ( SELECT avg((EXTRACT(epoch FROM (a.consultation_end_time - a.consultation_start_time)) / 60.0)) AS avg
           FROM public.appointments a
          WHERE ((a.doctor_id = d.id) AND (a.status = 'completed'::public.appointment_status) AND (a.consultation_start_time IS NOT NULL) AND (a.consultation_end_time IS NOT NULL) AND (a.appointment_time::date = (now() AT TIME ZONE 'utc'::text)))) AS avg_consultation_time
   FROM public.doctors d;

CREATE OR REPLACE VIEW public.public_doctor_profile_view AS
 SELECT d.id AS doctor_id,
    d.name,
    d.specialty,
    d.qualifications,
    d.bio,
    d.profile_image_url,
    d.slug,
    d.tenant_id,
    t.name AS clinic_name,
    t.subdomain AS clinic_subdomain,
    avg(r.overall_rating) AS average_rating,
    count(r.id) AS total_reviews,
    json_agg(json_build_object('rating', r.overall_rating, 'feedback', r.public_feedback, 'created_at', r.created_at)) FILTER (WHERE r.public_feedback IS NOT NULL) AS reviews
   FROM ((public.doctors d
     LEFT JOIN public.reviews r ON (((d.id = r.doctor_id) AND (r.is_published = true))))
     JOIN public.tenants t ON ((d.tenant_id = t.id)))
  GROUP BY d.id, t.id;

-- ============================================================
-- 5. Functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_available_slots(p_doctor_id uuid, p_date date)
 RETURNS TABLE(slot_time time without time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
    schedule RECORD;
    day_of_week INT;
    start_time_dt TIMESTAMP;
    end_time_dt TIMESTAMP;
    slot_start TIMESTAMP;
    slot_end TIMESTAMP;
    avg_duration INT;
BEGIN
    day_of_week := EXTRACT(ISODOW FROM p_date);

    SELECT *
    INTO schedule
    FROM doctor_daily_schedules dds
    WHERE dds.doctor_id = p_doctor_id
      AND dds.day_of_week = day_of_week
      AND dds.is_active = TRUE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM doctor_holidays dh
        WHERE dh.doctor_id = p_doctor_id
          AND dh.holiday_date = p_date
    ) THEN
        RETURN;
    END IF;

    SELECT COALESCE(AVG(dds.avg_duration_minutes), 15)
    INTO avg_duration
    FROM doctor_duration_stats dds
    WHERE dds.doctor_id = p_doctor_id;

    start_time_dt := p_date + schedule.start_time;
    end_time_dt := p_date + schedule.end_time;

    slot_start := start_time_dt;

    WHILE slot_start < end_time_dt LOOP
        slot_end := slot_start + (avg_duration * interval '1 minute');

        IF NOT EXISTS (
            SELECT 1
            FROM appointments a
            WHERE a.doctor_id = p_doctor_id
              AND a.appointment_time >= slot_start
              AND a.appointment_time < slot_end
              AND a.status NOT IN ('cancelled', 'no_show')
        ) THEN
            slot_time := slot_start::TIME;
            RETURN NEXT;
        END IF;

        slot_start := slot_start + (avg_duration * interval '1 minute');
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_clinic_dashboard_metrics(p_tenant_id uuid, p_date date)
 RETURNS TABLE(metric text, value jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 'total_patients' as metric, jsonb_build_object('count', COUNT(*)) as value
    FROM appointments a
    WHERE a.tenant_id = p_tenant_id AND a.appointment_time::date = p_date
      AND a.status NOT IN ('cancelled');

    RETURN QUERY
    SELECT 'patients_by_status' as metric, jsonb_object_agg(status, count) as value
    FROM (
        SELECT status, COUNT(*) as count
        FROM appointments a
        WHERE a.tenant_id = p_tenant_id AND a.appointment_time::date = p_date
        GROUP BY status
    ) as status_counts;

    RETURN QUERY
    SELECT 'avg_wait_time' as metric, jsonb_build_object('minutes', COALESCE(AVG(EXTRACT(EPOCH FROM (consultation_start_time - check_in_time))/60), 0)) as value
    FROM appointments a
    WHERE a.tenant_id = p_tenant_id AND a.appointment_time::date = p_date
      AND check_in_time IS NOT NULL AND consultation_start_time IS NOT NULL;

    RETURN QUERY
    SELECT 'avg_consultation_time' as metric, jsonb_build_object('minutes', COALESCE(AVG(EXTRACT(EPOCH FROM (consultation_end_time - consultation_start_time))/60), 0)) as value
    FROM appointments a
    WHERE a.tenant_id = p_tenant_id AND a.appointment_time::date = p_date
      AND consultation_start_time IS NOT NULL AND consultation_end_time IS NOT NULL;

    RETURN QUERY
    SELECT 'total_revenue' as metric, jsonb_build_object('amount', 0, 'currency', 'USD') as value;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_advanced_analytics(p_tenant_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(metric text, value jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 'doctor_performance' as metric, jsonb_agg(row_to_json(t)) as value
    FROM (
        SELECT d.name as doctor_name, COUNT(a.id) as patient_count, COALESCE(AVG(EXTRACT(EPOCH FROM (a.consultation_end_time - a.consultation_start_time))/60), 0) as avg_consultation_minutes
        FROM appointments a JOIN doctors d ON a.doctor_id = d.id
        WHERE a.tenant_id = p_tenant_id AND a.appointment_time::date BETWEEN p_start_date AND p_end_date AND a.status = 'completed'
        GROUP BY d.name
    ) t;

    RETURN QUERY
    SELECT 'revenue_by_day' as metric, jsonb_build_object('data', '[]') as value;

    RETURN QUERY
    SELECT 'patient_demographics_age' as metric, jsonb_agg(row_to_json(t)) as value
    FROM (
        SELECT CASE WHEN date_part('year', age(p.date_of_birth)) BETWEEN 0 AND 17 THEN '0-17' WHEN date_part('year', age(p.date_of_birth)) BETWEEN 18 AND 35 THEN '18-35' WHEN date_part('year', age(p.date_of_birth)) BETWEEN 36 AND 55 THEN '36-55' ELSE '56+' END as age_group, COUNT(DISTINCT p.id) as patient_count
        FROM patients p JOIN appointments a ON p.id = a.patient_id
        WHERE a.tenant_id = p_tenant_id AND a.appointment_time::date BETWEEN p_start_date AND p_end_date
        GROUP BY age_group
    ) t;

    RETURN QUERY
    SELECT 'patient_demographics_gender' as metric, jsonb_agg(row_to_json(t)) as value
    
    FROM (
        SELECT p.gender, COUNT(DISTINCT p.id) as patient_count
        FROM patients p JOIN appointments a ON p.id = a.patient_id
        WHERE a.tenant_id = p_tenant_id AND a.appointment_time::date BETWEEN p_start_date AND p_end_date
        GROUP BY p.gender
    ) t;

    RETURN QUERY
    SELECT 'visit_type_distribution' as metric, jsonb_agg(row_to_json(t)) as value
    FROM (
        SELECT a.visit_type, COUNT(a.id) as count FROM appointments a
        WHERE a.tenant_id = p_tenant_id AND a.appointment_time::date BETWEEN p_start_date AND p_end_date
        GROUP BY a.visit_type
    ) t;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_tenant_id uuid, p_pin text)
 RETURNS TABLE(user_id uuid, role text, is_valid boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE pin_record RECORD;
BEGIN
    FOR pin_record IN SELECT sp.user_id, sp.role, sp.pin_hash FROM public.staff_pins sp WHERE sp.tenant_id = p_tenant_id
    LOOP
        IF crypt(p_pin, pin_record.pin_hash) = pin_record.pin_hash THEN
            RETURN QUERY SELECT pin_record.user_id, pin_record.role, TRUE;
            RETURN;
        END IF;
    END LOOP;
    RETURN QUERY SELECT NULL::uuid, NULL::text, FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_queue_positions(p_doctor_id uuid, p_date date)
 RETURNS void LANGUAGE plpgsql
AS $function$
DECLARE r RECORD; q_pos INT := 1;
BEGIN
    FOR r IN SELECT id FROM appointments WHERE doctor_id = p_doctor_id AND appointment_time::date = p_date AND status IN ('confirmed', 'checked_in') ORDER BY appointment_time
    LOOP
        UPDATE appointments SET queue_position = q_pos WHERE id = r.id; q_pos := q_pos + 1;
    END LOOP;
    UPDATE appointments SET queue_position = NULL WHERE doctor_id = p_doctor_id AND appointment_time::date = p_date AND status NOT IN ('confirmed', 'checked_in');
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_booking()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.appointments (booking_id, patient_id, doctor_id, tenant_id, appointment_time, patient_name_cache, patient_phone_cache, notes, status, visit_type)
  VALUES (NEW.id, NEW.patient_id, NEW.doctor_id, NEW.tenant_id, NEW.appointment_time, NEW.patient_name_cache, NEW.patient_phone_cache, NEW.notes, 'confirmed', NEW.visit_type);
  PERFORM update_queue_positions(NEW.doctor_id, NEW.appointment_time::date);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_appointment_status_change()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND NEW.consultation_start_time IS NOT NULL THEN
    NEW.consultation_end_time := now();
  END IF;
  IF NEW.status IN ('cancelled', 'no_show', 'completed') OR OLD.status IN ('cancelled', 'no_show', 'completed') THEN
     PERFORM update_queue_positions(NEW.doctor_id, NEW.appointment_time::date);
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 6. Triggers
-- ============================================================
-- Function to create a new tenant when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenants (owner_id, name, subdomain)
  VALUES (new.id, 'My Clinic', new.id::text); -- Using user ID as a temporary unique subdomain
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function after a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 7. RLS Policies (Row Level Security)
-- ============================================================
-- Add your RLS policies here in the future.

-- ============================================================
-- 8. Safety Updates & Safe Constraints (from AI HealthCare)
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_username_key') then
    alter table public.users add constraint users_username_key unique (username);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'users_email_key') then
    -- Resolve pre-existing duplicate emails so unique constraint creation does not fail.
    with ranked_emails as (
      select
        id,
        email,
        row_number() over (
          partition by lower(email::text)
          order by created_at nulls last, id
        ) as rn
      from public.users
      where email is not null and btrim(email::text) <> ''
    )
    update public.users u
    set email = (
      case
        when position('@' in r.email::text) > 0 then
          split_part(r.email::text, '@', 1) || '+dup-' || substr(u.id::text, 1, 8) || '@' || split_part(r.email::text, '@', 2)
        else
          r.email::text || '+dup-' || substr(u.id::text, 1, 8)
      end
    )
    from ranked_emails r
    where u.id = r.id and r.rn > 1;

    -- Adding the fully completed constraint
    alter table public.users add constraint users_email_key unique (email);
  end if;
end
$$;

-- ============================================================
-- 9. Cron Jobs
-- ============================================================
SELECT cron.schedule('no-show-checker', '*/15 * * * *', $$
  UPDATE appointments
  SET status = 'no_show'
  WHERE status = 'confirmed'
    AND appointment_time < (now() - interval '15 minutes')
    AND check_in_time IS NULL;
$$);

-- ============================================================
-- 10. Grant Permissions
-- ============================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;