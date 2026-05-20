-- Phase 1: restore Supabase Auth coupling, add email column, re-enable RLS.
-- Reverses the relaxations in 00003 (which existed for the now-removed mock-auth path).
-- ADR 0003: dev mode now uses real Supabase Auth, so profiles must again be
-- tightly coupled to auth.users.
--
-- Idempotent: safe to run against a fresh DB (where 00003 never ran) or one
-- that already has 00003 applied.

-- 1. Restore FK profiles.id → auth.users(id)
alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- 2. Restore FK bookings.trainee_id → profiles(id)
alter table bookings drop constraint if exists bookings_trainee_id_fkey;
alter table bookings
  add constraint bookings_trainee_id_fkey
  foreign key (trainee_id) references profiles(id) on delete cascade;

-- 3. Add email column (nullable while existing rows have none; new rows fill it)
alter table profiles add column if not exists email text;

create unique index if not exists profiles_email_unique
  on profiles (email) where email is not null;

-- 4. Relax phone NOT NULL (phone column is being phased out in Phase 12;
-- dev users seeded via Supabase Admin API have no phone)
alter table profiles alter column phone drop not null;

-- 5. Re-enable RLS that 00003 disabled
alter table profiles enable row level security;
alter table slots enable row level security;
alter table bookings enable row level security;
alter table edit_log enable row level security;
alter table coach_settings enable row level security;
