import { israelSlotToUTC } from "@/lib/services/israel-time";

/** The stretch before a session where a cancel needs the coach's blessing. */
export const CANCEL_WINDOW_HOURS = 24;

/**
 * Whether a session is close enough that cancelling it costs the coach a
 * decision. Outside the window the trainee acts freely; inside it they can
 * only ask. Takes `now` explicitly so the rule is testable at any hour.
 */
export function isInsideCancelWindow(
  date: string,
  startTime: string,
  now: number = Date.now(),
): boolean {
  const start = israelSlotToUTC(date, startTime).getTime();
  return now > start - CANCEL_WINDOW_HOURS * 3_600_000;
}
