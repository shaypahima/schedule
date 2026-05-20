import { NextRequest, NextResponse } from "next/server";
import { getJwtSession } from "@/lib/services/jwt-session";
import { findProfile, createProfile, Profile } from "@/lib/services/profile-repo";

function coachEmails(): string[] {
  return (process.env.COACH_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function roleFor(email: string, fallback: Profile["role"]): Profile["role"] {
  return coachEmails().includes(email) ? "admin" : fallback;
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
  }

  return NextResponse.json({
    ...profile,
    role: roleFor(session.email, profile.role),
  });
}
