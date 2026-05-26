import type { ReminderKind } from "@/lib/types";
import { BookingStore } from "./booking-store";
import { NotificationService } from "./notification";

const SLOT_DURATION_MIN = 60;
const WINDOW_HALF_WIDTH_MIN = 5;

const TARGET_OFFSET_MIN: Record<ReminderKind, number> = {
  // For pre-session reminders the offset is "minutes from now until slot start".
  reminder_24h: 24 * 60,
  reminder_2h: 2 * 60,
  // For post-session prompt the offset is "minutes since slot END". Slots are
  // 60 min, so 30 min after end = 90 min after start. We negate to put the
  // window in the past (slot started 95-85 min ago).
  post_session: -(SLOT_DURATION_MIN + 30),
};

export interface RemindersResult {
  /** Per-kind sent counts; sum across kinds is the total push fan-out. */
  sent: Record<ReminderKind, number>;
  /** Total skipped due to notifier failure. */
  skipped: number;
}

/**
 * Single cron entrypoint. Walks the three reminder windows (24h, 2h,
 * 30min-post-session), notifies due trainees, stamps the matching column
 * to keep it idempotent. ±5min tolerance matches the 5-min cron schedule.
 */
export async function sendDueReminders(
  store: BookingStore,
  notifier: NotificationService,
  now: Date = new Date()
): Promise<RemindersResult> {
  const sent: Record<ReminderKind, number> = {
    reminder_24h: 0,
    reminder_2h: 0,
    post_session: 0,
  };
  let skipped = 0;

  for (const kind of ["reminder_24h", "reminder_2h", "post_session"] as const) {
    const targetMinutes = TARGET_OFFSET_MIN[kind];
    const windowStart = new Date(
      now.getTime() + (targetMinutes - WINDOW_HALF_WIDTH_MIN) * 60 * 1000
    );
    const windowEnd = new Date(
      now.getTime() + (targetMinutes + WINDOW_HALF_WIDTH_MIN) * 60 * 1000
    );

    const due = await store.getRemindersDue(kind, windowStart, windowEnd);

    for (const { booking, slot } of due) {
      try {
        await notifier.notifyTrainee({
          traineeId: booking.traineeId,
          slotDate: slot.date,
          slotTime: slot.startTime,
          kind,
        });
        await store.markReminderSent(booking.id, kind, now);
        sent[kind]++;
      } catch {
        skipped++;
      }
    }
  }

  return { sent, skipped };
}
