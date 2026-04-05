# Plan: Self-Service Trainee Booking Platform

> Source PRD: GitHub Issue #1 (shaypahima/schedule)

## Architectural decisions

- **Framework**: Next.js 14+ (App Router) with TypeScript, deployed on Vercel
- **Database & Auth**: Supabase (Postgres + phone OTP auth)
- **Calendar**: Google Calendar API v3 via OAuth2 (single calendar, read/write)
- **Timezone**: All server-side time in `Asia/Jerusalem` (using `date-fns-tz` or similar)
- **Testing**: Vitest for unit/integration, TDD red-green-refactor
- **Mock layer**: Environment-switched (`MOCK_SERVICES=true`) — mock Google Calendar + bypass OTP in dev

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirect to `/book` or `/login` |
| `/login` | Phone OTP login |
| `/book` | Trainee day-by-day booking view |
| `/book/[day]` | Slots for a specific day |
| `/admin` | Admin week overview |
| `/admin/trainees` | Trainee management |
| `/admin/settings` | Google Calendar connect, notification prefs |
| `/api/auth/*` | Supabase auth callbacks |
| `/api/slots` | GET available slots for a date range |
| `/api/bookings` | POST book, PATCH reschedule, DELETE cancel |
| `/api/admin/overrides` | POST slot capacity, lockout, edit limit overrides |
| `/api/admin/trainees` | CRUD trainee profiles |
| `/api/cron/auto-book` | Vercel cron — Saturday auto-book |
| `/api/google/callback` | OAuth2 callback for Google Calendar |

### Schema (Supabase Postgres)

**profiles**
- `id` (uuid, FK to auth.users)
- `phone` (text, unique)
- `name` (text)
- `role` (enum: admin, trainee)
- `is_recurring` (boolean, default false)
- `preferred_day` (smallint, 0=Sun..5=Fri, nullable)
- `preferred_time` (time, nullable)
- `is_active` (boolean, default true)
- `created_at` (timestamptz)

**slots**
- `id` (uuid)
- `date` (date)
- `start_time` (time)
- `capacity` (smallint, default 2)
- `lockout_override` (boolean, default false)
- `created_at` (timestamptz)
- unique constraint on (date, start_time)

**bookings**
- `id` (uuid)
- `slot_id` (uuid, FK to slots)
- `trainee_id` (uuid, FK to profiles)
- `google_event_id` (text, nullable)
- `is_auto_booked` (boolean, default false)
- `status` (enum: confirmed, cancelled)
- `created_at` (timestamptz)
- unique constraint on (slot_id, trainee_id, status=confirmed) — prevent double-booking same person

**edit_log**
- `id` (uuid)
- `trainee_id` (uuid, FK to profiles)
- `week_start` (date) — Sunday of the week
- `edit_count` (smallint, default 0)
- unique constraint on (trainee_id, week_start)

**coach_settings**
- `id` (uuid)
- `google_access_token` (text, encrypted)
- `google_refresh_token` (text, encrypted)
- `google_token_expiry` (timestamptz)
- `notification_email` (text, nullable)
- `notification_push_endpoint` (text, nullable)

### Key models

- **SlotAvailability**: Google Calendar free/busy → bookable 60-min slots with remaining capacity
- **BookingService**: book/cancel/reschedule with all rule enforcement
- **GoogleCalendarService**: interface with mock and real implementations
- **AuthService**: Supabase phone OTP, role check

---

## Phase 1: Project scaffold + dev mock layer + schema

**User stories**: None directly — infrastructure
**Issues**: #2, #3

### What to build

Initialize the Next.js project with TypeScript, Vitest, and Supabase client. Create the full database schema (all tables above). Build the mock layer: a `GoogleCalendarService` interface with an in-memory mock implementation, and dev-mode OTP bypass. Write a seed script that populates ~30 trainees, a coach admin, and sample bookings.

TDD approach: write tests for the mock Google Calendar service (configurable free/busy, create/delete events) before implementing.

### Acceptance criteria

- [ ] Next.js project initialised with TypeScript, ESLint, Vitest
- [ ] Supabase schema migrations for all tables
- [ ] `GoogleCalendarService` interface defined
- [ ] `MockGoogleCalendarService` passes tests: configurable free/busy, create event, delete event
- [ ] Dev OTP bypass: any code works when `MOCK_SERVICES=true`
- [ ] Seed script creates coach + ~30 trainees + sample bookings
- [ ] `npm run dev` starts the app with mock services

---

## Phase 2: Slot availability engine

**User stories**: 2, 3
**Issues**: #5

### What to build

The core engine that takes Google Calendar free/busy data (from mock or real) and produces bookable 60-minute slots for a given day. Returns remaining capacity per slot. Exposed via `GET /api/slots?date=YYYY-MM-DD`.

TDD: write tests first for slot generation from various free/busy patterns, capacity math, and timezone edge cases.

### Acceptance criteria

- [ ] Given free/busy blocks, generates correct 60-min slots for a day
- [ ] Respects slot capacity (default 2, reads overrides from DB)
- [ ] Returns remaining capacity per slot
- [ ] Full slots excluded
- [ ] All times correct in Asia/Jerusalem
- [ ] API endpoint `GET /api/slots` returns slots for a given date
- [ ] Tests pass: empty calendar, fully booked, partial gaps, capacity overrides

---

## Phase 3: Auth + trainee booking UI

**User stories**: 1, 2, 3, 4
**Issues**: #3 (auth UI), #6

### What to build

Phone OTP login page (Supabase auth in prod, bypass in dev). After login, trainee sees a day-by-day view (Sun–Fri) of available slots. Tapping a slot books it (writes to `bookings` + `slots` tables). Trainee can see their own booked sessions.

TDD: write tests for the booking API endpoint (successful book, slot full, unauthenticated).

### Acceptance criteria

- [ ] Login page with phone number + OTP
- [ ] Dev mode: any OTP code works
- [ ] Day selector (Sun–Fri) on `/book`
- [ ] Available slots displayed with remaining capacity ("1 spot left")
- [ ] No other trainee names visible
- [ ] Booking creates a record in DB and decrements capacity
- [ ] Trainee sees their own bookings highlighted
- [ ] API tests: book success, slot full, auth required

---

## Phase 4: Google Calendar integration (real)

**User stories**: 23
**Issues**: #4, #7

### What to build

Replace mock with real Google Calendar API. OAuth2 flow for the coach to connect their account (admin settings page). Slot availability engine now reads real free/busy data. Bookings write events to Google Calendar (title = trainee name, 60 min).

### Acceptance criteria

- [ ] Coach can connect Google account from `/admin/settings`
- [ ] OAuth2 tokens stored and auto-refreshed
- [ ] Slot engine uses real free/busy when `MOCK_SERVICES` is not set
- [ ] Booking creates Google Calendar event with trainee name
- [ ] `google_event_id` stored on booking record
- [ ] Fallback to mock in dev still works

---

## Phase 5: Cancel, reschedule + edit limits

**User stories**: 6, 7, 8, 13, 24
**Issues**: #8, #16

### What to build

Trainee can cancel or reschedule a booked session. Each action counts as an edit (max 3/week). Reschedule is atomic (cancel + book in transaction). Cancel deletes the Google Calendar event. Auto-booked sessions don't count toward edit limit. UI shows remaining edits.

TDD: write tests for edit limit enforcement, atomic reschedule, auto-book exemption, Google Calendar event deletion.

### Acceptance criteria

- [ ] Cancel removes trainee from slot, deletes Google Calendar event
- [ ] Reschedule is atomic — cancel old + book new in one transaction
- [ ] Edit counter increments, blocks after 3/week
- [ ] Auto-booked session edits exempt from edit limit
- [ ] UI shows remaining edits count
- [ ] Tests: edit limit, atomic reschedule, auto-book exemption, concurrent cancel

---

## Phase 6: 2/week limit + 7-hour lockout

**User stories**: 5, 9, 10
**Issues**: #10, #9

### What to build

Enforce max 2 sessions per trainee per week. Enforce 7-hour lockout before session start — disable book/cancel/reschedule within 7 hours. Show "contact coach" option when locked out.

TDD: tests for 2/week limit and lockout boundary conditions.

### Acceptance criteria

- [ ] Cannot book more than 2 sessions/week (auto-booked counts)
- [ ] Book/cancel/reschedule disabled within 7 hours of session
- [ ] Clear lockout message + "contact coach" link
- [ ] Timezone-correct lockout (Asia/Jerusalem)
- [ ] Tests: 2/week enforcement, lockout at 7h/6h59m/7h01m boundaries

---

## Phase 7: Admin panel — week view + manual booking

**User stories**: 14, 15, 16
**Issues**: #12

### What to build

Admin-only `/admin` page with a week view showing all slots and booked trainees (names visible). Coach can manually add or remove trainees from slots. Both actions trigger Google Calendar write-back.

### Acceptance criteria

- [ ] Week view shows all days, all slots, all booked trainee names
- [ ] Coach can add trainee to any slot with capacity
- [ ] Coach can remove trainee from any slot
- [ ] Google Calendar updated on manual add/remove
- [ ] Admin-only access enforced (role check)

---

## Phase 8: Admin — trainee management

**User stories**: 17, 18
**Issues**: #13

### What to build

Trainee management at `/admin/trainees`. Invite new trainees by phone number, set/unset recurring with preferred day/time, deactivate trainees.

### Acceptance criteria

- [ ] Trainee list with search
- [ ] Invite by phone number (creates profile)
- [ ] Set recurring + preferred day/time
- [ ] Unset recurring
- [ ] Deactivate trainee

---

## Phase 9: Admin overrides

**User stories**: 19, 20, 21
**Issues**: #14

### What to build

Admin controls to override: slot capacity (2→3), 7-hour lockout per slot, trainee edit limit. Accessible from the admin week view.

### Acceptance criteria

- [ ] Override slot capacity to 3 (and revert)
- [ ] Disable lockout for a specific slot
- [ ] Reset/increase a trainee's edit count
- [ ] Overrides take effect immediately
- [ ] Visible in admin week view

---

## Phase 10: Auto-book cron

**User stories**: 11, 12, 13, 25, 26
**Issues**: #15

### What to build

Vercel cron job at `/api/cron/auto-book` running every Saturday. Queries recurring trainees, books them into preferred slots if available, skips if unavailable. Creates Google Calendar events. Marks bookings as `is_auto_booked`.

TDD: tests for auto-book logic — available/unavailable slots, 2/week interaction, edit limit exemption.

### Acceptance criteria

- [ ] Cron runs every Saturday automatically
- [ ] Recurring trainees booked when slot is available
- [ ] Skipped when slot unavailable (no error)
- [ ] Google Calendar events created
- [ ] `is_auto_booked` flag set
- [ ] Counts toward 2/week, not toward 3-edit limit
- [ ] Tests pass: booking, skipping, limit interactions

---

## Phase 11: Notifications + race conditions

**User stories**: 22
**Issues**: #11, #17

### What to build

Coach notifications (push/email) on cancel/reschedule. Optimistic locking on slot capacity to prevent double-booking race conditions.

### Acceptance criteria

- [ ] Coach notified on cancel/reschedule (email or push)
- [ ] Notification includes trainee name + slot details
- [ ] Concurrent last-spot bookings: one succeeds, one gets friendly error
- [ ] No partial/corrupt booking state possible
- [ ] Tests: concurrent booking simulation
