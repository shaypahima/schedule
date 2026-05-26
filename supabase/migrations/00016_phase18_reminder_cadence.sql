-- Phase 18 (#53): reminder cadence retune
-- Drop the single 1h reminder column + index in favour of three windows:
--   * 24h before slot start
--   * 2h before slot start
--   * 30min after slot end (post-session log prompt)
-- Each column is independently stamped so the same booking can fire three
-- distinct pushes without double-sending.

alter table bookings
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_2h_sent_at timestamptz,
  add column if not exists postsession_prompt_sent_at timestamptz;

drop index if exists bookings_reminder_pending_idx;

create index if not exists bookings_reminder_24h_pending_idx
  on bookings (slot_id)
  where status = 'confirmed' and reminder_24h_sent_at is null;

create index if not exists bookings_reminder_2h_pending_idx
  on bookings (slot_id)
  where status = 'confirmed' and reminder_2h_sent_at is null;

create index if not exists bookings_postsession_pending_idx
  on bookings (slot_id)
  where status = 'confirmed' and postsession_prompt_sent_at is null;

alter table bookings drop column if exists reminder_sent_at;
