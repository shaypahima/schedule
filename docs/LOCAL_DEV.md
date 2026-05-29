# Local dev on native Postgres (no Docker)

Fast local iteration without the slow cloud Supabase round-trip. Selected by
`DB_DRIVER=pg` in `.env.development.local`, which Next.js loads for `npm run dev`
(overriding `.env.local`). **Delete `.env.development.local` to revert to cloud
Supabase** — no code change needed.

> Auth/Storage note: this path replaces Supabase Auth (GoTrue) with a local
> HS256 dev token (`/api/dev/login`) and has **no Storage service** — progress
> photos (#61) are unavailable locally. Everything else (booking, progress,
> notes, coach flows) runs on native Postgres.

## One-time setup (done)

- Postgres 18 installed via scoop: `scoop install postgresql`
- DB created: `createdb -h localhost -U postgres velofit_dev`
- `.env.development.local` holds `DB_DRIVER=pg`, `DATABASE_URL`, `DEV_JWT_SECRET`

## Start / stop Postgres

The scoop install does NOT register a Windows service, so start it per machine
boot (it does not survive a reboot):

```powershell
$PG = "$env:USERPROFILE\scoop\apps\postgresql\current"
& "$PG\bin\pg_ctl.exe" -D "$PG\data" -l "$PG\data\logfile" start   # start
& "$PG\bin\pg_ctl.exe" -D "$PG\data" stop                          # stop
& "$PG\bin\pg_isready.exe" -h localhost -p 5432                    # check
```

## Reset schema + seed

```bash
npm run db:pg:reset   # drop + replay the 18 migrations (skips Storage bucket)
npm run db:pg:seed    # coach + 8 trainees + slots for this + next week
```

`db:pg:reset` installs `auth`/`storage` stubs (`scripts/pg/bootstrap.sql`) so the
Supabase migrations apply against a bare Postgres. The pool connects as DB owner,
so RLS is bypassed (same as the cloud service-role key).

## Run the app

```bash
npm run dev   # http://localhost:3000 — loads .env.development.local (DB_DRIVER=pg)
```

## Dev login (no GoTrue)

`POST /api/dev/login` with `{ email, password }` where `password` = `DEV_PASSWORD`
(from `.env.local`). Returns `{ token, user }`. Send `Authorization: Bearer <token>`
on subsequent requests. Seeded logins: `dev.coach@example.com` (coach) and the
8 `*.example.com` trainees.

## Architecture

`DB_DRIVER=pg` flips three things, all behind the existing seams:
- `getJwtSession` verifies the dev HS256 token instead of calling GoTrue.
- The container (`services/index.ts`) builds `Pg{Booking,Progress,Auth}` stores.
- Direct repos/routes (`profile-repo`, `coach-info-repo`, `notes-repo`,
  `trainee-invite`, `trainee-profile-repo`, `me`, `me/intro`, approve, reject)
  branch on `isPgDriver()`.

Cloud Supabase remains the default when `DB_DRIVER` is unset.
