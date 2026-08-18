import { loadProfile, createProfile, setProfileStatus } from "./profile-repo";
import type { Profile } from "./profile-repo";

function coachEmails(): string[] {
  return (process.env.COACH_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isCoachEmail(email: string): boolean {
  return coachEmails().includes(email);
}

/**
 * Load the profile for an authenticated identity, provisioning one on first
 * sign-in. The single source of truth for what first sign-in means — a coach
 * (by COACH_EMAIL) lands active, a self-signup lands pending owing an intro.
 *
 * COACH_EMAIL always wins over the stored role, so promoting someone to coach
 * is an env change rather than a migration.
 */
export async function loadOrProvisionProfile(identity: {
  userId: string;
  email: string;
  name?: string;
}): Promise<Profile> {
  const isCoach = isCoachEmail(identity.email);
  const withRole = (p: Profile): Profile =>
    isCoach ? { ...p, role: "coach" } : p;

  const existing = await loadProfile(identity.userId);
  if (existing) return withRole(existing);

  const created = await createProfile({
    userId: identity.userId,
    email: identity.email,
    name: identity.name ?? identity.email.split("@")[0],
    role: isCoach ? "coach" : "trainee",
  });
  if (isCoach) return withRole(created);

  // Self-signups cannot book until the coach reviews them.
  await setProfileStatus(identity.userId, "pending");
  const reloaded = await loadProfile(identity.userId);
  return withRole(reloaded ?? { ...created, status: "pending" });
}
