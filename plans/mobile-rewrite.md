# Plan: Flutter Mobile Rewrite

> Source PRD: `prd.md` (commit `f681df9`) — GitHub issue #1
> Supersedes the trainee/coach UI portions of `plans/booking-platform.md`. The Next.js API + service layer + Supabase schema described there are **retained** (with the auth migration noted below).

## Architectural decisions

Durable decisions that apply across all phases. See `docs/adr/0001-0003` for the ADRs.

### Tech & platforms
- **Mobile**: Flutter 3.x + Dart 3+, Riverpod 2.x with `riverpod_generator`, `dio` HTTP client, `supabase_flutter` SDK, `flutter_localizations` with Hebrew default + forced RTL
- **Backend**: existing Next.js 16 + TypeScript on Vercel. API-only at MVP. JWT validation replaces cookie-session auth.
- **Auth**: Supabase Auth — email/password + Google OAuth. No phone OTP. No Apple Sign-In for MVP.
- **Database**: Supabase Postgres. Existing schema retained; auth-related migrations described below.
- **Calendar**: Google Calendar API v3 (server-side OAuth, unchanged). **Distinct from Google Sign-In** (ADR-0002).
- **Push**: Firebase Cloud Messaging (FCM)
- **Repo**: single repo at `github.com/shaypahima/velofit`. Flutter at `mobile/` (sibling to existing `src/`, `supabase/`, etc.).

### Routes (REST API, mostly retained)
| Route | Status | Purpose |
|---|---|---|
| `/api/me` | NEW | Return signed-in profile (used for role-gated routing on mobile) |
| `/api/slots` | retained | GET available slots for trainee view |
| `/api/bookings` | retained | POST book, PATCH reschedule, DELETE cancel |
| `/api/admin/bookings` | retained | Coach week view, manual add/remove |
| `/api/admin/trainees` | retained | Trainee CRUD + invite-by-email |
| `/api/admin/trainees/[id]` | retained | Update trainee (recurring, preferred day/time, deactivate) |
| `/api/admin/edits` | retained | Edit-limit reset |
| `/api/admin/slots` | retained | Capacity + lockout overrides |
| `/api/cron/auto-book` | retained | Saturday recurring auto-book (unchanged) |
| `/api/cron/send-reminders` | NEW | 5-min cron, 1h-before trainee reminders |
| `/api/auth/google/*` | retained | Server-side Google Calendar OAuth flow (separate from Google Sign-In) |
| `/api/auth/send-otp` | DELETE | OTP path removed |
| `/api/auth/verify-otp` | DELETE | OTP path removed |
| `/api/devices/register` | NEW | Mobile FCM token registration |
| `/api/devices/unregister` | NEW | Mobile FCM token revocation on sign-out |

### Schema changes (Supabase Postgres)
- **profiles**: ADD `email text unique`; DROP `phone` (cleanup in Phase 12); RESTORE FK to `auth.users(id)` (Phase 1 — reverts migration `00003`)
- **coach_settings**: ADD `contact_phone text` (E.164, used by Contact Coach UX)
- **bookings**: ADD `reminder_sent_at timestamptz` (idempotency for 1h reminder cron)
- **device_tokens**: NEW table — `(id uuid pk, user_id uuid fk profiles, token text unique, platform enum(ios,android), last_seen timestamptz, created_at timestamptz)`

### Key concepts (see `UBIQUITOUS_LANGUAGE.md`)
**Coach**, **Trainee**, **Slot**, **Booking**, **Session**, **Edit**, **Lockout**, **Recurring trainee**, **Auto-book**, **Capacity**, **Edit limit**, **Weekly limit**.

### Non-negotiables
- Server-side enforcement of all booking rules (weekly limit, edit limit, lockout, capacity). Mobile only reflects what the API tells it.
- All times in `Asia/Jerusalem` server-side authority.
- Hebrew/RTL is the **only** locale at MVP.
- Coach bootstrap via `COACH_EMAIL` env var. Server middleware grants `role=coach` on first matching login.
- Dev-mode auth uses **real Supabase Auth** with pre-seeded users (ADR-0003). No parallel mock path.

---

## Phase 1: Login + See My Profile

**User stories**: #1 (email login portion — Google deferred to Phase 6)

### What to build

A Flutter app at `mobile/` that lets a user sign in with email + password and see their name + role on a profile screen. End-to-end tracer bullet through every layer.

Backend changes are the minimum needed for this path: enable Supabase email/password auth, validate Supabase JWTs server-side, expose `/api/me`, wire the `COACH_EMAIL` middleware. Restore the FK from `profiles.id` to `auth.users.id` (reverts `00003_dev_mode_drop_auth_fk.sql`).

Mobile scaffold includes Riverpod with code-gen, `dio` HTTP client with auth interceptor, `supabase_flutter` SDK, Hebrew/RTL plumbing, and a debug-only "Login as Trainee / Login as Coach" panel reading `DEV_*` env vars.

Delete the now-redundant `src/app/login/page.tsx` and `src/app/book/page.tsx` — Flutter owns the trainee UI from here on.

### Acceptance criteria

- [ ] `mobile/` Flutter project initialized with Riverpod 2.x + code-gen, dio, supabase_flutter, flutter_localizations
- [ ] Hebrew is the default locale; `Directionality.rtl` applied at app root
- [ ] Login screen renders in Hebrew (RTL) with email + password fields
- [ ] Successful login navigates to a profile screen showing `name` + role label
- [ ] Failed login shows a localized error message
- [ ] `/api/me` returns the JWT-bearer's profile or 401
- [ ] Migration adds `profiles.email`, restores FK to `auth.users`
- [ ] Server middleware grants `role=coach` to any user whose email matches `COACH_EMAIL`
- [ ] Pre-seeded dev users exist after `npm run seed`; debug login panel signs in as either with one tap
- [ ] `src/app/login/page.tsx` and `src/app/book/page.tsx` deleted
- [ ] Existing Vitest suite passes; new integration test covers `/api/me` happy + 401 paths
- [ ] Flutter widget test covers login screen rendering + happy-path login (with mocked API)

---

## Phase 2: See This Week's Slots

**User stories**: #2, #3

### What to build

Flutter trainee home screen with a day picker (Sun–Fri tabs or horizontal scroller) and a list of 60-minute slots for the selected day. Each slot shows its start time and remaining capacity ("נשאר מקום 1", "מלא"). No booking actions yet — read-only.

Backend `/api/slots` already returns the data; only change is JWT validation in place of the cookie-session.

### Acceptance criteria

- [ ] Selecting a day fetches slots for that date in Asia/Jerusalem
- [ ] Slot list renders in Hebrew RTL with localized time format (24h)
- [ ] Remaining capacity displayed; trainee names not visible
- [ ] Days outside Sun–Fri are hidden
- [ ] Empty day shows a localized "no slots" placeholder
- [ ] Loading + error states have localized UI
- [ ] Coach sees the same view (booking actions gated in later phases)
- [ ] Widget test for slot list rendering; integration test for the day-picker → fetch round trip

---

## Phase 3: Book a Slot + My Bookings

**User stories**: #4, #5

### What to build

Tap a slot → confirm dialog (Hebrew) → POST `/api/bookings`. Successful booking removes the slot from "available" and adds it to a "My Bookings" mini-view at the top of the screen.

Weekly-limit enforcement (max 2/week) is already in the booking service; the mobile UI surfaces the server error verbatim when the limit is exceeded.

### Acceptance criteria

- [ ] Tap on an available slot opens a confirmation dialog
- [ ] Confirm fires `POST /api/bookings`; success shows snackbar + refreshes views
- [ ] "My Bookings" section lists this week's confirmed bookings, sorted by date
- [ ] Already-booked slots are visually marked as "מוזמן"
- [ ] 2/week limit produces a localized error toast
- [ ] Optimistic-locking failure (two devices race for the last seat) produces a localized "slot just filled" error and refreshes the list
- [ ] Existing booking service tests untouched; new Flutter integration test covers book → see-in-list

---

## Phase 4: Cancel + Reschedule + Edit Counter

**User stories**: #6, #7, #8

### What to build

Each entry in "My Bookings" has Cancel + Reschedule actions. Cancel: confirm → DELETE. Reschedule: tap → pick a new slot → atomic cancel+book on the server. A small "edits remaining this week: X/3" banner is visible while editing.

### Acceptance criteria

- [ ] Cancel confirms in Hebrew, fires `DELETE /api/bookings/:id`, removes from My Bookings, restores slot capacity
- [ ] Reschedule opens a slot picker scoped to the same week's available slots; on confirm, atomic server-side cancel + new book
- [ ] Edit counter (X/3) visible on My Bookings screen; updates after each edit
- [ ] Hitting the 3-edit limit blocks further edits with a localized error (no client-side workaround — server enforces)
- [ ] If reschedule's new slot is unavailable, old booking stays confirmed; UI reflects this without orphan state
- [ ] Auto-booked sessions can be cancelled without counting toward edit limit (server-enforced; UI doesn't disable the button)
- [ ] Widget test for edit-counter rendering; integration tests for cancel + reschedule happy + fail paths

---

## Phase 5: Lockout Enforcement + Contact Coach

**User stories**: #9, #10

### What to build

When a booking is within 7 hours of its start time, Cancel + Reschedule actions are disabled. A "Contact Coach" CTA appears below the booking with two buttons: **WhatsApp** (`https://wa.me/{coach.contact_phone}?text=...`, with prefilled Hebrew text referencing the locked slot) and **Call** (`tel:+{coach.contact_phone}`).

Migration adds `coach_settings.contact_phone`. A coach-only settings sub-screen lets the coach edit their contact phone (full settings screen built in Phase 6 — for this phase a minimal editor is sufficient).

### Acceptance criteria

- [ ] Bookings within 7h of start show locked state; Cancel + Reschedule disabled
- [ ] "Contact Coach" card with WhatsApp + Call buttons appears under locked bookings
- [ ] WhatsApp button opens WhatsApp with localized prefilled message: "היי, אני נעול מהאימון ב-{time}, אפשר חריג?"
- [ ] Call button opens device dialer
- [ ] If `coach_settings.contact_phone` is null, the card shows a localized "Contact info missing — ask your coach" message
- [ ] Migration adds `coach_settings.contact_phone text`
- [ ] Per-slot `lockout_override` on the slot disables the 7h check (server-enforced; mobile reflects)
- [ ] Tests: server enforces lockout, UI disables actions, deep links open correctly (verify scheme on both platforms)

---

## Phase 6: Google Sign-In + Connect Calendar

**User stories**: #1 (Google variant), #24, #25, #28

### What to build

Add a "Sign in with Google" button on the login screen (Supabase Google OAuth provider). After sign-in, if the user is the coach AND their Google Calendar is not yet connected, prompt them to tap "Connect Calendar" — which kicks off the **separate** server-side OAuth flow at `/api/auth/google/*` (ADR-0002). Server enforces that the Calendar email matches the signed-in email.

Once connected, bookings continue to write back to Google Calendar exactly as before (Phase 4 of the original plan, retained).

### Acceptance criteria

- [ ] "Sign in with Google" button on login screen; success → same profile destination as email/password
- [ ] If signed-in email differs from a pre-existing `auth.users` row with same email, accounts are linked (Supabase default behavior)
- [ ] Coach sees "Connect Calendar" CTA when `coach_settings.google_access_token` is null
- [ ] Tapping it opens the existing Google Calendar OAuth flow (web view or browser tab) and completes successfully
- [ ] Server rejects the OAuth completion if the Calendar email ≠ signed-in coach email; error surfaced to mobile
- [ ] Once connected, new bookings produce Google Calendar events with trainee name as title (existing behavior, regression-tested)
- [ ] Cancel deletes the Google Calendar event (existing behavior, regression-tested)

---

## Phase 7: Coach Week View + Manual Add/Remove

**User stories**: #15, #16, #17

### What to build

Role-gated routing in Flutter: if `role=coach`, default landing screen is a coach week view showing ALL bookings for the current week (with trainee names — coach-only). Each slot shows its bookings + remaining capacity. Coach can tap "add trainee" on a slot to pick from a trainee list, or tap "remove" next to a booking.

Coach can swipe horizontally to navigate to next/previous weeks.

Delete `src/app/admin/page.tsx` — replaced by the mobile coach week view.

### Acceptance criteria

- [ ] Coach role detection at app boot routes to coach week view
- [ ] Week view shows every slot for Sun–Fri of selected week with all confirmed bookings (trainee names visible to coach only)
- [ ] Add trainee opens a searchable trainee picker; selecting one fires server-side admin booking (bypasses limits per glossary)
- [ ] Remove next to a booking confirms + fires server-side admin cancel (bypasses limits)
- [ ] Week navigation works for past and future weeks
- [ ] `src/app/admin/page.tsx` deleted
- [ ] Existing admin booking tests pass with JWT auth swap

---

## Phase 8: Coach Trainee Management

**User stories**: #18, #19

### What to build

Coach-only screen: list of all trainees with status (active / pending / deactivated), recurring flag + preferred day/time, and actions to invite a new trainee, edit a trainee's details, resend invite, or deactivate.

**Invite flow**: coach enters email + name + optional recurring/preferred slot → server creates a `profiles` row in "pending" state (no auth.users row yet) + sends Supabase email-invite magic link. On first successful sign-up matching that email, server links the pending profile to the new `auth.users` row.

Delete `src/app/admin/trainees/page.tsx` and `src/app/admin/trainees/[id]/page.tsx` — replaced by mobile screens.

### Acceptance criteria

- [ ] Coach sees trainee list with status badges
- [ ] Invite form accepts email, name, recurring flag, preferred day, preferred time
- [ ] Submitting fires `POST /api/admin/trainees` which creates the pending profile + sends Supabase invite email
- [ ] Pending trainee appears in the list immediately
- [ ] When the invited trainee signs in for the first time, the pending profile is linked to their auth.users row (their email matches)
- [ ] Coach can resend an invite (re-trigger the Supabase invite email)
- [ ] Coach can edit name / recurring / preferred day+time
- [ ] Coach can deactivate a trainee — they can no longer book, existing bookings retained
- [ ] `src/app/admin/trainees/*` deleted
- [ ] Existing admin trainee tests pass with JWT auth swap

---

## Phase 9: Coach Overrides

**User stories**: #20, #21, #22

### What to build

Coach-only override controls accessible from the slot detail (long-press in week view): bump capacity from 2 to 3 for a single slot; toggle the per-slot lockout override; reset a trainee's edit count for the current week.

These wire to existing `/api/admin/slots` and `/api/admin/edits` endpoints — minimal backend change beyond JWT auth.

### Acceptance criteria

- [ ] Long-press a slot opens an override sheet
- [ ] Capacity slider/toggle: 2 ↔ 3, persists via `/api/admin/slots`, week view reflects new capacity
- [ ] Lockout override toggle: enables/disables 7h lockout for that specific slot; trainee actions reflect immediately
- [ ] Trainee detail screen has "Reset edits for this week" button → `/api/admin/edits` → trainee's edit counter shows 0/3
- [ ] All overrides are auditable (existing edit log retained; consider adding admin override log post-MVP)
- [ ] Existing admin override tests pass with JWT auth swap

---

## Phase 10: Push — Coach Alerts + Trainee Confirmations

**User stories**: #14 (confirmations portion), #23

### What to build

Wire FCM in Flutter: request notification permission on first launch, fetch the device token, register it via `POST /api/devices/register`. Unregister on sign-out.

Backend additions: `device_tokens` table, register/unregister endpoints, fan-out from the existing notification service so that:
- Coach receives a push when a trainee cancels or reschedules (in addition to existing email).
- Trainee receives a push immediately after a successful booking ("האימון נקבע ל-...").

All notification copy is Hebrew.

### Acceptance criteria

- [ ] FCM SDK integrated for iOS + Android
- [ ] First launch prompts for notification permission
- [ ] Token registered against the authenticated user; updated on token refresh
- [ ] Sign-out fires `POST /api/devices/unregister` and clears local token
- [ ] Cancel/reschedule by a trainee triggers a push to the coach's registered devices (all of them, dedup-by-token)
- [ ] Successful booking by a trainee triggers a push to that trainee's devices
- [ ] Push tap deep-links into the relevant screen (week view for coach, my-bookings for trainee)
- [ ] Migration adds `device_tokens` table
- [ ] Existing notification service tests still pass; new tests cover the FCM fan-out + token lifecycle

---

## Phase 11: 1-Hour-Before Reminders

**User stories**: #14 (reminder portion)

### What to build

A new Vercel cron route `/api/cron/send-reminders` running every 5 minutes. Selects confirmed bookings whose `slot.start_time` is in the next [60min, 65min) window and whose `reminder_sent_at` is null. Sends a localized push to the trainee, sets `reminder_sent_at = now()`.

Migration adds `bookings.reminder_sent_at`.

### Acceptance criteria

- [ ] Migration adds `bookings.reminder_sent_at timestamptz`
- [ ] Cron route configured in `vercel.json` (every 5 min)
- [ ] Cron correctly selects bookings in the [60, 65) min window
- [ ] Pushes Hebrew reminder ("האימון מתחיל בעוד שעה בשעה {time}")
- [ ] `reminder_sent_at` set after successful push; re-runs skip already-notified bookings
- [ ] Cancelling a booking before its reminder fires does not send a stale push
- [ ] Existing auto-book cron untouched; verified passing
- [ ] Integration tests cover the windowing + idempotency + skip-on-cancel paths

---

## Phase 12: Cleanup & Decommission

**User stories**: N/A

### What to build

Strip out everything the new auth + mobile flow has obsoleted:
- Delete `/api/auth/send-otp/route.ts` and `/api/auth/verify-otp/route.ts`
- Delete `src/lib/services/mock-auth.ts` and `src/lib/supabase/dev-auth-service.ts`
- Drop `profiles.phone` column (existing data is dummy per the PRD)
- Revert/replace migration `00003_dev_mode_drop_auth_fk.sql` if any remnant remains
- Delete any stale `/api` routes only used by deleted UI pages
- Update `README.md` to reflect the new architecture
- Sweep for now-dead imports + types

### Acceptance criteria

- [ ] OTP routes deleted
- [ ] Dev-auth service deleted; seed script creates real Supabase Auth users
- [ ] `profiles.phone` column dropped (migration)
- [ ] `00003_dev_mode_drop_auth_fk.sql` superseded by a new migration that asserts the FK is in place
- [ ] No references to OTP, dev-auth, or `profiles.phone` remain anywhere (grep clean)
- [ ] README explains the mobile/ + Next.js split, Hebrew/RTL, dev login, env vars, FCM setup
- [ ] All existing Vitest + Flutter tests pass on a fresh clone after seed
- [ ] No dead code lingering — `ts-prune` or equivalent run

---

## Phase 13: Distribution Prep (deferred until MVP stable)

**User stories**: N/A

### What to build

When the MVP is functionally complete and dogfooded, set up distribution:
- Apple Developer Program ($99/yr) — coach's account
- Google Play Developer ($25 one-time) — coach's account
- iOS: Bundle ID, certificates, provisioning profile, App Store Connect app record
- Android: Keystore, package name, Play Console app record
- App icon + splash screen (Hebrew brand assets from coach)
- Fastlane for build + upload to TestFlight and Play Internal track
- CI workflows: `.github/workflows/mobile.yml` (Flutter test + build on PR; release build on tag) and `.github/workflows/backend.yml` (Vitest + lint on changes to `src/**`, `supabase/**`, `package.json`)
- Tester invite flow: TestFlight email invitations + Play Internal tester list

### Acceptance criteria

- [ ] Coach holds active Apple Developer + Google Play Developer accounts
- [ ] App ships to TestFlight (internal track) and Play Internal testing track
- [ ] Coach + at least one test trainee can install on real devices via official channels
- [ ] CI builds + tests run on every PR; release builds run on version tag
- [ ] Crash + analytics hookup (Firebase Crashlytics) decided + wired
- [ ] Path-to-public-release documented (promote internal build to production track)

---

## Unresolved questions

- Hebrew font family for the mobile app — Heebo, Rubik, Assistant, Noto Sans Hebrew, or system default? Decision before Phase 1 finishes.
- Branding assets (logo, palette) — coach to provide; placeholder Material 3 theme + Heebo font until then.
- Supabase RLS — enable now as defense-in-depth, or rely on API-only access pattern? Decide before Phase 3.
- Flutter env config plumbing — `--dart-define` vs `flutter_dotenv`? Lock during Phase 1 scaffold.
- Admin override audit log — defer to post-MVP? Decide in Phase 9.
- Crashlytics / analytics — wire in Phase 10 alongside FCM, or defer to Phase 13?
- Coach onboarding UX when their Google Calendar is disconnected mid-week — block bookings, or allow with warning? Decide in Phase 6.
