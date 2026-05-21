import { BookingStore } from "./booking-store";
import { Bookings } from "./bookings";

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
  bookings: Bookings,
  store: BookingStore,
  weekStartDate: string // YYYY-MM-DD (Sunday)
): Promise<AutoBookResult[]> {
  // store is reserved for future enrichment (currently unused beyond Bookings).
  void store;
  const results: AutoBookResult[] = [];

  for (const trainee of trainees) {
    const [y, m, d] = weekStartDate.split("-").map(Number);
    const slotDate = new Date(y, m - 1, d + trainee.preferredDay);
    const dateStr = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, "0")}-${String(slotDate.getDate()).padStart(2, "0")}`;

    // Check 2/week limit (bypass skips this in book, so check manually)
    const status = await bookings.status(trainee.id, dateStr);
    if (status.bookingsLeft <= 0) {
      results.push({
        traineeId: trainee.id,
        success: false,
        reason: "Already has 2 sessions this week",
      });
      continue;
    }

    const slotId = `slot-${dateStr}-${trainee.preferredTime}`;

    const result = await bookings.book(trainee.id, slotId, {
      bypass: true,
      isAutoBooked: true,
      traineeName: trainee.name,
    });

    if (result.ok) {
      results.push({
        traineeId: trainee.id,
        success: true,
        bookingId: result.booking.id,
      });
    } else {
      results.push({
        traineeId: trainee.id,
        success: false,
        reason: result.message,
      });
    }
  }

  return results;
}
