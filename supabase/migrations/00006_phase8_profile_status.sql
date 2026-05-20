-- Phase 8: trainee invite lifecycle.
-- Status enum tracks where each trainee is in the invite flow:
--   pending      → invite sent, trainee hasn't signed in yet
--   active       → has signed in at least once and can book
--   deactivated  → coach disabled them; existing bookings retained

alter table profiles
  add column if not exists status text not null default 'active'
  check (status in ('pending', 'active', 'deactivated'));

-- Backfill: existing profiles whose is_active=false were "deactivated"
update profiles set status = 'deactivated' where is_active = false;
