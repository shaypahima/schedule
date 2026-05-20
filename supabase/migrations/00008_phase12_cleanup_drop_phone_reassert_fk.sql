-- Phase 12: post-mobile-cutover cleanup
-- 1. Drop profiles.phone (mobile login is JWT via Supabase Auth; phone OTP path is gone).
-- 2. Re-assert the profiles.id → auth.users(id) FK that migration 00003 dropped for dev mode.
-- 3. Re-assert bookings.trainee_id → profiles(id) FK.

alter table profiles drop column if exists phone;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_id_fkey'
  ) then
    alter table profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_trainee_id_fkey'
  ) then
    alter table bookings
      add constraint bookings_trainee_id_fkey
      foreign key (trainee_id) references profiles(id) on delete cascade;
  end if;
end $$;
