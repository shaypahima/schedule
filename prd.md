## Problem Statement

A personal coach with 25–40 trainees manages all scheduling manually — every Saturday, setting availability for the upcoming Sun–Fri week via WhatsApp and Google Calendar. Trainees cannot self-serve; every booking, cancellation, and reschedule requires direct communication. This does not scale and consumes significant time each week.

The product is delivered as a **Flutter mobile app (iOS + Android)** for both trainees and the coach. **The Next.js project becomes API-only for MVP**; a coach web dashboard is deferred to a post-MVP phase.

## Solution

A **mobile-only Flutter app** (iOS + Android, Hebrew/RTL) where:
- Trainees self-book into the coach's available 60-minute slots (Sun–Fri).
- The coach manages trainees, overrides, and per-week visibility from inside the same app.
- The existing Next.js project is gutted of all UI (`src/app/admin/*`, `src/app/{book,login}/page.tsx`) and retained as an **API-only backend** on Vercel.

The app reads the coach's Google Calendar for availability, writes confirmed bookings back as events, and pushes notifications via FCM. Auth is **email/password + Google Sign-In** (no phone OTP, no Apple Sign-In for now).

**Key constraints:**
- Slots hold 2 trainees by default (couple training), overridable to 3 by coach
- Max 2 sessions per trainee per week
- Max 3 edits (cancel/reschedule) per trainee per week
- 7-hour lockout before session start (coach-overridable)
- Recurring trainees auto-booked every Saturday via cron; skipped if usual slot unavailable
- Google Calendar = single source of truth for availability (no separate working hours setting)
- Timezone: Asia/Jerusalem
- Language: Hebrew throughout, RTL layout
- Coach is notified via FCM push and/or email on cancel/reschedule
- Trainees receive FCM push for booking confirmations + 1h-before reminders. Reminders fan out via a **5-minute cron** (`/api/cron/send-reminders`) querying bookings starting in [60min, 65min] and skipping rows where `reminder_sent_at IS NOT NULL`. ±5 min skew is acceptable for a 1-hour reminder.

## User Stories

### Trainee (mobile)
1. As a trainee, I want to sign up/log in with email+password or Google Sign-In, so I can access the app without OTP friction.
2. As a trainee, I want to see available slots day-by-day (Sun–Fri) in Hebrew/RTL, so I can find a time that works for me.
3. As a trainee, I want to see remaining capacity on each slot (e.g., "נשאר מקום 1"), so I know if I can still book — without seeing other trainees' names.
4. As a trainee, I want to book a session in an available slot, so I can train with my coach.
5. As a trainee, I want to book up to 2 sessions per week.
6. As a trainee, I want to cancel a booked session, so I can free my spot.
7. As a trainee, I want to reschedule a booked session, so I can adjust my plans.
8. As a trainee, I want to see remaining edits this week (out of 3).
9. As a trainee, I want to be prevented from editing within 7 hours of session start.
10. As a trainee, I want to contact my coach from inside the app when locked out (deep link to WhatsApp/phone).
11. As a recurring trainee, I want my usual slot auto-booked weekly.
12. As a recurring trainee, I want to cancel/reschedule my auto-booked session.
13. As a recurring trainee, I want auto-booked sessions to count toward 2/week but NOT 3-edit limit.
14. As a trainee, I want a push notification confirming each booking and a reminder 1 hour before each session.

### Coach (mobile + optional web dashboard)
15. As the coach, I want to see all bookings for the current week in one view.
16. As the coach, I want to manually add a trainee to a slot.
17. As the coach, I want to manually remove a trainee from a slot.
18. As the coach, I want to invite new trainees by email, so they can sign up.
19. As the coach, I want to set a trainee as "recurring" with a preferred day/time.
20. As the coach, I want to override a slot's capacity from 2 to 3.
21. As the coach, I want to override the 7-hour lockout for a specific slot.
22. As the coach, I want to override a trainee's 3-edit limit.
23. As the coach, I want push and/or email notifications on cancel/reschedule.
24. As the coach, I want bookings written to my Google Calendar as events (title = trainee name).
25. As the coach, I want Google Calendar events deleted when trainees cancel.
26. As the coach, I want auto-book cron to run every Saturday automatically.
27. As the coach, I want the auto-book cron to skip recurring trainees whose usual slot is unavailable.
28. As the coach, I want to manage bookings only through the app (not directly in Google Calendar).
29. As the coach, I want an optional **web dashboard** (email login) for bulk trainee management from a desktop browser.

### Future (out of MVP scope but planned)
30. Progress tracking for trainees (workout history, metrics) — coach view.

## Implementation Decisions

### Tech Stack
- **Mobile app:** Flutter 3.x (Dart, Material 3, Hebrew/RTL), iOS + Android from one codebase
- **Backend API:** existing Next.js 16 + TypeScript on Vercel — API-only (no UI pages), REST endpoints consumed by Flutter
- **Database & Auth:** Supabase (Postgres + Supabase Auth: email/password + Google OAuth)
- **Calendar:** Google Calendar API v3 via OAuth2 (server-side, unchanged). **Distinct from Google Sign-In** — the coach's Google Sign-In (auth scope only: `email`, `profile`) and Google Calendar OAuth (write scope: `https://www.googleapis.com/auth/calendar`) are **two separate consent flows on the same Google account**. After signing in, the coach taps "Connect Calendar" in settings to grant Calendar write scope. The server enforces email-match between the signed-in identity and the Calendar OAuth identity to prevent split-brain state.
- **Push notifications:** Firebase Cloud Messaging (FCM) — both platforms
- **i18n:** `flutter_localizations` + ARB files, Hebrew default, `Directionality.rtl`
- **State management (Flutter):** Riverpod 2.x with `riverpod_generator` (code-gen via `build_runner`). Async providers wrap the REST API client; `ProviderContainer.overrideWith` used for test fakes.
- **HTTP client:** `dio` with auth interceptor (Supabase session token)
- **Testing (Flutter):** `flutter_test` (unit/widget), `mocktail`, `integration_test`
- **Testing (backend):** existing Vitest suite retained
- **Timezone:** Asia/Jerusalem (server-side authority; mobile displays in device locale)

### Repository layout (single git repo)
Existing repo `github.com/shaypahima/velofit` is reused as a monorepo. Flutter is added as a sibling directory at the repo root. **No file moves for the existing Next.js code** — zero disruption to 13 phases of git history.
```
velofit/                      (git root — github.com/shaypahima/velofit)
  ├── src/                    Next.js — API only at MVP
  ├── supabase/               migrations
  ├── scripts/                seed, bootstrap-admin, migrate
  ├── plans/                  implementation plans
  ├── mobile/                 NEW — Flutter app (iOS + Android, Dart 3+, Riverpod)
  ├── .github/workflows/
  │   ├── backend.yml         triggers on src/**, package.json, supabase/**
  │   └── mobile.yml          triggers on mobile/**
  └── prd.md
```
Cross-cutting changes (API contract + Flutter client) ship in a single PR.

### Modules

**Mobile app (Flutter)**
- **Auth screen** — email/password + Google Sign-In, signup flow, password reset
- **Booking screen** — day picker (Sun–Fri), slot list with remaining capacity, book/cancel/reschedule actions, remaining edits counter, "contact coach" CTA when locked out
- **Coach screen** (role-gated) — week view, manual add/remove, trainee management, overrides
- **Notifications** — FCM token registration, foreground/background handlers
- **API client** — typed REST client against existing Next.js endpoints, Supabase session token attached via interceptor
- **Hebrew/RTL** — all strings in `arb/he.arb`, RTL forced via `Directionality`

**Backend (existing, retained with auth changes)**
- **Auth API** — remove `/api/auth/send-otp`, `/api/auth/verify-otp`. Supabase email/password + Google OAuth handled client-side via Supabase SDK; backend validates session JWTs.
- **Coach bootstrap** — `COACH_EMAIL` env var on Vercel. When a user signs up (or signs in via Google) with that exact email, a server-side middleware auto-grants `role=coach` on their `profiles` row. The existing `scripts/bootstrap-admin.ts` is retained as a one-time data tool for non-production seeding only. Changing the coach later is a single env var update (and a one-time DB role flip script).
- **Dev-mode auth** — pre-seeded dev users: `DEV_TRAINEE_EMAIL/PASSWORD` and `DEV_COACH_EMAIL/PASSWORD` env vars. Flutter dev build includes a debug-only "Login as Trainee / Login as Coach" panel that calls real Supabase `signInWithPassword`. **No parallel auth code path** — production code path is also the dev path. The legacy `SupabaseDevAuthService` + migration `00003_dev_mode_drop_auth_fk.sql` are removed (FK to `auth.users` restored).
- **Slots, bookings, admin, cron** — all unchanged
- **Trainee invite** — coach invites by **email** via **Supabase email-invite magic link**. Supabase sends the email; clicking the link lets the trainee set a password OR sign in with Google (must match invited email). On first successful login, server inserts a `profiles` row linked to the new `auth.users` id. Coach can re-send invites. Invited-but-not-yet-signed-up trainees stored in a pending state so the coach can set `name`, `is_recurring`, `preferred_day`, `preferred_time` ahead of time.

### Database Schema (key changes from current)

**profiles** — REPLACE `phone` with `email` as primary identifier; DROP `phone` entirely
- `id` (uuid, FK to auth.users)
- `email` (text, unique) — NEW
- `name`, `role`, `is_recurring`, `preferred_day`, `preferred_time`, `is_active`, `created_at` — unchanged

**coach_settings** — ADD `contact_phone` (E.164 format, e.g. `+9725...`). Used by trainees to deep-link via WhatsApp (`https://wa.me/{number}?text={prefilled}`) AND `tel:+{number}` — both buttons rendered side-by-side on the "Contact Coach" UI shown during lockout. Prefilled WhatsApp text is Hebrew and references the locked-out slot time.

**device_tokens** — NEW table for FCM
- `id` (uuid)
- `user_id` (uuid, FK to profiles)
- `token` (text, unique)
- `platform` (enum: ios, android)
- `last_seen` (timestamptz)

All other tables (`slots`, `bookings`, `edit_log`, `coach_settings`) unchanged.

### Key Architectural Decisions
- Flutter consumes the **existing** Next.js REST API — no Dart backend rewrite
- Service layer (`src/lib/services/*`) untouched — biggest preserved value
- Supabase Auth replaces phone OTP entirely — JWT-based session, validated server-side
- Push notifications fan-out happens server-side (Next.js sends to FCM) on cancel/reschedule
- Coach role check moves into a server-side middleware that reads Supabase JWT claims
- Coach web dashboard is **deferred post-MVP** — Next.js is API-only at launch

## Testing Decisions

Tests verify external behavior, not implementation details — resilient to refactoring.

### Mobile (Flutter)
- **Widget tests** — booking screen renders correct slots from fixture API responses, RTL layout, Hebrew strings present
- **Integration tests** — full booking flow with mock API (login → see slots → book → see booking in list)
- **Auth tests** — email/password happy path, Google Sign-In mock, session persistence
- **i18n** — every user-facing string has a Hebrew translation

### Backend (retained + new)
- **Auth** — JWT validation middleware accepts Supabase tokens, rejects expired/invalid
- **Invite flow** — coach invites trainee by email, trainee receives invite, signs up, profile linked
- **FCM** — push fan-out on cancel/reschedule, token registration endpoint
- **Existing booking/slot/auto-book tests** — unchanged, must continue passing

## Out of Scope (MVP)

- WhatsApp integration (beyond deep link from "contact coach")
- Buffer time between sessions
- Private (1-person only) sessions
- Trainee-to-trainee visibility
- Multiple Google Calendars
- Payment processing
- Apple Sign-In (planned post-MVP)
- Multi-coach / multi-business support
- Web app for trainees (mobile-only for trainees)
- Web dashboard for coach (planned post-MVP — reuses Next.js project)
- Progress tracking module (planned post-MVP)
- SMS notifications

## Further Notes

- 25–40 active trainees — the system should handle this comfortably; no scale-to-hundreds requirement
- Apple Developer account ($99/yr) NOT required for MVP since Apple Sign-In is deferred; still required for App Store distribution
- Google Cloud project (free tier) already set up for Calendar API; reuse for Google Sign-In OAuth client (Android + iOS)
- Firebase project (free Spark plan) required for FCM
- Supabase free tier sufficient for this user count
- Branding (logo, colors, fonts) to be provided by the coach
- Domain still TBD (relevant only for web dashboard)
- App Store + Play Store accounts must be set up by the coach before distribution
- **Distribution path: TestFlight (iOS) + Play Console internal testing (Android).** Apple Developer ($99/yr) + Google Play Developer ($25 one-time) accounts are required, but their setup is **deferred until after a stable MVP exists**. MVP development uses local builds (iOS Simulator + Android emulator + tethered physical devices). Distribution-related infrastructure (CI builds, Fastlane, signing) is a separate post-MVP phase.

## Migration from Current State

The current Next.js web app (13 phases shipped, see `git log`) is being repurposed:
- **Kept**: all of `src/lib/services/*`, `src/lib/supabase/*`, `src/app/api/*` (except OTP routes), schema, cron, Google Calendar integration
- **Removed**: ALL `src/app/*` page UI (`admin/*`, `book/page.tsx`, `login/page.tsx`), `/api/auth/send-otp`, `/api/auth/verify-otp`, OTP-specific services
- **Added**: `mobile/` Flutter project, `device_tokens` table, FCM fan-out in notification service, email-based invite flow, Supabase Auth wiring
