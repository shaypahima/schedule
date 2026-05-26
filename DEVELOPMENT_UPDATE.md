Velofit — Current Development State (live)

This is the at-a-glance status doc. Deeper references:
docs/product-vision.md — why we're building this + behavioral rules + KPIs
docs/design-system.md — visual tokens, patterns, remediation list
CONTEXT.md — domain glossary
docs/adr/ — architecture decisions
GitHub issues — roadmap

1. Product Vision & Success Metrics
Velofit replaces WhatsApp/calendar chaos with a frictionless habit loop for both coach and trainees:

Cue → 24h + 2h reminders + auto-booking for recurring trainees
Action → one-tap booking, one-tap log, one-tap approve
Reward → visible progress, streaks, coach recognition, peace of mind

Core promise:
Trainee feels supported and sees tangible progress → shows up, stays.
Coach spends ≤15 min/day on admin and has a clear business view.

KPI targets (aspirational; analytics not yet wired):

30-day trainee retention >75%
No-show rate <8% (industry baseline ~20%)
Weekly bookings per active trainee ≥1.8
Coach daily active time <15 min

Full vision + behavioral rules: docs/product-vision.md

2. User Personas
Coach (sole proprietor, 35-55, busy):

High openness to tech, zero tolerance for complexity.
Needs perceived control + quick wins ("who's coming today" in <5s).
Motivation: income stability + clients transforming.

Trainee (25-55, fitness-curious):

Cognitive load is enemy #1 → wants instant clarity ("Can I book tomorrow 18:00?").
Driven by small visible wins + accountability — not guilt.
Hebrew RTL native.

3. Core User Flows
Onboarding → Self-signup (Google → intro form → pending → coach approval) OR coach invite (instant active) → welcome screen.
Booking Loop (trainee) → Home → tap day → see slots with capacity → tap slot → confirmation + Google Calendar event written.
Coach Dashboard → Today's roster → Quick actions (approve / no-show / notes / manual add).
Progress Loop (epic #52, not built) → Post-session prompt (within 30min of slot end) → MeasurementLoggerSheet → chart updates instantly.
Cancel/Reschedule → Outside 24h: trainee acts freely. Inside 24h: trainee submits cancel/reschedule request → coach approves/rejects in inbox.

All flows server-enforced via Bookings service. Spec-locked gate order (tests in bookings.test.ts): LOCKOUT (7h) → WEEKLY_LIMIT (2/wk) → SLOT_FULL (capacity) → ALREADY_BOOKED (duplicate). Bypass flag (coach manual add) skips first two.

4. Build Status by Theme
Latest merges:

PR #58 (master at 334da4e) — #53 reminder cadence retune:
  Drops 1h-before reminder. Three windows: 24h-before, 2h-before, 30min-after-slot-end.
  Migration 00016 (reminder_24h_sent_at + reminder_2h_sent_at + postsession_prompt_sent_at).
  ReminderKind type + Hebrew copy per kind. Post-session push silently no-ops until FCM (#36).
  272/272 backend, 109/109 mobile.

PR #57 — #55 reschedule race fix:
  Reorders Bookings.decideRequest: book new slot first, then cancel old. Race on full target now
  returns SLOT_FULL + leaves request pending + old booking intact. ADR-0007.

PR #56 — Epic #54 (40 items, 5 vertical slices):

Epic #54 — UI remediation closed. All 40 items shipped (R1-R40):
  Slice 1 — trainee home: drop dup greeting, hero gradient teal→tealDark, SkeletonList, EmptyState, hero stat trim
  Slice 2 — coach week: ErrorCard with retry, EmptyState, canonical gradient direction, DashStat color semantics
  Slice 3 — profile pair: solid teal avatars, BrandColors.warning, ErrorCard, SectionHeader extract, integer-only height/weight
  Slice 4 — detail/requests/about/history: muted intro placeholder, EmptyState everywhere, differentiated pills (teal+orange), inkSoft subtitle
  Slice 5 — cross-cutting: SkeletonList everywhere, EmptyState pattern adopted, canonical BrandColors.gradientHero constant
Fix /api/slots accepts coach role (helper requireCoachOrActiveTrainee) — coach week had been silently 403'd
Fix slot-availability returns full slots (mobile "מלא" tag now works in prod)
Test sweep — gate-matrix, design widgets unit tests, reschedule races, booking-gate-order spec-lock (+18 tests)

PR #51 (earlier) — phases 11-18 already on master:
  Trainee profile editor, dashboard streak/member-since, coach dashboard stats, history screen, trainee detail with bio, coach about card, change-requests inbox, design polish, dev-env.json gitignore

Open epics:

#52 — Progress tracking (measurement_logs + session_logs + photos + post-session prompt + fl_chart). Backend slice up next.

Open HITL:

#25 — Firebase project setup (blocks #36)
#36 — FCM scaffold + push fan-out
#39 — Distribution prep (Apple/Play accounts + Fastlane + CI)
#41 — Calendar OAuth email-match + mobile deep link

Closed/deprecated:

#53 — Reminder cron retune (closed by PR #58)
#55 — Reschedule race (closed by PR #57)
#54 — UI remediation epic (closed by PR #56)
#1 — original PRD (kept for history; deprecation header points at CONTEXT.md + ADRs)

5. Design System Snapshot
Color (BrandColors in mobile/lib/theme.dart):

Primary: Teal #0EA89A
Accent: Orange #FF6B35 (one per screen max, never dominant)
Background: warm neutral #FAF8F5 (never pure white)
Status: success #1F9D55, warning #B45309 (amber-700), error #C53030
Canonical hero: BrandColors.gradientHero (teal→tealDark, topRight→bottomLeft)

Spacing (AppSpacing in mobile/lib/design/spacing.dart):

4pt grid: xxs(4) / xs(8) / sm(12) / md(16) / lg(24) / xl(32) / xxl(48)
Radius scale: sm(8) / md(12) / lg(16) / xl(20) / pill(999)

Typography:

Heebo (Google Fonts, Hebrew-native)
Sizes via Theme.of(context).textTheme.* — never hardcoded fontSize

Shipped widgets (mobile/lib/design/widgets.dart, all unit-tested in test/design/widgets_test.dart):

SectionHeader — caption-style header replacing duplicated _section() helpers
InfoRow / DataGrid — label/value pair + 2-col grid
HeroStat — gradient-hero stat tile with accent-top border
StatusStripeTile — list row with 3px leading stripe (replaces CircleAvatar+icon)
SkeletonList — static greys, ListView-backed (no overflow, no animation hang)
EmptyState — icon + headline + helper + optional action
ErrorCard — error-tinted card with retry button

Pattern specs not yet built (see docs/design-system.md § 3):

Capacity bar, lockout badge, swipe-to-cancel, haptic patterns

6. Behavioral Rules (non-negotiable, from docs/product-vision.md)

No dark patterns. No fake urgency, no fake scarcity, no guilt framing.
Streaks positive only — "growth streak," never "don't break it."
No confetti on transactional actions. Haptic + checkmark + instant next-session update is the celebration.
Progress visibility creates reward — the trainee earned it, we just surface it.
Coach speaks through notes (ADR-0006) — more powerful than gamification.
Notification cap: max 3/day per trainee (24h + 2h + post-session = the natural three).
Real-time feedback — booking → instant confirmation; log → chart updates.

7. Reminder Cadence (committed, in-flight as #53)

24h before — "tomorrow at HH:MM" + quick-cancel deep link (fires before 24h window closes)
2h before — final warmup nudge
30 min after slot end — "how did it feel?" → opens log sheet

Current 1h-before reminder is dropped, not duplicated.

8. Stack
Backend — Next.js 16 App Router (TypeScript), Vitest, lives in src/

Postgres via Supabase. Service-role key for admin; anon key for auth.
Auth: Supabase OTP (email). JWT bearer on every API request.
Domain code under src/lib/: BookingStore (writes) + CoachReadModel (reads) — CQRS-lite.
Bookings service handles book/cancel/reschedule with calendar rollback.
15 migrations in supabase/migrations/, applied via Supabase CLI.
API routes: /api/me/* (trainee), /api/admin/* (coach), /api/coach-info, /api/coach-settings, /api/cron/*

Mobile — Flutter 3.44, Dart 3.12, lives in mobile/

State: Riverpod 2.x (Provider + FutureProvider)
HTTP: Dio + AuthedHttpClient (auto-injects JWT, unwraps DioException → ApiException)
Auth: supabase_flutter
Theme: BrandColors + Heebo + AppSpacing tokens
Env: --dart-define-from-file=dev-env.json (gitignored)
109 widget tests via mocktail + flutter_test (backend: 265 vitest)

Infra

Supabase project skgccdncqrxmbjwjelhi
New-format API keys (sb_publishable_* / sb_secret_*)
No CI yet; local test before merge
Single-coach env: COACH_EMAIL on backend = source of truth for coach role

9. Architecture Decisions Worth Knowing

ADR-0001 — Riverpod over Bloc (state mgmt)
ADR-0002 — Calendar OAuth server-side; mobile only opens the URL (email-match enforcement = #41)
ADR-0003 — Dev-mode uses real Supabase auth (no parallel auth path)
ADR-0004 — Self-signups require coach approval (intro form → pending → active)
ADR-0005 — 24h cancel window is the only gate; 3-edits/week removed
ADR-0006 — Coach notes are v1 progress primitive (#52 graduates this to v2)

10. Next Immediate Actions
Order (vertical slices, no parallelism):

#52 progress tracking backend — measurement_logs + session_logs migrations + APIs + Supabase Storage bucket.
#52 progress tracking mobile — ProgressTab, MeasurementLoggerSheet, photo timeline (blocked on backend).
#25 Firebase project setup (HITL) — unblocks #36.
#36 FCM scaffold + push fan-out — blocked on #25.
#39 Distribution prep (HITL) — Apple Dev + Play Console + Fastlane + CI.
#41 Calendar OAuth email-match + mobile deep link.

This doc is the only "current state" file. If something here doesn't match what's shipped, fix this doc first.
