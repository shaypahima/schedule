import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/route-guard";
import { getContainer } from "@/lib/services";
import { todayIL } from "@/lib/services/israel-time";
import { weekStartForDate } from "@/lib/services/israel-time";

/** Admin: reset trainee edit count for current week */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

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
