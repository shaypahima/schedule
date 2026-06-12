# ADR-0010: Auth guard stays three modules; mock seams pin the file paths

## Status

Accepted (2026-06-12)

## Context

The 2026-06 architecture review proposed collapsing the auth stack
(`services/jwt-session.ts` → `auth/profile-repo.ts` → `auth/require.ts`) into one
deep module: the three always change together, and `require.ts` is the only
production caller chain.

## Decision

Keep the three files. ~25 route test files stub auth with
`vi.mock("@/lib/services/jwt-session")` and `vi.mock("@/lib/auth/profile-repo")` —
the module paths ARE the test seams. Physically merging the files breaks every
mock target for zero behavior gain.

What did change: `requireCron` folded into `auth/require.ts` (route-guard.ts
deleted), and both modules now reuse the shared supabase clients instead of
hand-rolling their own.

## Consequences

- jwt-session and profile-repo are internal seams of the auth module in spirit;
  treat `require.ts` as the interface routes call.
- Revisit only if the test suite moves off path-based `vi.mock` (e.g. to a
  container-injected auth seam).
