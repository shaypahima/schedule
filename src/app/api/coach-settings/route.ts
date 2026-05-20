import { NextRequest, NextResponse } from "next/server";
import { getJwtSession } from "@/lib/services/jwt-session";
import { findProfile } from "@/lib/services/profile-repo";
import { updateCoachContactPhone } from "@/lib/services/coach-info-repo";

const E164 = /^\+\d{8,15}$/;

export async function PATCH(request: NextRequest) {
  const session = await getJwtSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await findProfile(session.userId);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "coach") {
    return NextResponse.json({ error: "Coach only" }, { status: 403 });
  }

  const { contactPhone } = (await request.json()) as { contactPhone?: string };
  if (typeof contactPhone !== "string" || !E164.test(contactPhone)) {
    return NextResponse.json(
      { error: "contactPhone must be E.164 (e.g. +972501234567)" },
      { status: 400 }
    );
  }

  await updateCoachContactPhone(profile.id, contactPhone);
  return NextResponse.json({ ok: true });
}
