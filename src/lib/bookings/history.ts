import { getContainer } from "@/lib/services";
import { israelSlotToUTC } from "@/lib/services/israel-time";

export type HistoryEntry = {
  bookingId: string;
  slotId: string;
  date: string;
  startTime: string;
  status: "confirmed" | "cancelled" | "no_show";
  startsAt: string; // ISO
  isPast: boolean;
};

/**
 * Everything that ever happened to this trainee's bookings — confirmed,
 * cancelled and no-show alike — newest first.
 */
export async function getTraineeHistory(
  traineeId: string,
): Promise<HistoryEntry[]> {
  const { store } = getContainer();
  const all = await store.getAllBookings();
  const mine = all.filter((b) => b.traineeId === traineeId);
  if (mine.length === 0) return [];

  // One batched slot read rather than getSlot() per booking.
  const slots = await store.getSlotsByIds([...new Set(mine.map((b) => b.slotId))]);
  const slotById = new Map(slots.map((s) => [s.id, s]));

  const now = Date.now();
  const entries: HistoryEntry[] = [];

  for (const booking of mine) {
    const slot = slotById.get(booking.slotId);
    if (!slot) continue;
    const startsAtMs = israelSlotToUTC(slot.date, slot.startTime).getTime();
    entries.push({
      bookingId: booking.id,
      slotId: booking.slotId,
      date: slot.date,
      startTime: slot.startTime,
      status: booking.status as HistoryEntry["status"],
      startsAt: new Date(startsAtMs).toISOString(),
      isPast: startsAtMs < now,
    });
  }

  return entries.sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );
}
