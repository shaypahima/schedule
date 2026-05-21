import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getJwtSession } from "@/lib/services/jwt-session";
import { loadProfile, createProfile } from "@/lib/auth/profile-repo";

function coachEmails(): string[] {
  return (process.env.COACH_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isCoachEmail(email: string): boolean {
  return coachEmails().includes(email);
}

/** Auto-provision a row for a brand-new self-signup. */
async function provisionSelfSignup(
  userId: string,
  email: string,
  status: "active" | "pending"
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await db.from("profiles").update({ status }).eq("id", userId);
}

export async function GET(req: NextRequest) {
  const session = await getJwtSession(req);
  if (!session) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const isCoach = isCoachEmail(session.email);
  let profile = await loadProfile(session.userId);

  if (!profile) {
    // First sign-in for an unknown user. Coaches via COACH_EMAIL go straight
    // to active. Self-signup trainees land in 'pending' and must complete the
    // intro form before the coach can approve them.
    profile = await createProfile({
      userId: session.userId,
      email: session.email,
      name: session.email.split("@")[0],
      role: isCoach ? "coach" : "trainee",
    });
    if (!isCoach) {
      await provisionSelfSignup(session.userId, session.email, "pending");
      profile = (await loadProfile(session.userId)) ?? profile;
    }
  }

  // COACH_EMAIL env always wins over DB role (handles late role promotion).
  const role = isCoach ? "coach" : profile.role;
  return NextResponse.json({ ...profile, role });
}
