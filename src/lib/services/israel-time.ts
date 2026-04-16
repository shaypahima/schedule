import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { startOfWeek, format } from "date-fns";

export const ISRAEL_TZ = "Asia/Jerusalem";

/** Today's date in Israel as YYYY-MM-DD */
export function todayIL(): string {
  const now = toZonedTime(new Date(), ISRAEL_TZ);
  return format(now, "yyyy-MM-dd");
}

/** Parse "YYYY-MM-DD" + "HH:mm" as Israel wall-clock time → UTC Date */
export function israelSlotToUTC(date: string, time: string): Date {
  return fromZonedTime(new Date(`${date}T${time}:00`), ISRAEL_TZ);
}

/** Sunday of the week containing date (Israel-local) → YYYY-MM-DD */
export function weekStartForDate(date: string): string {
  // Use noon to avoid DST edge cases at midnight
  const local = toZonedTime(new Date(`${date}T12:00:00Z`), ISRAEL_TZ);
  const sun = startOfWeek(local, { weekStartsOn: 0 });
  return format(sun, "yyyy-MM-dd");
}

/** True if "now" is past the lockout threshold for a slot */
export function isLockedOut(
  date: string,
  time: string,
  lockoutHours = 7
): boolean {
  const slotUTC = israelSlotToUTC(date, time);
  return Date.now() > slotUTC.getTime() - lockoutHours * 3_600_000;
}
