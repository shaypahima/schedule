import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireCoach } from "@/lib/auth/require";

/** Pending change-requests for the coach to decide on. */
export async function GET(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { coachRead } = getContainer();
  const requests = await coachRead.getPendingChangeRequests();
  return NextResponse.json({ requests });
}
