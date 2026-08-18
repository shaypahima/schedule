import { getCalendarService, getContainer } from "@/lib/services";
import { generateAvailableSlots } from "@/lib/services/slot-availability";
import type { AvailableSlot } from "@/lib/services/slot-availability";
import { israelSlotToUTC } from "@/lib/services/israel-time";
import { upcomingDays } from "./day-strip";

/**
 * Every slot on offer for one day: the coach's calendar decides which hours
 * are free, existing slot rows carry the bookings already taken against them.
 */
export async function getDaySlots(date: string): Promise<AvailableSlot[]> {
  const calendar = getCalendarService();
  const { busy } = await calendar.getFreeBusy(
    israelSlotToUTC(date, "00:00"),
    israelSlotToUTC(date, "23:59"),
  );

  const { store } = getContainer();
  const existingSlots = await store.getAllSlotsForDate(date);

  return generateAvailableSlots(date, busy, existingSlots);
}

/** The slot ids this trainee already holds a live booking for. */
export async function bookedSlotIdsFor(traineeId: string): Promise<Set<string>> {
  const { store } = getContainer();
  const bookings = await store.getTraineeBookings(traineeId);
  return new Set(bookings.map((b) => b.slotId));
}

/**
 * Slots a trainee could still move into over the coming days — open capacity,
 * not locked out. Feeds the reschedule picker.
 */
export async function getOpenSlotsAhead(
  fromDate: string,
  days: number,
): Promise<AvailableSlot[]> {
  const dates = upcomingDays(fromDate, days).map((d) => d.date);
  const perDay = await Promise.all(dates.map(getDaySlots));

  return perDay
    .flat()
    .filter((slot) => slot.remainingCapacity > 0 && !slot.lockedOut);
}
