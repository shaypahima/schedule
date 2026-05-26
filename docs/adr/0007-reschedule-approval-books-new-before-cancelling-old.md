# Reschedule approval books the new slot before cancelling the old one

When a coach approves a reschedule request, the new booking is created **before** the old booking is cancelled. If the target slot has filled since the request was submitted (race), approval fails with `SLOT_FULL`; the request stays `pending`, the old booking is preserved, and the coach gets a clear error.

Previously: old booking was cancelled first, then `this.book(...)` was called on the new slot. If `book` returned `SLOT_FULL` (race), the result was silently discarded — request stamped `approved`, trainee left with nothing. Surfaced as #55.

## Considered options

- **Hold target slot capacity at request submit time** — rejected. Mirrors the way the OLD slot is held during a cancel request, but doubles the held capacity per pending reschedule and adds a release path on reject/expire. Schema and behaviour changes across `requestReschedule`, `decideRequest`, and the expiry path. Disproportionate for a low-frequency race.
- **Book-new-before-cancel-old** — chosen. One reordering inside `decideRequest`, no schema change. The window for any further race shrinks to a single `book(..., bypass: true)` call against the in-memory store; if it loses, `SLOT_FULL` propagates up and the coach sees the conflict.
- **Auto-reject the request with a `reason: "target_full"` decision note** — rejected. Coach often wants to discuss alternatives with the trainee; auto-reject forces a re-request round trip when a "try again with a different target" UX is cheaper.

## Consequences

- Coach receives `SLOT_FULL` (HTTP 409) when approving a reschedule whose target has filled. The request stays `pending` so the coach can re-decide (likely after texting the trainee an alternative).
- For the brief window between `book()` succeeding and the old `updateBooking({ ..., status: "cancelled" })` completing, the trainee holds confirmed bookings on **both** slots. This is acceptable: `bypass: true` skips the weekly cap, no domain rule forbids transient double-holding across distinct slots, and the second step almost always succeeds (in-process store update).
- If `deleteCalendarEvent` or `updateBooking` fails after the new booking has been written, we land in an ugly state: trainee has two confirmed bookings. Same hazard as the existing `reschedule()` method (lines 273-347) — not introduced by this change. Tracked implicitly under #55's follow-up.
- `decideRequest` no longer returns `{ ok: true, effectedBooking: undefined }`: every successful approval now produces an `effectedBooking` for reschedule decisions. Callers relying on the `undefined` branch will get an error result instead.
