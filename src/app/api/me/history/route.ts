import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireActiveTrainee } from "@/lib/auth/require";
import { israelSlotToUTC } from "@/lib/services/israel-time";

type HistoryEntry = {
  bookingId: string;
  slotId: string;
  date: string;
  startTime: string;
  status: "confirmed" | "cancelled" | "no_show";
  startsAt: string; // ISO
  isPast: boolean;
};

/** Full history for the active trainee — confirmed, cancelled, no_show — newest first. */
export async function GET(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { store } = getContainer();
  const all = await store.getAllBookings();
  const mine = all.filter((b) => b.traineeId === r.trainee.userId);

  const now = Date.now();
  const entries: HistoryEntry[] = [];
  for (const b of mine) {
    const slot = await store.getSlot(b.slotId);
    if (!slot) continue;
    const startsAtMs = israelSlotToUTC(slot.date, slot.startTime).getTime();
    entries.push({
      bookingId: b.id,
      slotId: b.slotId,
      date: slot.date,
      startTime: slot.startTime,
      status: b.status as HistoryEntry["status"],
      startsAt: new Date(startsAtMs).toISOString(),
      isPast: startsAtMs < now,
    });
  }
  entries.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return NextResponse.json({ history: entries });
}
