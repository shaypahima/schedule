import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { todayIL, weekStartForDate } from "@/lib/services/israel-time";
import { requireCoach } from "@/lib/auth/require";

/** Admin: reset trainee edit count for current week */
export async function POST(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { traineeId } = await request.json();
  if (!traineeId) {
    return NextResponse.json({ error: "traineeId required" }, { status: 400 });
  }

  const today = todayIL();
  const weekStart = weekStartForDate(today);
  const { store, limits } = getContainer();
  await store.resetEditCount(traineeId, weekStart);

  const remaining = await limits.getRemainingEdits(traineeId, weekStart);
  return NextResponse.json({ traineeId, weekStart, remainingEdits: remaining });
}
