-- Coach bio / specialty / years_experience columns on coach_settings.
-- Used by the trainee-side Contact Coach card and the coach's own profile UI.

alter table coach_settings
  add column if not exists bio text,
  add column if not exists specialty text,
  add column if not exists years_experience smallint;
