import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireCoach } from "@/lib/auth/require";

export async function GET(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { coachRead } = getContainer();
  const pending = await coachRead.getPendingApprovals();
  return NextResponse.json({ pending });
}
