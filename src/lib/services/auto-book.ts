import { BookingService, BookingStore, getWeekStart } from "./booking-service";

export interface RecurringTrainee {
  id: string;
  name: string;
  preferredDay: number; // 0=Sun..5=Fri
  preferredTime: string; // HH:mm
}

export interface AutoBookResult {
  traineeId: string;
  success: boolean;
  bookingId?: string;
  reason?: string;
}

/**
 * Auto-book recurring trainees into their preferred slots for the given week.
 * Called by cron every Saturday for the upcoming week.
 */
export async function autoBookRecurring(
  trainees: RecurringTrainee[],
  bookingService: BookingService,
  store: BookingStore,
  weekStartDate: string // YYYY-MM-DD (Sunday)
): Promise<AutoBookResult[]> {
  const results: AutoBookResult[] = [];

  for (const trainee of trainees) {
    // Calculate the actual date for the preferred day
    const [y, m, d] = weekStartDate.split("-").map(Number);
    const slotDate = new Date(y, m - 1, d + trainee.preferredDay);
    const dateStr = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, "0")}-${String(slotDate.getDate()).padStart(2, "0")}`;

    // Check 2/week limit
    const ws = getWeekStart(dateStr);
    const weekBookings = store.getTraineeBookingsForWeek(trainee.id, ws);
    if (weekBookings.length >= 2) {
      results.push({
        traineeId: trainee.id,
        success: false,
        reason: "Already has 2 sessions this week",
      });
      continue;
    }

    // Find the slot
    const slotId = `slot-${dateStr}-${trainee.preferredTime}`;
    const slot = store.getSlot(slotId);
    if (!slot) {
      results.push({
        traineeId: trainee.id,
        success: false,
        reason: `Slot not found: ${slotId}`,
      });
      continue;
    }

    if (slot.currentBookings >= slot.capacity) {
      results.push({
        traineeId: trainee.id,
        success: false,
        reason: "Preferred slot is full",
      });
      continue;
    }

    // Check if already booked for this slot
    const existing = store
      .getConfirmedBookingsForSlot(slotId)
      .find((b) => b.traineeId === trainee.id);
    if (existing) {
      results.push({
        traineeId: trainee.id,
        success: false,
        reason: "Already booked in this slot",
      });
      continue;
    }

    try {
      // Use adminBook to bypass lockout/limits, then mark as auto-booked
      const booking = await bookingService.adminBook(
        trainee.id,
        slotId,
        trainee.name
      );
      // Mark as auto-booked
      store.updateBooking({ ...booking, isAutoBooked: true });

      results.push({
        traineeId: trainee.id,
        success: true,
        bookingId: booking.id,
      });
    } catch (err) {
      results.push({
        traineeId: trainee.id,
        success: false,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}
