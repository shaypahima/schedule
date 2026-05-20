-- Allow profiles to exist without auth.users (for dev/mock auth mode)
alter table profiles drop constraint if exists profiles_id_fkey;

-- Disable RLS for development (re-enable in production)
alter table profiles disable row level security;
alter table slots disable row level security;
alter table bookings disable row level security;
alter table edit_log disable row level security;
alter table coach_settings disable row level security;

-- Drop the FK on bookings.trainee_id → profiles.id so we can use string IDs in dev
-- (profiles still exist, but the FK was blocking inserts in wrong order)
alter table bookings drop constraint if exists bookings_trainee_id_fkey;
