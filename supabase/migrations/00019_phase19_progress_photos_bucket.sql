-- Phase 19 (#52) — progress-photos storage bucket.
-- Trainees write to <user_id>/* folder; coach reads everything.
-- Backend route handlers stamp photo_url on measurement_logs; clients upload directly.

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

-- Trainee can write inside their own folder (path starts with their uid).
drop policy if exists progress_trainee_insert on storage.objects;
create policy progress_trainee_insert on storage.objects
  for insert with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists progress_trainee_select_own on storage.objects;
create policy progress_trainee_select_own on storage.objects
  for select using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists progress_trainee_delete_own on storage.objects;
create policy progress_trainee_delete_own on storage.objects
  for delete using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Coach reads everything in the bucket.
drop policy if exists progress_coach_select on storage.objects;
create policy progress_coach_select on storage.objects
  for select using (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'coach'
    )
  );
