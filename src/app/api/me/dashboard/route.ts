import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireActiveTrainee } from "@/lib/auth/require";
import { listVisibleNotesForTrainee } from "@/lib/services/notes-repo";
import { israelSlotToUTC, todayIL, weekStartForDate } from "@/lib/services/israel-time";

/** Trainee dashboard view — aggregates booking-derived stats + most-recent visible note. */
export async function GET(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { store, bookings } = getContainer();
  const userId = r.trainee.userId;
  const now = Date.now();

  const all = await store.getTraineeBookings(userId);

  // Sessions this month
  const todayStr = todayIL();
  const [yy, mm] = todayStr.split("-").map(Number);
  let sessionsThisMonth = 0;
  let pastConfirmed = 0;
  let noShows = 0;
  let nextSessionAt: string | null = null;
  let nextSessionMs = Infinity;

  for (const b of all) {
    const slot = await store.getSlot(b.slotId);
    if (!slot) continue;
    const ms = israelSlotToUTC(slot.date, slot.startTime).getTime();
    const [sy, sm] = slot.date.split("-").map(Number);
    if (sy === yy && sm === mm && b.status !== "cancelled") sessionsThisMonth++;
    if (b.status === "confirmed" && ms < now) pastConfirmed++;
    if (b.status === "no_show") noShows++;
    if (b.status === "confirmed" && ms > now && ms < nextSessionMs) {
      nextSessionMs = ms;
      nextSessionAt = new Date(ms).toISOString();
    }
  }

  const totalPast = pastConfirmed + noShows;
  const attendanceRate = totalPast > 0 ? pastConfirmed / totalPast : 1;

  const recentVisibleNotes = await listVisibleNotesForTrainee(userId, 1);

  const weekStart = weekStartForDate(todayStr);
  const remainingEdits = await bookings.getRemainingEdits(userId, weekStart);

  return NextResponse.json({
    sessionsThisMonth,
    pastConfirmed,
    noShows,
    attendanceRate,
    nextSessionAt,
    recentVisibleNote: recentVisibleNotes[0] ?? null,
    remainingEdits,
  });
}
