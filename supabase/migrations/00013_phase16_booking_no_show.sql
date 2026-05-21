-- Phase 16 (stabilized in Phase 15) — extend booking_status enum with 'no_show'.
-- Coach marks past confirmed bookings as no_show; default is the implicit
-- 'attended' state (a past confirmed booking that wasn't flagged).

alter type booking_status add value if not exists 'no_show';
