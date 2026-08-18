import { NextRequest, NextResponse } from "next/server";
import { requireActiveTrainee } from "@/lib/auth/require";
import { getTraineeHistory } from "@/lib/bookings/history";

/** Full history for the active trainee — confirmed, cancelled, no_show — newest first. */
export async function GET(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const history = await getTraineeHistory(r.trainee.userId);
  return NextResponse.json({ history });
}
