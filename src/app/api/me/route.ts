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

/** Promote status='pending' → 'active' for invitees on first authenticated call. */
async function promoteIfPending(id: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await db
    .from("profiles")
    .update({ status: "active" })
    .eq("id", id)
    .eq("status", "pending");
}

export async function GET(req: NextRequest) {
  const session = await getJwtSession(req);
  if (!session) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let profile = await loadProfile(session.userId);
  if (!profile) {
    profile = await createProfile({
      userId: session.userId,
      email: session.email,
      name: session.email.split("@")[0],
      role: isCoachEmail(session.email) ? "coach" : "trainee",
    });
  } else {
    await promoteIfPending(session.userId);
  }

  // COACH_EMAIL env always wins over DB role (handles late role promotion)
  const role = isCoachEmail(profile.email) ? "coach" : profile.role;
  return NextResponse.json({ ...profile, role });
}
