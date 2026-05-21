# Velofit — domain glossary

Domain terms used by trainees, coach, and the booking app. Implementation details (table names, columns) live in code, not here.

## Profile lifecycle

**Trainee**: an end-user who books sessions with the coach.

**Coach**: the gym owner / personal trainer; sees all trainees, manages bookings, approves signups.

**Invited trainee**: a trainee whose email the coach added to the invite list before they ever opened the app. On first sign-in they are immediately **active** — no extra approval step.

**Self-signup**: a trainee who authenticates via Google without the coach having invited them. Self-signups land in **pending** state and cannot book until the coach approves.

**Intro**: the form a self-signup must complete before their profile is shown to the coach. Without it the coach has only the Google email + display name, which isn't enough context to approve. Submitting the intro transitions the profile into the **pending** queue the coach reviews. Required fields: phone (contact, not authentication) and a short free-text message ("why do you want to train with me?").

**Pending**: a self-signup awaiting coach review. Cannot book; sees a "waiting for approval" screen.

**Active**: an approved trainee who can book sessions.

**Rejected**: a self-signup the coach refused. Profile row stays for audit; same email cannot re-apply. Distinct from **deactivated** — rejection happens *before* the trainee ever became active.

**Deactivated**: a previously active trainee the coach explicitly removed. Bookings preserved for history; no new bookings allowed.

## Booking lifecycle

**Booking**: a confirmed reservation linking a trainee to a slot.

**Cancel window**: the 24-hour period before a slot's start time. Cancels submitted *outside* this window happen immediately (no coach approval). Cancels submitted *inside* it require coach approval.

**Cancel request**: a trainee's ask to cancel a booking inside the cancel window. States: `pending → approved | rejected`. Pending requests past the slot's start time are treated as expired by the UI but stay `pending` in the database — there's no separate `expired` state. While a request is `pending`, the booking's slot is still held — other trainees see the slot as occupied until the coach decides.

**Reschedule request**: structurally the same as a **cancel request**, but the trainee names a target slot they'd prefer. On coach approval the old booking is cancelled and the new slot is booked in the same transaction. A bare cancel request (no target slot) is the degenerate case.

**Edit limit**: cap of 3 cancels/reschedules per trainee per week, applied only to **immediate** edits (outside the cancel window). Inside-window requests are gated by coach approval, not by the counter — the two don't stack. Auto-booked sessions remain exempt from the counter.

## Attendance

**Attended**: a confirmed booking whose slot start time has passed and the coach has not flagged it as a no-show. Default state for past confirmed bookings — no coach action needed.

**No-show**: a confirmed booking where the trainee didn't turn up. Coach explicitly marks past confirmed bookings as `no_show` (an extension of `booking.status`). Counts against the trainee's attendance rate.

## Coach notes

**Coach note**: a free-text Hebrew note the coach writes about a trainee. Notes are the v1 progress-tracking primitive — no structured measurements, no training programs. Structured data may be added later if the coach asks for charts. Each note carries a **visible-to-trainee** flag; private by default. Notes flagged visible appear on the trainee's dashboard (most-recent first); the rest stay in the coach's view.

## Trainee profile data

**Trainee profile data**: the fitness-side of a trainee — phone, intro message, photo, optional age/height/weight/goals/medical notes. Lives in its own table (`trainee_profile`), 1:1 with `profiles`. Keeps `profiles` focused on auth + role; `trainee_profile` holds everything the coach cares about as a coach. The **intro** fields (phone + intro text) are required at self-signup; the rest is filled in over time. Photo lives in Supabase Storage; only the URL is on the row.
