-- Phase 19 (#52) — measurement_logs: trainee-owned weight/photo/free-metric log.
-- Coach can read any trainee's rows; trainees rw their own. Backend uses service-role.

create table if not exists measurement_logs (
  id           uuid primary key default gen_random_uuid(),
  trainee_id   uuid not null references profiles(id) on delete cascade,
  logged_at    timestamptz not null default now(),
  weight_kg    numeric(5,2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 500)),
  metrics      jsonb,
  photo_url    text,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists measurement_logs_trainee_logged_idx
  on measurement_logs (trainee_id, logged_at desc);

-- Reject rows where every payload field is null (no-op log).
alter table measurement_logs
  add constraint measurement_logs_not_empty
  check (
    weight_kg is not null
    or metrics is not null
    or photo_url is not null
    or (note is not null and length(trim(note)) > 0)
  );

alter table measurement_logs enable row level security;

drop policy if exists ml_self_select on measurement_logs;
create policy ml_self_select on measurement_logs
  for select using (trainee_id = auth.uid());

drop policy if exists ml_self_insert on measurement_logs;
create policy ml_self_insert on measurement_logs
  for insert with check (trainee_id = auth.uid());

drop policy if exists ml_self_update on measurement_logs;
create policy ml_self_update on measurement_logs
  for update using (trainee_id = auth.uid());

drop policy if exists ml_self_delete on measurement_logs;
create policy ml_self_delete on measurement_logs
  for delete using (trainee_id = auth.uid());
