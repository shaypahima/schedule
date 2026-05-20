-- Phase 5: coach contact phone for lockout "Contact Coach" CTA.
-- Stored as E.164 (e.g. +972501234567). Nullable while coach hasn't set it.

alter table coach_settings
  add column if not exists contact_phone text;
