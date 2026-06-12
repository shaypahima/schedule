-- Dev-only stubs so the Supabase migrations apply against a bare local
-- Postgres (no GoTrue, no Storage service). The dev server connects as the DB
-- owner, which bypasses RLS — so these objects only need to EXIST for the
-- migration RLS policies to compile; they are never relied on for enforcement.

create schema if not exists auth;

-- Minimal stand-in for Supabase's auth.users (profiles FK to it).
create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- auth.uid() / auth.role(): read from a GUC if a request set one, else safe
-- defaults. Owner connection bypasses RLS, so the return value is immaterial.
create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

create or replace function auth.role() returns text
  language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated')
  $$;
