export type StripDay = {
  date: string; // YYYY-MM-DD
  label: string; // Hebrew weekday name
  dayOfMonth: number;
};

const HEBREW_WEEKDAYS = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The run of days a trainee can page through when picking a session. Built on
 * UTC arithmetic over plain date strings — these are calendar days being
 * labelled, so no clock or DST shift should ever move one.
 */
export function upcomingDays(fromDate: string, count: number): StripDay[] {
  const start = new Date(`${fromDate}T00:00:00Z`).getTime();

  return Array.from({ length: count }, (_, i) => {
    const day = new Date(start + i * DAY_MS);
    return {
      date: day.toISOString().slice(0, 10),
      label: HEBREW_WEEKDAYS[day.getUTCDay()],
      dayOfMonth: day.getUTCDate(),
    };
  });
}
