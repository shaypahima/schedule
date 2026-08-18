import type { BookingError_Code } from "@/lib/services/bookings";

/**
 * Why a booking was refused, in words the trainee can act on. The gates
 * themselves live in the Bookings service and run in a fixed order; this only
 * gives the losing gate a voice.
 */
const MESSAGES: Partial<Record<BookingError_Code, string>> = {
  LOCKOUT: "אי אפשר לשנות אימון בטווח של 7 שעות לפני תחילתו.",
  WEEKLY_LIMIT: "הגעת למכסת האימונים לשבוע הזה.",
  SLOT_FULL: "האימון הזה מלא. אפשר להצטרף לרשימת המתנה.",
  ALREADY_BOOKED: "כבר קבעת את האימון הזה.",
  NOT_FOUND: "האימון הזה כבר לא זמין.",
  CONFLICT: "מישהו הספיק לפניך. רעננו ונסו שוב.",
};

const FALLBACK = "לא הצלחנו לקבוע את האימון. נסו שוב.";

export function bookingFailureMessage(code: BookingError_Code): string {
  return MESSAGES[code] ?? FALLBACK;
}
