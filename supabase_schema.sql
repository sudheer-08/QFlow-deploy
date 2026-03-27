-- ============================================================
-- QFlow — Complete Supabase SQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. TENANTS (clinics)
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  subdomain varchar(50) unique not null,
  address text,
  city varchar(50) default 'Chandigarh',
  lat decimal(10,8),
  lng decimal(11,8),
  phone varchar(20),
  open_time time default '09:00',
  close_time time default '20:00',
  specialization varchar(100) default 'Dental',
  rating decimal(2,1) default 4.0,
  total_reviews integer default 0,
  photo_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. USERS (all roles in one table)
create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  name varchar(100) not null,
  email varchar(150),
  phone varchar(20),
  password_hash varchar,
  role varchar(20) not null check (role in ('super_admin','clinic_admin','receptionist','doctor','patient')),
  specialization varchar(100),
  experience_years integer default 5,
  bio text,
  photo_url text,
  date_of_birth date,
  gender varchar(10),
  profile_complete boolean default false,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Index for fast login lookup
create index idx_users_email on users(email);
create unique index idx_users_email_unique on users(lower(email)) where email is not null;
create index idx_users_tenant on users(tenant_id);
create index idx_users_phone_tenant on users(phone, tenant_id);

-- 3. QUEUE ENTRIES (the core table)
create table queue_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  patient_id uuid references users(id),
  doctor_id uuid references users(id),

  -- Token
  token_number varchar(10) not null,
  tracker_url_token varchar(64) unique,

  -- Registration
  registration_type varchar(20) default 'walk_in'
    check (registration_type in ('walk_in', 'self_registered')),
  visit_type varchar(20) default 'first_visit'
    check (visit_type in ('first_visit', 'follow_up')),

  -- Status
  status varchar(20) default 'waiting'
    check (status in ('waiting','called','in_progress','done','skipped','no_show')),
  arrival_status varchar(20) default 'arrived'
    check (arrival_status in ('at_home','en_route','arrived')),
  priority varchar(20) default 'routine'
    check (priority in ('routine','moderate','critical')),

  -- Symptoms & AI
  symptoms text,
  ai_summary text,
  ai_priority_reason text,

  -- Timestamps
  registered_at timestamptz default now(),
  arrival_confirmed_at timestamptz,
  called_at timestamptz,
  completed_at timestamptz,

  -- Analytics
  predicted_wait_mins integer,
  actual_wait_mins integer,
  consultation_fee integer default 0,
  fee_collected boolean default false,
  fee_collected_at timestamptz,
  payment_method varchar(20) default 'cash'
    check (payment_method in ('cash','upi','card','other'))
);

-- Indexes for fast queue queries
create index idx_queue_tenant_date on queue_entries(tenant_id, registered_at);
create index idx_queue_doctor_status on queue_entries(doctor_id, status);
create index idx_queue_tracker on queue_entries(tracker_url_token);
create index idx_queue_status on queue_entries(tenant_id, status);
create unique index idx_queue_unique_token_per_day
on queue_entries(tenant_id, doctor_id, token_number, (date(registered_at)));

-- 4. SELF REGISTRATION SETTINGS
create table self_registration_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade unique,
  is_enabled boolean default true,
  open_time time default '08:00',
  close_time time default '14:00',
  max_remote_per_slot integer default 5,
  require_phone_verify boolean default false,
  created_at timestamptz default now()
);

-- 5. APPOINTMENTS
create table appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  patient_id uuid references users(id),
  doctor_id uuid references users(id),
  appointment_date date not null,
  slot_time time not null,
  slot_duration_mins integer default 20,
  status varchar(20) default 'confirmed'
    check (status in ('pending','confirmed','cancelled','completed','no_show')),
  visit_type varchar(20) default 'first_visit'
    check (visit_type in ('first_visit','follow_up','emergency')),
  symptoms text,
  ai_summary text,
  priority varchar(20) default 'routine',
  payment_status varchar(20) default 'pending'
    check (payment_status in ('pending','paid','refunded','waived')),
  payment_amount integer default 0,
  payment_id varchar(100),
  consultation_fee integer default 0,
  fee_collected boolean default false,
  fee_collected_at timestamptz,
  payment_method varchar(20) default 'cash'
    check (payment_method in ('cash','upi','card','other')),
  checked_in boolean default false,
  no_show boolean default false,
  no_show_at timestamptz,
  notes text,
  token_number varchar(10),
  tracker_url_token varchar(64) unique,
  reminder_sent_1day boolean default false,
  reminder_sent_1hour boolean default false,
  created_at timestamptz default now()
);

create index idx_appointments_date on appointments(tenant_id, appointment_date);
create index idx_appointments_doctor on appointments(doctor_id, appointment_date);
create index idx_appointments_patient on appointments(patient_id);
create index idx_appointments_tracker on appointments(tracker_url_token);
create unique index idx_appointments_unique_slot
on appointments(doctor_id, appointment_date, slot_time)
where status in ('pending', 'confirmed');

-- 6. DOCTOR SLOT SETTINGS
create table doctor_slot_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  doctor_id uuid references users(id) unique,
  slot_duration_mins integer default 20,
  morning_start time default '09:00',
  morning_end time default '13:00',
  evening_start time default '17:00',
  evening_end time default '20:00',
  working_days integer[] default '{1,2,3,4,5,6}',
  consultation_fee integer default 300,
  is_accepting_appointments boolean default true
);

-- 7. CLINIC REVIEWS
create table clinic_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  patient_id uuid references users(id),
  queue_entry_id uuid references queue_entries(id),
  rating integer check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

-- 8. CONSULTATION NOTES
create table consultation_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  doctor_id uuid references users(id),
  patient_id uuid references users(id),
  queue_entry_id uuid references queue_entries(id),
  diagnosis text,
  prescription text,
  notes text,
  follow_up_date date,
  created_at timestamptz default now()
);

create index idx_notes_patient on consultation_notes(patient_id);
create index idx_notes_tenant on consultation_notes(tenant_id);

-- 9. FAMILY MEMBERS
create table family_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  name varchar(100) not null,
  relation varchar(50) default 'Other',
  date_of_birth date,
  gender varchar(10),
  phone varchar(20),
  created_at timestamptz default now()
);

create index idx_family_owner on family_members(owner_id);

-- 10. CLINIC HOLIDAYS
create table clinic_holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  date date not null,
  reason varchar(100) default 'Holiday',
  created_at timestamptz default now(),
  UNIQUE(tenant_id, date)
);

create index idx_holidays_tenant on clinic_holidays(tenant_id, date);

-- 11. CHAT SESSIONS
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references users(id),
  messages jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 12. WAITLIST
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  patient_id uuid references users(id) on delete cascade not null,
  doctor_id uuid references users(id) on delete cascade not null,
  appointment_date date,
  preferred_time time,
  status varchar(20) default 'waiting'
    check (status in ('waiting','notified','expired','booked','removed')),
  notified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique (tenant_id, patient_id, doctor_id, appointment_date)
);

create index idx_waitlist_tenant_status on waitlist(tenant_id, status, created_at);

-- ============================================================
-- INPUT VALIDATION GUARDRAILS (DB-LEVEL)
-- ============================================================

-- Normalize common user-entered fields before validation.
create or replace function normalize_tenant_fields()
returns trigger as $$
begin
  if new.subdomain is not null then
    new.subdomain := lower(trim(new.subdomain));
  end if;

  if new.phone is not null then
    new.phone := regexp_replace(trim(new.phone), '[\s\-\(\)]', '', 'g');
    if new.phone = '' then
      new.phone := null;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_normalize_tenant_fields on tenants;
create trigger trg_normalize_tenant_fields
before insert or update on tenants
for each row execute function normalize_tenant_fields();

create or replace function normalize_user_fields()
returns trigger as $$
begin
  if new.email is not null then
    new.email := lower(trim(new.email));
    if new.email = '' then
      new.email := null;
    end if;
  end if;

  if new.phone is not null then
    new.phone := regexp_replace(trim(new.phone), '[\s\-\(\)]', '', 'g');
    if new.phone = '' then
      new.phone := null;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_normalize_user_fields on users;
create trigger trg_normalize_user_fields
before insert or update on users
for each row execute function normalize_user_fields();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_subdomain_format_chk'
  ) then
    alter table tenants
      add constraint tenants_subdomain_format_chk
      check (subdomain ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tenants_phone_format_chk'
  ) then
    alter table tenants
      add constraint tenants_phone_format_chk
      check (phone is null or phone ~ '^\+?[0-9]{10,15}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_email_format_chk'
  ) then
    alter table users
      add constraint users_email_format_chk
      check (
        email is null
        or email ~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_phone_format_chk'
  ) then
    alter table users
      add constraint users_phone_format_chk
      check (phone is null or phone ~ '^\+?[0-9]{10,15}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_password_hash_format_chk'
  ) then
    alter table users
      add constraint users_password_hash_format_chk
      check (
        password_hash is null
        or password_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
      );
  end if;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Add updated_at columns to all tables for audit trails
alter table tenants add column updated_at timestamptz default now();
alter table users add column updated_at timestamptz default now();
alter table queue_entries add column updated_at timestamptz default now();
alter table self_registration_settings add column updated_at timestamptz default now();
alter table appointments add column updated_at timestamptz default now();
alter table doctor_slot_settings add column updated_at timestamptz default now();
alter table clinic_reviews add column updated_at timestamptz default now();
alter table consultation_notes add column updated_at timestamptz default now();
alter table family_members add column updated_at timestamptz default now();
alter table clinic_holidays add column updated_at timestamptz default now();
alter table waitlist add column updated_at timestamptz default now();

alter table tenants enable row level security;
alter table users enable row level security;
alter table queue_entries enable row level security;
alter table self_registration_settings enable row level security;

-- ============================================================
-- SAMPLE DATA
-- ============================================================

-- Insert a test clinic
insert into tenants (id, name, subdomain, address, city, phone, specialization, rating, total_reviews, open_time, close_time) values
  ('11111111-1111-1111-1111-111111111111', 'City Care Clinic', 'citycare', 'SCO 10, Sector 22, Chandigarh', 'Chandigarh', '+91 98765 43210', 'Dental', 4.0, 0, '09:00', '20:00');

-- Insert admin user (password: admin123)
insert into users (tenant_id, name, email, password_hash, role) values
  ('11111111-1111-1111-1111-111111111111',
   'Admin User',
   'admin@citycare.com',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/qJ5uKSS',
   'clinic_admin');

-- Insert a doctor
insert into users (id, tenant_id, name, email, password_hash, role, specialization, experience_years, bio) values
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'Dr. Priya Sharma',
   'doctor@citycare.com',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/qJ5uKSS',
   'doctor',
   'General Dentistry',
   8,
   'Expert in painless dental treatments');

-- Insert a receptionist
insert into users (tenant_id, name, email, password_hash, role) values
  ('11111111-1111-1111-1111-111111111111',
   'Receptionist',
   'reception@citycare.com',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/qJ5uKSS',
   'receptionist');

-- Insert default slot settings for the doctor
insert into doctor_slot_settings (tenant_id, doctor_id, slot_duration_mins, consultation_fee) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 20, 300);

-- All test accounts use password: admin123
