# 24-hour soft cancel window with coach-approved requests, replacing the 7h hard lockout

The previous rule was a **7-hour hard lockout** — inside the window, Cancel and Reschedule were disabled entirely; trainees could only contact the coach off-app. The new rule replaces that with a **24-hour soft window**: cancels submitted *outside* 24 hours happen immediately (current behaviour, just with a wider edge); cancels submitted *inside* 24 hours go through a **cancel request** that the coach must approve or reject.

Reschedules inside 24h follow the same request flow with an optional target slot — coach approval cancels the old booking and books the new slot in one transaction.

## Considered options

- **Keep the 7h hard lockout** — rejected. Coach was already getting WhatsApp messages asking for exceptions; the lockout pushed work off-app instead of solving it. Moving the approval into the app gives the coach a queue, an audit, and notifications.
- **24h hard lockout (no requests)** — rejected. Wider, harder lockout. Pushes more work to WhatsApp; doesn't solve the real problem.
- **No lockout at all, but cap weekly cancels** — rejected. Edit limit alone can't stop a trainee cancelling the morning of every Friday session; coach needs explicit say.
- **Auto-expire pending requests at slot start; new `expired` enum state** — rejected. Adds a state with no behavioural difference from "coach didn't reply in time." UI treats pending-past-start as expired without persisting a separate value.
- **Trainee can withdraw pending requests** — rejected. Trainee changing their mind can WhatsApp the coach. Withdraw adds a fourth state and no real value.
- **Free the slot immediately on request submit; reconcile if coach rejects** — rejected. Creates a "your cancel was rejected, surprise, you're still booked" UX that's strictly worse than holding the slot until the coach decides.
- **Edit limit counts both immediate and approved-request cancels** — rejected. Edit-limit and coach-approval gate the same purpose (rate-limit churn) at different distances from the slot; stacking them double-charges the trainee.

## Consequences

- New table `booking_change_request` with columns: `booking_id`, `requested_new_slot_id` (nullable — bare cancel if null, reschedule if set), `reason` (required, free text), `status` (`pending | approved | rejected`), `requested_at`, `decided_at`, `decided_by`.
- While a request is `pending`, the booking's slot remains occupied — `currentBookings` ignores pending requests entirely. The 24h cancel window stays *held* until the coach decides.
- Pending requests past their slot's start time stay `pending` in the DB; the UI treats them as expired and the booking is treated as a no-show by default.
- **The 3-edits-per-week edit limit is removed entirely** (revised after first use): the 24h approval window is now the only cancel/reschedule gate. Outside the window, trainees cancel freely; inside it, the coach decides. Stacking both gates was redundant. `Bookings.getRemainingEdits` now returns `Infinity`; UI no longer surfaces an edit counter. The `edit_log` table remains in the schema as historical record but is no longer written to.
- `BookingTransaction` (or its successor) becomes the only place that knows about the request flow — routes call `tx.requestCancel(...)` / `tx.approveRequest(...)` / `tx.rejectRequest(...)`. This is one of the motivators for collapsing `BookingService` + `BookingTransaction` (see refactor candidate #1 from the architecture audit).
- New notifications fire on request submit (→ coach push + Hebrew copy) and request decision (→ trainee push). Reuses the FCM scaffold from Phase 10 once #25 unblocks.
- The Phase 5 "Contact Coach" CTA stays but its meaning narrows: it now fires when the request is rejected, not when the lockout is hit.
