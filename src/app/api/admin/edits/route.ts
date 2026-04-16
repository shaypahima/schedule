import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/route-guard";
import { getBookingStore, getBookingService } from "@/lib/services";
import { getWeekStart } from "@/lib/services/booking-service";

/** Admin: reset trainee edit count for current week */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { traineeId } = await request.json();
  if (!traineeId) {
    return NextResponse.json({ error: "traineeId required" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = getWeekStart(today);
  getBookingStore().resetEditCount(traineeId, weekStart);

  const remaining = getBookingService().getRemainingEdits(traineeId, weekStart);
  return NextResponse.json({ traineeId, weekStart, remainingEdits: remaining });
}
