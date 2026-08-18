Velofit — Current Development State (live)

This is the at-a-glance status doc. Deeper references:
docs/product-vision.md — why we're building this + behavioral rules + KPIs
docs/design-system.md — visual tokens, patterns, remediation list
CONTEXT.md — domain glossary
docs/adr/ — architecture decisions
GitHub issues — roadmap

## 0. Read this first — web-only pivot (2026-08-18)

Velofit is a **web application**. The Flutter mobile app was deleted outright
(PR #95). It never shipped to distribution and had no live users, so there was
no cutover and nothing to migrate.

Everything below describing Flutter, Riverpod, widgets, app stores or push via
FCM is **history**, kept only to explain why decisions look the way they do.
Sections 5 (design system) and 8 (stack) were rewritten; ADRs 0001, 0008, 0009
and 0011 are now historical — they describe a client that no longer exists.

The web client was built on the existing, already-tested service layer
(PR #96): Server Components read through `src/lib/services/*` directly, Server
Actions write through the same. No HTTP hop, and `/api/*` — built for mobile's
JWT bearer auth — is now unused by the app and a candidate for pruning.

## 1. Product Vision & Success Metrics

Velofit replaces WhatsApp/calendar chaos with a frictionless habit loop for
both coach and trainees:

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

## 2. User Personas

Coach (sole proprietor, 35-55, busy):

High openness to tech, zero tolerance for complexity.
Needs perceived control + quick wins ("who's coming today" in <5s).
Motivation: income stability + clients transforming.

Trainee (25-55, fitness-curious):

Cognitive load is enemy #1 → wants instant clarity ("Can I book tomorrow 18:00?").
Driven by small visible wins + accountability — not guilt.
Hebrew RTL native.

## 3. Core User Flows

Onboarding → Self-signup (Google → intro form → pending → coach approval) OR
coach invite (instant active).
Booking Loop (trainee) → `/` → pick day → slots with capacity → book.
Coach Dashboard → `/coach` → today's roster + queues + monthly overview.
Cancel/Reschedule → Outside 24h: trainee acts freely. Inside 24h: submits a
request the coach decides in `/coach/requests`.
Waitlist → full slot → join → everyone notified when a spot frees, first to
book wins (ADR-0012).
Progress → `/progress` → weight + photo + note; before/after compare.

All flows server-enforced via the Bookings service. Spec-locked gate order
(tests in bookings.test.ts): LOCKOUT (7h) → WEEKLY_LIMIT (2/wk) → SLOT_FULL
(capacity) → ALREADY_BOOKED (duplicate). Bypass flag (coach manual add) skips
the first two.

## 4. Build Status

**Web client — complete** (PR #96, branch `shay/web-app-backend`).

Trainee: sign-in, intro, pending/rejected/deactivated screens, booking board
with day strip and capacity, waitlist join/leave, cancel + reschedule (both
sides of the 24h window), history, coach notes, profile editor, completion
nudge, progress log with photo upload and before/after compare.

Coach: dashboard (queues, monthly overview, today's roster, no-show marking),
week view with manual add/remove and waitlist depth, approvals, trainees list
with weight-trend/attendance/at-risk chips, invite by email, deactivate,
trainee detail with notes, change-request inbox, settings (Google Calendar
connect + per-hour capacity/lockout overrides).

461 tests passing, lint/tsc/build clean.

Backend was already complete before the pivot; PR #96 pulled forward the
waitlist, photo-storage, profile-nudge, analytics and read-model work that had
been stranded on unmerged branches.

## 5. Design System Snapshot

**Deliberately unstyled.** The web client ships plain, functional Tailwind:
Hebrew RTL shell (`lang="he" dir="rtl"`), Heebo via next/font, black/white
plus semantic greens/reds/ambers for state.

The visual direction is an open decision. ADR-0011 (cream-editorial) and
ADR-0009 (warm-studio) describe the *Flutter* palette and were never ported;
whether to port cream-editorial's tokens to CSS or design fresh for the web
medium is unresolved and deliberately deferred.

## 6. Behavioral Rules (non-negotiable, from docs/product-vision.md)

No dark patterns. No fake urgency, no fake scarcity, no guilt framing.
Streaks positive only — "growth streak," never "don't break it."
No confetti on transactional actions.
Progress visibility creates reward — the trainee earned it, we just surface it.
Coach speaks through notes (ADR-0006) — more powerful than gamification.
Notification cap: max 3/day per trainee.
Profile completion nudges, never gates — booking is always allowed.

## 7. Reminder Cadence

24h before — "tomorrow at HH:MM"
2h before — final warmup nudge
30 min after slot end — "how did it feel?"

Delivery is currently in-app/console only. Push was FCM-based and died with
the mobile app; a web equivalent (Web Push) is unscoped new work.

## 8. Stack

Next.js 16 App Router (TypeScript), React 19, Tailwind 4, Vitest. All of it in
`src/`.

- Postgres via Supabase. Service-role key for admin; anon key for auth.
- Auth: Google OAuth via Supabase, session in SSR cookies (`@supabase/ssr`).
  `src/lib/auth/session.ts` resolves cookies → `{role, status}` and
  `resolveDestination()` is the single place deciding which screen someone
  belongs on. Page guards bounce the wrong role to their own destination.
- COACH_EMAIL (comma-separated) always wins over the stored role.
- Reads: Server Components → `src/lib/services/*` and the CoachReadModel /
  TraineeReadModel (CQRS-lite, batched).
- Writes: Server Actions → the same services. Bookings handles
  book/cancel/reschedule with calendar rollback.
- 20 migrations in supabase/migrations/.
- Local dev without Supabase: `DB_DRIVER=pg` + the dev sign-in form on
  `/sign-in`, gated on the driver so a dev token can never authenticate
  against the cloud.
- `/api/*` still exists (mobile's old surface) but the web app does not use it.

Infra

Supabase project skgccdncqrxmbjwjelhi
New-format API keys (sb_publishable_* / sb_secret_*)
No CI yet; local test before merge
Single-coach env: COACH_EMAIL on backend = source of truth for coach role

## 9. Architecture Decisions Worth Knowing

ADR-0002 — Calendar OAuth server-side (email-match enforcement = #41)
ADR-0003 — Dev-mode uses real Supabase auth (no parallel auth path)
ADR-0004 — Self-signups require coach approval (intro form → pending → active)
ADR-0005 — 24h cancel window is the only gate; 3-edits/week removed
ADR-0006 — Coach notes are v1 progress primitive
ADR-0007 — Reschedule approval books new slot before cancelling old
ADR-0010 — Store seam: interface + adapter + shared row-mappers
ADR-0012 — Waitlist notifies all, first to book wins

Historical (described the deleted Flutter client): ADR-0001 (Riverpod),
ADR-0008 (motion layer), ADR-0009 (warm-studio), ADR-0011 (cream-editorial).

## 10. Next Immediate Actions

1. **HITL — Supabase Google provider**: add the OAuth redirect URL and Google
   client credentials so sign-in works against real Google. Local dev works
   today via the dev sign-in form.
2. **Merge the stack**: PR #95 (mobile deletion) → PR #96 (backend pull-forward
   + web client) → master.
3. **Visual direction** (open decision): port cream-editorial tokens to CSS, or
   design fresh for web.
4. #41 Calendar OAuth email-match — the "mobile deep link" half is dead; the
   email-match enforcement half still applies.
5. Prune `/api/*` once nothing depends on it.
6. Web Push, if push is still wanted.

This doc is the only "current state" file. If something here doesn't match what's shipped, fix this doc first.
