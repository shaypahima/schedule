-- Phase 15 — 24h cancel-request flow (replaces 7h hard lockout per ADR-0005).
-- Trainees inside the 24h window submit a booking_change_request; coach approves
-- or rejects. While a request is 'pending' the booking's slot stays held.

create table if not exists booking_change_request (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references bookings(id) on delete cascade,
  requested_new_slot_id uuid references slots(id), -- null = bare cancel; set = reschedule
  reason        text not null check (length(trim(reason)) > 0),
  status        text not null
                check (status in ('pending', 'approved', 'rejected'))
                default 'pending',
  decision_note text,
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references profiles(id)
);

-- Enforce one pending request per booking at a time.
create unique index if not exists bcr_one_pending_per_booking
  on booking_change_request (booking_id)
  where status = 'pending';

create index if not exists bcr_pending_status_idx
  on booking_change_request (requested_at)
  where status = 'pending';

-- RLS: trainees see only their own request rows; backend uses service-role.
alter table booking_change_request enable row level security;

drop policy if exists bcr_self_select on booking_change_request;
create policy bcr_self_select on booking_change_request
  for select using (
    exists (
      select 1 from bookings b
      where b.id = booking_change_request.booking_id
        and b.trainee_id = auth.uid()
    )
  );
