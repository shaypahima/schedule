import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth/require";
import { updateCoachInfo, CoachInfoPatch } from "@/lib/services/coach-info-repo";

const E164 = /^\+\d{8,15}$/;

export async function PATCH(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const body = (await request.json()) as CoachInfoPatch;

  if (body.contactPhone !== undefined && !E164.test(body.contactPhone)) {
    return NextResponse.json(
      { error: "contactPhone must be E.164 (e.g. +972501234567)" },
      { status: 400 }
    );
  }
  if (body.yearsExperience !== undefined && body.yearsExperience !== null) {
    if (body.yearsExperience < 0 || body.yearsExperience > 80) {
      return NextResponse.json(
        { error: "yearsExperience out of range (0..80)" },
        { status: 400 }
      );
    }
  }

  await updateCoachInfo(r.coach.userId, body);
  return NextResponse.json({ ok: true });
}
