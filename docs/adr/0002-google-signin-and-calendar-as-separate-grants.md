# Google Sign-In and Google Calendar OAuth are separate consent flows on the same email

The coach has two distinct interactions with Google: signing in to the app (auth scope: `email`, `profile`) and granting the server offline access to write their calendar (scope: `https://www.googleapis.com/auth/calendar`). We deliberately keep these as **two separate consent screens** even though they will, in practice, use the same Google account.

The server enforces that the email returned by the Calendar OAuth flow matches the signed-in user's email — preventing a split-brain state where the coach is signed in as A but writes to B's calendar.

## Considered options

- **Single combined flow at sign-in** — rejected. Asking for Calendar write scope on first sign-in is invasive; many users abandon. Also: Supabase's Google OAuth provider does not by default issue a refresh token usable for long-lived calendar writes — entangling auth + Calendar means rebuilding Supabase's auth flow.
- **Allow the two identities to differ** — rejected. There is exactly one coach; allowing identity divergence creates a confusing edge case for no real-world value.

## Consequences

- After signing in, the coach must tap a separate "Connect Calendar" button in settings before bookings can write back to Google Calendar.
- The existing server-side Calendar OAuth flow at `/api/auth/google/*` (Phase 4, `b835b18`) is **retained as-is** rather than collapsed into the new Supabase Auth path.
- If the Calendar token is revoked, the coach can reconnect Calendar without re-authenticating their app session.
- The email-match check is a small piece of server logic — must be implemented and tested when wiring up Google Sign-In.
