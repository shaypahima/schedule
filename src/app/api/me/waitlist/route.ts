import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireActiveTrainee } from "@/lib/auth/require";

/** Slot ids the trainee is waitlisted on (future slots only). */
export async function GET(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { waitlist } = getContainer();
  const slotIds = await waitlist.slotIdsFor(r.trainee.userId);
  return NextResponse.json({ slotIds });
}
