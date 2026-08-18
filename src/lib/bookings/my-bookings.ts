import { getContainer } from "@/lib/services";
import { israelSlotToUTC } from "@/lib/services/israel-time";
import { isInsideCancelWindow } from "./cancel-window";

export type MyBooking = {
  id: string;
  slotId: string;
  date: string;
  startTime: string;
  /** Inside the 24h window the trainee can only ask, not act. */
  insideCancelWindow: boolean;
  pendingRequest: {
    id: string;
    /** null target = a bare cancel; set = a reschedule. */
    requestedNewSlotId: string | null;
  } | null;
};

/**
 * A trainee's confirmed sessions still ahead of them, soonest first, each
 * carrying what they're allowed to do about it.
 */
export async function getUpcomingBookings(
  traineeId: string,
): Promise<MyBooking[]> {
  const { store } = getContainer();
  const bookings = await store.getTraineeBookings(traineeId);
  if (bookings.length === 0) return [];

  const slots = await store.getSlotsByIds([
    ...new Set(bookings.map((b) => b.slotId)),
  ]);
  const slotById = new Map(slots.map((s) => [s.id, s]));

  const now = Date.now();
  const upcoming = [];

  for (const booking of bookings) {
    const slot = slotById.get(booking.slotId);
    if (!slot) continue;
    if (israelSlotToUTC(slot.date, slot.startTime).getTime() <= now) continue;

    const pending = await store.getPendingRequestForBooking(booking.id);
    upcoming.push({
      id: booking.id,
      slotId: booking.slotId,
      date: slot.date,
      startTime: slot.startTime,
      insideCancelWindow: isInsideCancelWindow(slot.date, slot.startTime, now),
      pendingRequest: pending
        ? { id: pending.id, requestedNewSlotId: pending.requestedNewSlotId }
        : null,
    });
  }

  return upcoming.sort(
    (a, b) =>
      israelSlotToUTC(a.date, a.startTime).getTime() -
      israelSlotToUTC(b.date, b.startTime).getTime(),
  );
}
