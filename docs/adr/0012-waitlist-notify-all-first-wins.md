# ADR-0012: Waitlist = notify-all, first-to-book wins

Date: 2026-06-12
Status: Accepted

## Context

Slots have capacity 2-3 and ~10 active trainees; full slots are common at
prime hours. Trainees asked (via the coach) to know when a spot frees up.
Three standard designs exist: auto-promote the first in line, give the first
in line a timed exclusive hold, or notify everyone and let the normal booking
flow decide.

## Decision

Notify **all** waitlisted trainees when a spot opens; the first to complete
the normal booking flow gets it. No queue order, no hold, no auto-booking.
Entries expire silently at slot start. Caps/rules enforce at booking time.

## Why not the alternatives

- **Auto-promote** creates bookings the trainee didn't re-confirm. A surprise
  booking is a manufactured no-show — the exact metric the reminders work
  (#36) exists to reduce. Rejected on behavioral grounds, not effort.
- **Timed hold** needs a hold state machine + expiry sweep + "your hold
  expired" comms. At a 1-2 person queue depth, that machinery serves nobody.

The race between two notified trainees is already solved — the booking path's
optimistic capacity check rejects the loser with the existing "המקום נתפס"
flow.

## Consequences

- Waitlist is a notification subscription, not a reservation: one table
  (slot, trainee, created_at), join/leave endpoints, a hook on the two
  spot-opening events (cancel, approved cancel-request).
- Depends on a real NotificationService delivery channel (#36 FCM); until
  then entries accrue but pushes only log via the mock.
- If queue depth ever grows past a handful, revisit with a hold design — the
  subscription table ports cleanly to that.
