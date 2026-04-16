# Ubiquitous Language

## People

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Coach** | The single person who owns the calendar and manages all trainees | Trainer, instructor, admin user |
| **Trainee** | A person who books training sessions with the coach | Client, user, student, customer |

## Scheduling

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Slot** | A 60-minute window on a specific date that can hold up to N trainees | Time slot, session slot, appointment |
| **Session** | A confirmed training occurrence — a trainee occupying a slot | Appointment, class, meeting |
| **Booking** | The act and record of a trainee claiming a slot | Reservation, appointment |
| **Capacity** | The maximum number of trainees a slot can hold (default 2, overridable to 3) | Max bookings, limit |
| **Couple training** | The default mode where 2 trainees share a slot simultaneously | Pair training, group session |

## Booking lifecycle

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Book** | A trainee claims an available slot, creating a confirmed booking | Reserve, schedule, sign up |
| **Cancel** | A trainee releases their booking, freeing the slot capacity | Remove, delete, unbook |
| **Reschedule** | A single atomic operation: cancel old booking + book new slot | Move, change, swap |
| **Auto-book** | System-initiated booking for recurring trainees, run by the Saturday cron | Auto-schedule, recurring booking |

## Limits & rules

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Weekly limit** | Maximum 2 confirmed sessions per trainee per week (Sun–Sat) | Booking limit, session cap |
| **Edit** | Any cancel or reschedule action that modifies a trainee's bookings | Change, modification |
| **Edit limit** | Maximum 3 edits per trainee per week (Sun–Sat) | Change limit, modification cap |
| **Lockout** | The 7-hour window before a session during which modifications are blocked | Freeze, cutoff, blackout |
| **Lockout override** | A per-slot flag set by the coach that disables the lockout rule | Lockout bypass, lockout waiver |
| **Week** | A Sun–Sat period used for limit accounting, starting at midnight Israel time | Weekly period |

## Recurring trainees

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Recurring trainee** | A trainee flagged to be auto-booked each week at their preferred day/time | Regular, subscriber |
| **Preferred day** | The day of week (0=Sun..5=Fri) a recurring trainee wants their session | Default day |
| **Preferred time** | The hour (HH:mm) a recurring trainee wants their session | Default time |

## Admin operations

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Admin book** | Coach manually places a trainee into a slot, bypassing all limits | Force book, override book |
| **Admin cancel** | Coach removes a trainee from a slot, bypassing all limits | Force cancel |
| **Edit reset** | Coach zeroes out a trainee's edit count for the current week | Edit override |
| **Capacity override** | Coach changes a slot's max capacity (e.g., 2 → 3) | Slot resize |

## Calendar integration

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Availability** | Free periods on the coach's Google Calendar, computed via FreeBusy API | Free slots, openings |
| **Calendar event** | A Google Calendar entry created when a booking is confirmed | GCal event, appointment |
| **Write-back** | The act of creating/deleting a Google Calendar event to mirror a booking | Calendar sync, event sync |

## Relationships

- A **Trainee** has zero or more **Bookings** per **Week**
- A **Booking** belongs to exactly one **Slot** and one **Trainee**
- A **Slot** holds up to **Capacity** concurrent **Bookings**
- A **Booking** may have an associated **Calendar event** (null if calendar unavailable)
- An **Edit** is tracked per **Trainee** per **Week** via an **Edit log**
- A **Reschedule** counts as exactly 1 **Edit**, not 2
- An **Auto-book** booking is exempt from the **Edit limit** when cancelled

## Example dialogue

> **Dev:** "When a **Trainee** tries to **book** a **slot**, what checks run?"
> **Domain expert:** "First, is the **slot** within the **lockout** window? If yes, block unless there's a **lockout override**. Then check the **weekly limit** — max 2 **sessions**. Then check **capacity**."

> **Dev:** "What about **reschedule**? Does it count as 2 **edits**?"
> **Domain expert:** "No. A **reschedule** is one atomic action — 1 **edit**. We check the **edit limit** once, against the old **slot's** week. If it passes, cancel old + book new. If the new **slot** is full, the old **booking** stays confirmed."

> **Dev:** "And **auto-booked** trainees?"
> **Domain expert:** "A **recurring trainee** gets **auto-booked** by the Saturday cron. If they later **cancel** that **booking**, it doesn't count toward their **edit limit**. But if they manually **book** and then **cancel**, that counts."

> **Dev:** "What if the **calendar event** fails to create?"
> **Domain expert:** "The **booking** should not succeed. Roll back the **slot** capacity. No silent null **calendar events** in production."

## Flagged ambiguities

- **"Session" vs "Slot" vs "Booking"**: The codebase sometimes uses these interchangeably. A **Slot** is the time window. A **Booking** is a trainee's claim on that slot. A **Session** is the training that happens — it's the domain concept, while **Booking** is the system record. Use **Slot** when discussing time/capacity, **Booking** when discussing trainee actions, **Session** when discussing what the trainee actually attends.

- **"Admin" as role vs person**: In code, `role: "admin"` is a system role. In the domain, the admin IS the **Coach**. There is exactly one coach. "Admin" should only appear in auth/role contexts — use **Coach** when discussing domain actions like overrides and calendar management.

- **"Edit" overloaded**: In the domain, an **Edit** means cancel or reschedule. In the codebase, `EditLog` tracks edit counts. The word "edit" should never mean "modify a booking's fields" — that concept doesn't exist. An edit is always a destructive action (cancel or reschedule).

- **"Auto-booked" as adjective vs verb**: `isAutoBooked` on a Booking means "was created by the cron, not by the trainee." This flag affects edit-limit exemption. It's not a separate booking type — it's a provenance marker. Consider renaming to `bookedByCron` or `systemBooked` for clarity, though `isAutoBooked` is established.
