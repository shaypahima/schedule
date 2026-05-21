import { BookingStore } from "./booking-store";
import { NotificationService } from "./notification";

const WINDOW_START_MIN = 60;
const WINDOW_END_MIN = 65;

export interface RemindersResult {
  sent: number;
  skipped: number;
}

/**
 * Selects confirmed bookings whose slot starts in [now+60min, now+65min),
 * pushes a 1h-before reminder to each trainee, stamps reminder_sent_at.
 * Idempotent — `reminderSentAt` filter on the store skips already-notified rows.
 */
export async function sendDueReminders(
  store: BookingStore,
  notifier: NotificationService,
  now: Date = new Date()
): Promise<RemindersResult> {
  const windowStart = new Date(now.getTime() + WINDOW_START_MIN * 60 * 1000);
  const windowEnd = new Date(now.getTime() + WINDOW_END_MIN * 60 * 1000);

  const due = await store.getRemindersDue(windowStart, windowEnd);

  let sent = 0;
  let skipped = 0;
  for (const { booking, slot } of due) {
    try {
      await notifier.notifyTrainee({
        traineeId: booking.traineeId,
        slotDate: slot.date,
        slotTime: slot.startTime,
      });
      await store.markReminderSent(booking.id, now);
      sent++;
    } catch {
      skipped++;
    }
  }

  return { sent, skipped };
}
