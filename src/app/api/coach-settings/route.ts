import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth/require";
import { updateCoachContactPhone } from "@/lib/services/coach-info-repo";

const E164 = /^\+\d{8,15}$/;

export async function PATCH(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { contactPhone } = (await request.json()) as { contactPhone?: string };
  if (typeof contactPhone !== "string" || !E164.test(contactPhone)) {
    return NextResponse.json(
      { error: "contactPhone must be E.164 (e.g. +972501234567)" },
      { status: 400 }
    );
  }

  await updateCoachContactPhone(r.coach.userId, contactPhone);
  return NextResponse.json({ ok: true });
}
