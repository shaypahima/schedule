-- Phase 14 — Approval flow.
-- Extends profile status to allow 'rejected' (coach refused self-signup).
-- Distinct from 'deactivated' (coach removed a previously active trainee).

alter table profiles drop constraint if exists profiles_status_check;
alter table profiles
  add constraint profiles_status_check
  check (status in ('pending', 'active', 'rejected', 'deactivated'));
