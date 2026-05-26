-- Phase 19 (#52) — session_logs: per-booking post-session feedback (trainee) + coach notes.
-- One row per booking (1:1). Trainee writes/edits feedback; coach writes coach_notes.

create table if not exists session_logs (
  booking_id   uuid primary key references bookings(id) on delete cascade,
  feedback     jsonb,
  coach_notes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists session_logs_updated_idx
  on session_logs (updated_at desc);

alter table session_logs enable row level security;

drop policy if exists sl_trainee_select on session_logs;
create policy sl_trainee_select on session_logs
  for select using (
    exists (
      select 1 from bookings b
      where b.id = session_logs.booking_id
        and b.trainee_id = auth.uid()
    )
  );

drop policy if exists sl_trainee_upsert on session_logs;
create policy sl_trainee_upsert on session_logs
  for insert with check (
    exists (
      select 1 from bookings b
      where b.id = session_logs.booking_id
        and b.trainee_id = auth.uid()
    )
  );

drop policy if exists sl_trainee_update on session_logs;
create policy sl_trainee_update on session_logs
  for update using (
    exists (
      select 1 from bookings b
      where b.id = session_logs.booking_id
        and b.trainee_id = auth.uid()
    )
  );
