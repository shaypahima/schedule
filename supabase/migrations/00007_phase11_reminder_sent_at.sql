-- Phase 11: 1h-before reminders cron
-- Nullable timestamp; set when reminder push has fired so cron is idempotent.
alter table bookings
  add column if not exists reminder_sent_at timestamptz;

create index if not exists bookings_reminder_pending_idx
  on bookings (slot_id)
  where status = 'confirmed' and reminder_sent_at is null;
