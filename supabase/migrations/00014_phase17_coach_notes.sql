-- Phase 17 — coach_notes (v1 progress-tracking primitive per ADR-0006).
-- Free-text notes the coach writes about a trainee. Default private;
-- per-note visible_to_trainee toggle exposes a note to the trainee dashboard.

create table if not exists coach_notes (
  id                  uuid primary key default gen_random_uuid(),
  trainee_id          uuid not null references profiles(id) on delete cascade,
  body                text not null check (length(trim(body)) > 0),
  visible_to_trainee  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists coach_notes_trainee_idx
  on coach_notes (trainee_id, created_at desc);

-- RLS: trainees can read only their own visible notes. Backend uses service-role.
alter table coach_notes enable row level security;

drop policy if exists coach_notes_trainee_select on coach_notes;
create policy coach_notes_trainee_select on coach_notes
  for select using (
    trainee_id = auth.uid() and visible_to_trainee = true
  );
