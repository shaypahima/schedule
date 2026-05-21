# Velofit — Upcoming functional changes

Status: planning. Not yet sliced into phases or issues.

## 1. Richer trainee profile

Today: name, email, role, recurring flag, preferred day/time, status.
Goal: profiles carry enough data to drive a real **progress-tracking dashboard**, not just a calendar.

Candidate fields (to confirm with the coach):
- Age / date of birth
- Height, weight, body measurements
- Training goals (free text + tags)
- Medical notes / limitations
- Workout history (linked from bookings)
- Photo

Dashboard implications:
- The trainee home screen stops being "just a calendar"
- Stats card: sessions this month, streak, attendance rate
- Upcoming sessions card (already exists, expand it)
- Coach announcements / notes section

Hebrew copy: needs a pass — current strings are functional but not polished.

## 2. Richer coach profile + dashboard

- More data per trainee on the coach's view (last session, attendance, notes)
- More actions per trainee (assign program, send message, edit profile)
- Dashboard cards: today's roster, no-shows this week, upcoming reschedules, pending approvals (see §3 + §4)

## 3. Trainee approval flow

Today: any signup that matches a seeded email auto-activates (`status: pending → active` on first `/api/me` call).
Change: coach explicitly **approves** new signups.

- New signup lands in `status: pending`
- Coach sees a "pending approvals" list, can approve or reject
- Trainee in `pending` cannot book — sees a "waiting for coach approval" screen
- Approval transitions `status: pending → active`
- Rejection transitions `status: pending → rejected` (or deletes — TBD)

## 4. Cancellation rule rewrite

Today: hard 7-hour lockout. Inside the window → blocked entirely, "Contact Coach" CTA appears.
Change: soft 24-hour window with a request/approval flow.

- More than 24h before slot → trainee cancels freely (current behavior, but window widens 7h → 24h)
- Less than 24h before slot → trainee submits a **cancel request** that the coach must approve or reject
- Coach approval marks the booking cancelled and frees the slot
- Coach rejection keeps the booking active
- Trainee sees the request's state on the booking card

New domain:
- `booking_change_request` table (or status field on `bookings`): `pending | approved | rejected`
- Coach dashboard gets a "pending requests" surface
- Notifications fire on request submitted (→ coach) and on decision (→ trainee)

## 5. Future — payment system

Out of scope for now. Sketch:
- Per-session or monthly subscription pricing
- Coach defines the pricing model
- Trainee pays at booking (or auto-debit on confirmed attendance)
- Likely Stripe / Paddle integration; mocked store-side for tests

## Architecture impact (informs the codebase refactor)

These changes touch the same code the audit just flagged:

- §3 (approval) extends the **profile** domain — reinforces #2/#3 candidate (unify auth + profile + status into one boundary).
- §4 (cancel request flow) rewrites the **booking** domain — reinforces #1 candidate (collapse BookingService/BookingTransaction). New states (`cancel_requested`, `cancel_approved`) belong inside one orchestrator, not two.
- §1+§2 (richer profiles + dashboards) expand the API surface — reinforces #5 candidate (pre-enriched admin queries so routes don't N+1 loop).

The refactor candidates should be evaluated **with these changes in mind** — designs that anticipate the new states/fields will pay back twice.
