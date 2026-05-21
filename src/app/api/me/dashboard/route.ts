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

  // Include cancelled + no_show — getTraineeBookings filters to confirmed only.
  const all = (await store.getAllBookings()).filter((b) => b.traineeId === userId);

  // Sessions this month
  const todayStr = todayIL();
  const [yy, mm] = todayStr.split("-").map(Number);
  let sessionsThisMonth = 0;
  let pastConfirmed = 0;
  let noShows = 0;
  let nextSessionAt: string | null = null;
  let nextSessionMs = Infinity;

  // Collect past sessions (confirmed + no_show) for streak calculation.
  const pastForStreak: { ms: number; status: "confirmed" | "no_show" }[] = [];

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
    if (ms < now && (b.status === "confirmed" || b.status === "no_show")) {
      pastForStreak.push({ ms, status: b.status });
    }
  }

  // Streak: walk past sessions newest → oldest, count confirmed until a no_show breaks the chain.
  pastForStreak.sort((a, b) => b.ms - a.ms);
  let currentStreak = 0;
  for (const p of pastForStreak) {
    if (p.status === "confirmed") currentStreak++;
    else break;
  }

  const totalPast = pastConfirmed + noShows;
  const attendanceRate = totalPast > 0 ? pastConfirmed / totalPast : 1;

  const recentVisibleNotes = await listVisibleNotesForTrainee(userId, 1);

  const weekStart = weekStartForDate(todayStr);
  const remainingEdits = await bookings.getRemainingEdits(userId, weekStart);

  const memberSinceDays = Math.floor(
    (now - new Date(r.trainee.createdAt).getTime()) / (24 * 60 * 60 * 1000),
  );

  return NextResponse.json({
    sessionsThisMonth,
    pastConfirmed,
    noShows,
    attendanceRate,
    currentStreak,
    nextSessionAt,
    recentVisibleNote: recentVisibleNotes[0] ?? null,
    remainingEdits,
    memberSinceDays,
  });
}
