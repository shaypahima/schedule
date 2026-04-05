import { TimePeriod, Slot } from "@/lib/types";

export interface AvailableSlot {
  id: string;
  date: string;
  startTime: string;
  capacity: number;
  currentBookings: number;
  remainingCapacity: number;
  lockoutOverride: boolean;
}

const SLOT_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const ISRAEL_TZ = "Asia/Jerusalem";

/**
 * Generate available 60-min slots for a given date.
 *
 * Takes Google Calendar busy periods and existing slot records (with booking counts)
 * and returns slots that are both free on the calendar AND have remaining capacity.
 */
export function generateAvailableSlots(
  date: string, // YYYY-MM-DD
  busyPeriods: TimePeriod[],
  existingSlots: Slot[]
): AvailableSlot[] {
  const slotMap = new Map<string, Slot>();
  for (const slot of existingSlots) {
    slotMap.set(slot.startTime, slot);
  }

  const available: AvailableSlot[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const timeStr = `${String(hour).padStart(2, "0")}:00`;

    // Build slot start/end as Date objects for overlap checking
    // Use the Israel timezone offset for April (IDT = UTC+3)
    const slotStart = new Date(`${date}T${timeStr}:00+03:00`);
    const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MS);

    // Check if this slot overlaps any busy period
    const isBusy = busyPeriods.some(
      (busy) => busy.start < slotEnd && busy.end > slotStart
    );
    if (isBusy) continue;

    // Check existing slot record for capacity
    const existing = slotMap.get(timeStr);
    const capacity = existing?.capacity ?? 2;
    const currentBookings = existing?.currentBookings ?? 0;
    const remainingCapacity = capacity - currentBookings;

    // Skip if full
    if (remainingCapacity <= 0) continue;

    available.push({
      id: existing?.id ?? `new-${date}-${timeStr}`,
      date,
      startTime: timeStr,
      capacity,
      currentBookings,
      remainingCapacity,
      lockoutOverride: existing?.lockoutOverride ?? false,
    });
  }

  return available;
}
