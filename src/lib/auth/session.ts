import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabase, hasSupabaseEnv } from "@/lib/supabase/server";
import { loadOrProvisionProfile } from "./provision";
import { DEV_SESSION_COOKIE, isDevAuthEnabled, readDevIdentity } from "./dev-session";

export type WebSession = {
  userId: string;
  email: string;
  name: string;
  role: "coach" | "trainee";
  status: "pending" | "active" | "rejected" | "deactivated";
  hasIntro: boolean;
};

export type Destination =
  | "/sign-in"
  | "/coach"
  | "/intro"
  | "/pending"
  | "/rejected"
  | "/deactivated"
  | "/";

type Identity = { userId: string; email: string; name?: string };

/**
 * The authenticated identity behind this request, from Supabase in the normal
 * case and from the dev cookie on the local Postgres path (which has no
 * GoTrue to ask).
 */
async function getIdentity(): Promise<Identity | null> {
  if (isDevAuthEnabled()) {
    const cookieStore = await cookies();
    const dev = readDevIdentity(cookieStore.get(DEV_SESSION_COOKIE)?.value);
    if (dev) return dev;
  }

  if (!hasSupabaseEnv()) return null;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  return {
    userId: user.id,
    email: user.email,
    name: (user.user_metadata?.full_name as string | undefined) ?? undefined,
  };
}

/**
 * Who is asking, resolved from the request's cookies. Returns null for an
 * anonymous visitor — provisioning only ever happens for an authenticated
 * identity, never on the strength of a cookie alone.
 */
export async function getWebSession(): Promise<WebSession | null> {
  const identity = await getIdentity();
  if (!identity) return null;

  const profile = await loadOrProvisionProfile(identity);

  return {
    userId: profile.userId,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    status: profile.status,
    hasIntro: profile.hasIntro,
  };
}

/**
 * The one place that decides which screen a visitor belongs on. Pure so the
 * role/status matrix is testable without cookies, a database, or a browser.
 */
export function resolveDestination(session: WebSession | null): Destination {
  if (!session) return "/sign-in";
  if (session.role === "coach") return "/coach";
  // A self-signup owes the coach an intro before they can be reviewed.
  if (session.status === "pending") {
    return session.hasIntro ? "/pending" : "/intro";
  }
  // Rejected happens before a trainee was ever active; deactivated after.
  // Different stories, so different screens.
  if (session.status === "rejected") return "/rejected";
  if (session.status === "deactivated") return "/deactivated";
  return "/";
}

/**
 * Guard a coach-only page. Anyone else is sent to the screen they do belong
 * on, so a wrong turn lands somewhere useful instead of an error.
 */
export async function requireCoachSession(): Promise<WebSession> {
  const session = await getWebSession();
  if (!session || session.role !== "coach") {
    redirect(resolveDestination(session));
  }
  return session;
}

/** Guard a page that only an approved, still-active trainee may use. */
export async function requireActiveTraineeSession(): Promise<WebSession> {
  const session = await getWebSession();
  if (!session || session.role !== "trainee" || session.status !== "active") {
    redirect(resolveDestination(session));
  }
  return session;
}
