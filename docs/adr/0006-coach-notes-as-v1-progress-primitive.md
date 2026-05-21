# Coach notes are the v1 progress-tracking primitive — no structured measurements, no training programs

The roadmap calls for "richer profiles" and "progress tracking" on the trainee dashboard. The v1 implementation models all of this as **free-text coach notes** — a single `coach_notes` table with `(trainee_id, body, visible_to_trainee, created_at)`. No structured weight/measurement history. No training-program domain. No exercise/set/rep schema.

Notes default to private (coach's working logbook). A per-note `visible_to_trainee` toggle exposes a note to the trainee's dashboard.

## Considered options

- **Notes + structured measurements (weight, body fat, key lifts)** — rejected for v1. Useful, but committing to a measurement schema now risks designing for a feature the coach hasn't asked for. Easier to add a `progress_entry` table later once notes prove inadequate.
- **Notes + measurements + training programs** — rejected. Program management is a separate product category (exercise libraries, set/rep tracking, periodisation). Out of scope.
- **No notes, no tracking — rely on the coach's memory** — rejected. The coach explicitly asked for richer profiles to enable better tracking; doing nothing fails the brief.
- **Notes always public to the trainee** — rejected. The coach's working notes ("Yael seems distracted lately") need a private surface. Defaulting to private + opt-in to share avoids accidental leaks.
- **Notes always private (trainee never sees them)** — rejected. Same table also has to deliver "great session today" feedback. One toggle reuses the storage instead of building an `announcements` table later.

## Consequences

- New table `coach_notes(id, trainee_id, body, visible_to_trainee, created_at, updated_at)`. RLS: coach can read/write all; trainee can read only `visible_to_trainee = true` rows scoped to themselves.
- Coach UI gets a notes panel on the trainee detail screen — list of past notes, textarea + visibility toggle to add a new one.
- Trainee dashboard surfaces the most-recent shared note. No notification on new shared notes for v1; trainee discovers them passively.
- "Progress tracking" on the trainee dashboard is **derived from bookings, not from structured progress entries** — sessions this month, streak, attendance rate, last session date. No charts of physical metrics in v1.
- If/when structured measurements arrive, they live in their own table (`progress_entry`) hanging off `trainee_profile` — `coach_notes` doesn't need to evolve to support them.
