import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getJwtSession } from "@/lib/services/jwt-session";
import { findProfile, createProfile, Profile } from "@/lib/services/profile-repo";

function coachEmails(): string[] {
  return (process.env.COACH_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function roleFor(email: string, fallback: Profile["role"]): Profile["role"] {
  return coachEmails().includes(email) ? "coach" : fallback;
}

/** Promote status='pending' → 'active' on first authenticated call. */
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
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let profile = await findProfile(session.userId);
  if (!profile) {
    profile = await createProfile({
      id: session.userId,
      email: session.email,
      name: session.email.split("@")[0],
      role: roleFor(session.email, "trainee"),
    });
  } else {
    // Existing profile — promote pending invitee to active on this first call.
    await promoteIfPending(session.userId);
  }

  return NextResponse.json({
    ...profile,
    role: roleFor(session.email, profile.role),
  });
}
