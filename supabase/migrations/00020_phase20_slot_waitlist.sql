-- Phase 20 — slot_waitlist (ADR-0012: notify-all, first-to-book wins).
-- A waitlist entry is a notification subscription, NOT a reservation: it holds
-- nothing and expires silently at slot start (filtered at read time, no sweep).

create table if not exists slot_waitlist (
  id          uuid primary key default gen_random_uuid(),
  slot_id     uuid not null references slots(id) on delete cascade,
  trainee_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (slot_id, trainee_id)
);

create index if not exists slot_waitlist_trainee_idx
  on slot_waitlist (trainee_id);

-- RLS: trainees manage only their own entries. Backend uses service-role.
alter table slot_waitlist enable row level security;

drop policy if exists slot_waitlist_trainee_select on slot_waitlist;
create policy slot_waitlist_trainee_select on slot_waitlist
  for select using (trainee_id = auth.uid());
