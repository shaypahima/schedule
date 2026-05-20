# Dev-mode auth uses real Supabase Auth with pre-seeded users, not a parallel mock path

Dev builds of the Flutter app authenticate against **the same Supabase Auth instance** as production, using pre-seeded test users whose credentials live in env vars (`DEV_TRAINEE_EMAIL`/`PASSWORD`, `DEV_COACH_EMAIL`/`PASSWORD`). A debug-only "Login as Trainee / Login as Coach" panel calls real `signInWithPassword`. There is **no parallel auth code path** for dev.

This replaces the previous approach (`SupabaseDevAuthService` + migration `00003_dev_mode_drop_auth_fk.sql`), which let the app bypass `auth.users` entirely in dev. That approach hid auth bugs until production and required a separate code path in services and routes.

## Considered options

- **Mock auth path in dev** (the previous approach) — rejected. Two parallel auth paths drift; bugs surface only in prod. The migration that drops the FK to `auth.users` actively weakens schema integrity.
- **Magic-link dev endpoint** (`/api/dev/login?role=trainee`) — rejected. Same parallel-path problem at the API layer, harder to lock down for prod safety.
- **No bypass at all** — viable, but every hot restart loses session unless we rely on Flutter Secure Storage (which we will anyway). Pre-seeded users + a one-tap login panel removes a small but real friction without compromising the auth path.

## Consequences

- Migration `00003_dev_mode_drop_auth_fk.sql` is reverted — a new migration restores the FK from `profiles.id` to `auth.users.id`.
- `SupabaseDevAuthService` is deleted along with the OTP code path.
- Dev users must exist in Supabase Auth before the Flutter app can authenticate locally — the seed script (`scripts/seed.ts`) is updated to create them via Supabase admin API.
- The dev login panel is gated by a Dart compile-time flag (e.g., `--dart-define=DEV_MODE=true`) so it cannot ship to TestFlight/Play.
