-- ============================================================
-- QFlow Database Migration — Fix All Schema Bugs
-- Run in Supabase SQL Editor
-- All statements are idempotent (safe to re-run)
-- ============================================================

-- ============================================================
-- STEP 1: Fix user_role enum
-- Schema had: ('patient', 'doctor', 'admin')
-- Code uses:  'clinic_admin', 'receptionist', 'super_admin'
-- ============================================================
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'clinic_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'receptionist';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ============================================================
-- STEP 2: Fix user_gender enum
-- Schema had: ('Male', 'Female', 'none')  — wrong case + missing 'other'
-- Code sends: 'male', 'female', 'other', 'prefer_not_to_say'
-- ============================================================
ALTER TYPE public.user_gender ADD VALUE IF NOT EXISTS 'male';
ALTER TYPE public.user_gender ADD VALUE IF NOT EXISTS 'female';
ALTER TYPE public.user_gender ADD VALUE IF NOT EXISTS 'other';
ALTER TYPE public.user_gender ADD VALUE IF NOT EXISTS 'prefer_not_to_say';

-- ============================================================
-- STEP 3: Fix public.users table
-- Root cause of HTTP 500 on /api/auth/register-patient
-- ============================================================

-- 3a: Drop the NOT NULL constraint on username — code never inserts it
ALTER TABLE public.users ALTER COLUMN username DROP NOT NULL;

-- 3b: Add all missing columns the backend code inserts/reads
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tenant_id          uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS password_hash      text,
  ADD COLUMN IF NOT EXISTS date_of_birth      date,
  ADD COLUMN IF NOT EXISTS is_active          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS profile_complete   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS specialization     text,
  ADD COLUMN IF NOT EXISTS experience_years   integer,
  ADD COLUMN IF NOT EXISTS bio                text,
  ADD COLUMN IF NOT EXISTS photo_url          text,
  ADD COLUMN IF NOT EXISTS reminder_sent_1day  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_1hour boolean DEFAULT false;

-- ============================================================
-- STEP 4: Fix public.tenants table
-- Root cause of HTTP 500 on /api/auth/register-clinic
-- Also fixes /api/patient/clinics returning empty/broken data
-- ============================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_active      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS address        text,
  ADD COLUMN IF NOT EXISTS city           text DEFAULT 'Chandigarh',
  ADD COLUMN IF NOT EXISTS lat            text,
  ADD COLUMN IF NOT EXISTS lng            text,
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS specialization text DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS open_time      time WITHOUT TIME ZONE DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS close_time     time WITHOUT TIME ZONE DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS rating         numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews  integer DEFAULT 0;

-- ============================================================
-- STEP 5: Add performance indexes (none existed before)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email       ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id   ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role        ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active   ON public.users(is_active);

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_active    ON public.tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_tenants_city      ON public.tenants(city);

CREATE INDEX IF NOT EXISTS idx_queue_tenant      ON public.queue_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_queue_doctor      ON public.queue_entries(doctor_id);
CREATE INDEX IF NOT EXISTS idx_queue_status      ON public.queue_entries(status);
CREATE INDEX IF NOT EXISTS idx_queue_patient     ON public.queue_entries(patient_id);

CREATE INDEX IF NOT EXISTS idx_appt_doctor       ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appt_patient      ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_tenant       ON public.appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appt_time         ON public.appointments(appointment_time);
CREATE INDEX IF NOT EXISTS idx_appt_status       ON public.appointments(status);

CREATE INDEX IF NOT EXISTS idx_bookings_patient  ON public.bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_doctor   ON public.bookings(doctor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant   ON public.bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_time     ON public.bookings(appointment_time);

-- ============================================================
-- STEP 6: Fix handle_new_user trigger
-- Was: fires on auth.users (Supabase native auth) but app uses public.users
-- Was: blindly created a tenant for EVERY user (patients included)
-- Fix: only create tenant for clinic_admin sign-ups via native auth
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only auto-provision a tenant when a clinic admin signs up via Supabase native auth.
  -- Patients and staff created via the custom auth API do NOT need a tenant auto-created.
  IF (NEW.raw_user_meta_data->>'role') = 'clinic_admin' THEN
    INSERT INTO public.tenants (owner_id, name, subdomain)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'clinic_name', 'My Clinic'),
      NEW.id::text
    )
    ON CONFLICT (subdomain) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STEP 7: Enable RLS and add essential policies
-- The backend uses SUPABASE_SERVICE_KEY which bypasses RLS entirely.
-- These policies are for direct client-side Supabase calls only.
-- ============================================================

-- Enable RLS (safe to call even if already enabled)
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings      ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous or logged in) can browse active clinics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenants' AND policyname = 'Anyone can view active clinics'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Anyone can view active clinics"
        ON public.tenants FOR SELECT
        TO anon, authenticated
        USING (is_active = true);
    $policy$;
  END IF;
END $$;

-- Service role (used by backend) bypasses all RLS automatically — no extra policy needed.

-- ============================================================
-- STEP 8: Verification queries — run these after migration to confirm
-- ============================================================

-- Verify users table has all required columns:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- Verify tenants table has all required columns:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants'
ORDER BY ordinal_position;

-- Verify user_role enum values:
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'public.user_role'::regtype
ORDER BY enumsortorder;

-- Verify user_gender enum values:
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'public.user_gender'::regtype
ORDER BY enumsortorder;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
