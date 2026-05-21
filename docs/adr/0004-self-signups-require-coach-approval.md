# Self-signups require coach approval; invited trainees skip approval

Trainees enter the system two ways. **Invited trainees** (coach added their email up-front) auto-activate on first sign-in — the invitation *is* the approval. **Self-signups** (anyone authenticating via Google without an invitation) must complete an intro form and then wait for coach approval before they can book.

A self-signup whose intro is submitted lands in `profiles.status = 'pending'`. Coach approval transitions to `active`. Coach rejection transitions to `rejected` (new terminal state distinct from `deactivated`). Rejected profiles are kept for audit; the same email cannot re-apply.

## Considered options

- **Kill self-signup entirely; invitations only** — rejected. Useful as a barrier but breaks the "stranger hears about the coach, downloads the app, requests to join" path the coach wants to keep open.
- **Approve everyone always (including invitees)** — rejected. Doubles coach workload for the common case where the coach already knows the trainee they invited. Adds a click for zero gain.
- **Reject = delete row + auth user** — rejected. No audit trail; same email can spam-apply. Keeping a `rejected` row is cheaper than dealing with disputes later.
- **Reuse `deactivated` for rejected** — rejected. "Removed an active trainee" and "refused a self-signup" are different domain events that should stay distinguishable in the data.

## Consequences

- New `status` enum value `rejected`. Migration extends the existing `pending | active | deactivated` set.
- New `trainee_profile` table holds the intro form fields: `phone` (re-introduced, contact-only — not auth), `intro_text` (required free text). Both populated before the profile becomes visible to the coach.
- `/api/me` auto-promote logic changes: invited (`pending` from invite-flow) → `active` on first call only if `trainee_profile.intro_text` is present *or* the invite-flow marked them as pre-approved. Self-signups stay `pending` until coach acts.
- Coach UI gains a "pending approvals" list (count + detail screen). No auto-TTL on pending — single-coach app, the queue stays small enough to triage manually.
- `Rejected` trainees see a terminal "your request was declined" screen if they try to sign in again.
