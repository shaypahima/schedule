import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireCoach } from "@/lib/auth/require";

/** Coach dashboard view: pending counts + today's roster + urgent requests. */
export async function GET(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { coachRead } = getContainer();
  const dashboard = await coachRead.getCoachDashboard();
  return NextResponse.json(dashboard);
}
