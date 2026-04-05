import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/services/session";
import { getBookingStore, getBookingService } from "@/lib/services";
import { getWeekStart } from "@/lib/services/booking-service";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

/** Admin: reset trainee edit count for current week */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

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
