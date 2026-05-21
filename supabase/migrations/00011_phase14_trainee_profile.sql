-- Phase 14 — trainee_profile (1:1 with profiles).
-- Holds the fitness-side fields of a trainee, distinct from auth/profile core.
-- Phase 14 populates: phone (contact, not auth) + intro_text (required at self-signup).
-- Phase 18 fills the rest of the optional fields.

create table if not exists trainee_profile (
  id          uuid primary key references profiles(id) on delete cascade,
  phone       text,
  intro_text  text,
  photo_url   text,
  -- Phase 18 fields:
  date_of_birth date,
  height_cm   int,
  weight_kg   int,
  goals       text,
  medical     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists trainee_profile_intro_idx
  on trainee_profile (id)
  where intro_text is not null;

-- RLS: trainee can read/update only their own row. Coach can read all
-- (writes from backend always use service-role anyway).
alter table trainee_profile enable row level security;

drop policy if exists trainee_profile_self_select on trainee_profile;
create policy trainee_profile_self_select on trainee_profile
  for select using (auth.uid() = id);

drop policy if exists trainee_profile_self_update on trainee_profile;
create policy trainee_profile_self_update on trainee_profile
  for update using (auth.uid() = id);
