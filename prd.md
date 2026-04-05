## Problem Statement

A personal coach with 25-40 trainees currently manages all scheduling manually — every Saturday, setting availability for the upcoming Sun–Fri week via WhatsApp messages and Google Calendar. Trainees cannot self-serve; every booking, cancellation, and reschedule requires direct communication. This process does not scale and consumes significant time each week.

## Solution

A web app where trainees self-book into the coach's available time slots. The app reads the coach's Google Calendar to determine availability, presents bookable 60-minute slots in a day-by-day view, and writes bookings back to Google Calendar. Trainees log in via phone OTP. An admin panel gives the coach full control over overrides, trainee management, and weekly visibility.

**Key constraints:**
- Slots hold 2 trainees by default (couple training), overridable to 3 by admin
- Max 2 sessions per trainee per week
- Max 3 edits (cancel/reschedule) per trainee per week
- 7-hour lockout before session start (admin-overridable)
- Recurring trainees are auto-booked every Saturday via cron; skipped if their usual slot is unavailable
- Google Calendar is the single source of truth for availability (no separate working hours setting)
- Timezone: Asia/Jerusalem
- Coach is notified via push/email on cancel/reschedule

## User Stories

1. As a trainee, I want to log in with my phone number and OTP, so that I can access the booking system securely without passwords
2. As a trainee, I want to see available slots day-by-day (Sun–Fri), so that I can find a time that works for me
3. As a trainee, I want to see remaining capacity on each slot (e.g., "1 spot left"), so that I know if I can still book — without seeing other trainees' names
4. As a trainee, I want to book a session in an available slot, so that I can train with my coach
5. As a trainee, I want to book up to 2 sessions per week, so that I can train multiple times
6. As a trainee, I want to cancel a booked session, so that I can free up my spot if I can't make it
7. As a trainee, I want to reschedule a booked session to a different available slot, so that I can adjust my plans
8. As a trainee, I want to see how many edits I have remaining this week (out of 3), so that I use them wisely
9. As a trainee, I want to be prevented from editing a session within 7 hours of its start, so that I understand the booking policy
10. As a trainee, I want to contact my coach from within the app when I'm locked out, so that I can request an exception
11. As a recurring trainee, I want my usual slot to be auto-booked each week, so that I don't have to manually book every Saturday
12. As a recurring trainee, I want to cancel or reschedule my auto-booked session, so that I retain flexibility
13. As a recurring trainee, I want my auto-booked session to count toward my 2/week max but NOT toward my 3-edit limit, so that auto-booking doesn't penalize me
14. As the coach (admin), I want to see all bookings for the current week in one view, so that I can plan my days
15. As the coach, I want to manually add a trainee to a slot, so that I can handle special requests
16. As the coach, I want to manually remove a trainee from a slot, so that I can handle cancellations on their behalf
17. As the coach, I want to invite new trainees by phone number, so that they can access the system
18. As the coach, I want to set a trainee as "recurring" with a preferred day/time, so that the auto-book cron assigns them weekly
19. As the coach, I want to override a slot's capacity from 2 to 3, so that I can fit an extra trainee when needed
20. As the coach, I want to override the 7-hour lockout for a specific slot, so that I can allow late changes when I'm flexible
21. As the coach, I want to override a trainee's 3-edit limit, so that I can grant exceptions
22. As the coach, I want to be notified (push/email) when a trainee cancels or reschedules, so that I'm aware of changes to my schedule
23. As the coach, I want the app to write bookings to my Google Calendar as events (with trainee name), so that my calendar stays up to date
24. As the coach, I want the app to delete Google Calendar events when a trainee cancels, so that my calendar reflects reality
25. As the coach, I want the auto-book cron to run every Saturday automatically, so that recurring trainees are pre-assigned without my intervention
26. As the coach, I want the auto-book cron to skip recurring trainees whose usual slot is unavailable that week, so that I can handle those manually
27. As the coach, I want to manage bookings only through the app (not directly in Google Calendar), so that the app remains the source of truth for bookings

## Implementation Decisions

### Tech Stack
- **Framework:** Next.js (TypeScript) deployed on Vercel
- **Database & Auth:** Supabase (Postgres + built-in phone OTP auth)
- **Calendar:** Google Calendar API via OAuth2 (one calendar, read/write)
- **Notifications:** Push notifications and/or email to the coach (no SMS beyond OTP auth)
- **Timezone:** All times in Asia/Jerusalem

### Modules

**Auth Module (Supabase Phone OTP)**
- Trainee signup/login via phone number + OTP (Supabase built-in)
- Admin role stored in Supabase user metadata or a `profiles` table
- Session management via Supabase client

**Google Calendar Integration Module**
- OAuth2 flow for the coach to connect their Google account (one-time setup)
- Read: fetch free/busy data for Sun-Fri of current week
- Write: create event on booking (title = trainee name, 60-min duration)
- Delete: remove event on cancellation
- Tokens stored securely in Supabase

**Slot Availability Engine**
- Consumes Google Calendar free/busy data and generates available 60-min slots
- Respects per-slot capacity (default 2, override to 3)
- Enforces 7-hour lockout (with admin override flag per slot)
- Race condition handling via optimistic locking (DB-level constraint on slot capacity)

**Booking Module**
- Book: assign trainee to slot, decrement capacity, write to Google Calendar
- Cancel: remove trainee from slot, increment capacity, delete Google Calendar event
- Reschedule: cancel + book in single transaction
- Enforces: max 2 sessions/week per trainee, max 3 edits/week per trainee
- Triggers coach notification on cancel/reschedule

**Auto-Book Cron**
- Runs every Saturday (Vercel cron or Supabase edge function)
- For each recurring trainee: check if their preferred slot is available then book it
- If slot unavailable: skip (coach handles manually)
- Auto-booked sessions count toward 2/week max but NOT toward 3-edit limit

**Admin Module**
- Week view of all bookings
- Trainee management (invite, set recurring, remove)
- Per-slot capacity override
- Per-trainee edit limit override
- Per-slot 7-hour lockout override
- Manual add/remove trainees from slots

**Notification Module**
- Push and/or email to coach on cancel/reschedule
- Abstraction layer for swappable provider

**Trainee Booking UI**
- Day-by-day navigation (Sun-Fri)
- Slot list with remaining capacity (no trainee names visible)
- Book/cancel/reschedule actions
- Remaining edits counter
- Contact coach option when locked out

### Database Schema (key tables)
- `profiles` — user info, phone, role (admin/trainee), recurring flag, preferred day/time
- `slots` — date, start_time, capacity (default 2), lockout_override, capacity_override
- `bookings` — slot_id, trainee_id, status, google_event_id, is_auto_booked
- `edit_log` — trainee_id, week, edit_count
- `coach_settings` — google_oauth_tokens, notification_preferences

### Key Architectural Decisions
- Google Calendar is read for availability, but the app DB is the source of truth for bookings
- All booking mutations go through the app (coach will not edit booking events directly in Google Calendar)
- Optimistic locking on slot capacity to handle concurrent booking attempts
- Week defined as Sun-Fri, resetting each Saturday when auto-book runs
- 7-hour lockout calculated from slot start_time minus current time in Asia/Jerusalem

## Testing Decisions

Good tests verify external behavior (inputs to outputs), not implementation details. Tests should be resilient to refactoring — if the internal structure changes but behavior stays the same, tests should still pass.

### Modules to test:

**Slot Availability Engine**
- Given various Google Calendar free/busy responses, correct available slots generated
- Capacity limits respected (2 default, 3 when overridden)
- 7-hour lockout correctly blocks/allows based on current time and override flag
- Edge cases: overnight boundaries, fully booked days, empty calendars

**Booking Module**
- Booking succeeds when slot has capacity, fails when full
- 2 sessions/week limit enforced
- 3 edits/week limit enforced (cancel and reschedule both count)
- Auto-booked sessions don't count toward edit limit
- Reschedule is atomic (cancel + book)
- Race condition: two simultaneous bookings for last spot — one succeeds, one fails

**Auto-Book Cron**
- Recurring trainees booked in their preferred slot when available
- Skipped when preferred slot is unavailable
- Counts toward 2/week max
- Does not count toward 3-edit limit

## Out of Scope

- WhatsApp integration
- Buffer time between sessions
- Private (1-person only) sessions
- Trainee-to-trainee visibility (seeing who is in your slot)
- Notifications to trainees for auto-bookings
- Multiple Google Calendars
- Payment processing
- Mobile native app (web only)
- Multi-coach / multi-business support

## Further Notes

- The coach currently has between 25-40 active trainees — the system should handle this comfortably but does not need to scale to hundreds
- Domain name still TBD — coach will purchase separately
- Google Cloud project setup required (free tier) for Calendar API credentials
- Supabase free tier sufficient for this user count
- Branding assets (logo, colors) will be provided by the coach
