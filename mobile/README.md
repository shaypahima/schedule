# Velofit mobile

Hebrew RTL Flutter client for the Velofit coach-booking platform.

## Stack

- Flutter 3.x / Dart 3.12+
- Riverpod 2.x (+ riverpod_generator) — [ADR 0001](../docs/adr/0001-riverpod-over-bloc.md)
- `dio` for HTTP, `supabase_flutter` for auth
- Heebo font via `google_fonts`
- Hebrew default locale, forced `Directionality.rtl` at app root

## Running

Use the bundled VS Code launch configs in `.vscode/launch.json`:
- **Velofit (dev)** — includes `DEV_MODE` + dev login panel + 8 pre-seeded trainees + 1 coach
- **Velofit (prod-like, no dev panel)** — plain login screen only

Or from the CLI:

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://<ref>.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<publishable-key> \
  --dart-define=API_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=DEV_MODE=true \
  --dart-define=DEV_PASSWORD=devpassword123 \
  ...
```

`10.0.2.2` is the Android emulator's loopback to host. iOS simulator uses `localhost`.

## Env vars (compile-time, read via `String.fromEnvironment`)

| Key | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase publishable key |
| `API_BASE_URL` | Next.js backend base (default `http://localhost:3000`) |
| `DEV_MODE` | `true` shows the in-app dev login panel; production builds omit this |
| `DEV_PASSWORD` | Shared password for all dev users |
| `DEV_TRAINEE_EMAILS` | Comma-separated list of seeded trainee emails |
| `DEV_TRAINEE_NAMES` | Comma-separated list of names (positional with EMAILS) |
| `DEV_COACH_EMAIL` | Dev coach login |
| `DEV_COACH_NAME` | Dev coach display name |

Backend env vars live in `../.env.local` (gitignored). See `../.env.example`.

## Tests

```bash
flutter test
```

Widget tests cover login (render, success nav, failure error), profile (trainee/coach role labels, error), dev panel (button rendering, tap → signIn).

CI: `.github/workflows/mobile.yml` runs `flutter test` on PRs touching `mobile/**`.

## Project layout

```
lib/
├── main.dart                    # bootstrap + Supabase.initialize
├── app.dart                     # MaterialApp, theme, RTL, Hebrew locale
├── config/
│   └── env.dart                 # String.fromEnvironment wrappers
└── features/
    ├── auth/
    │   ├── auth_repository.dart
    │   └── login_screen.dart
    ├── profile/
    │   ├── profile.dart
    │   ├── profile_repository.dart
    │   └── profile_screen.dart
    └── dev/
        └── dev_login_panel.dart  # DEV_MODE only; compile-stripped in prod
```
