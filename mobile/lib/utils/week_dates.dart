/// Computes Sunday–Friday dates for the current week in the device's local TZ.
/// Returns a list of 6 `DateTime` values (Sun, Mon, ..., Fri).
/// Assumes the user is in Asia/Jerusalem (the target audience); ad-hoc DST is
/// the OS's problem.
List<DateTime> currentWeekSunToFri([DateTime? now]) {
  final base = now ?? DateTime.now();
  final today = DateTime(base.year, base.month, base.day);
  final daysSinceSunday = today.weekday % 7; // Sun=7→0, Mon=1, ..., Sat=6
  final sunday = today.subtract(Duration(days: daysSinceSunday));
  return List.generate(6, (i) => sunday.add(Duration(days: i)));
}

String formatDate(DateTime d) =>
    '${d.year.toString().padLeft(4, "0")}-${d.month.toString().padLeft(2, "0")}-${d.day.toString().padLeft(2, "0")}';

const hebrewDayShort = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

/// Full Hebrew day-of-week names (Sun-Sat).
const hebrewDayLong = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
];

/// "יום רביעי • 20.5" style header label for [d].
String hebrewDayHeader(DateTime d) {
  final dow = hebrewDayLong[d.weekday % 7];
  return 'יום $dow • ${d.day}.${d.month}';
}

/// Hour-of-day greeting in Hebrew.
String hebrewGreeting([DateTime? now]) {
  final h = (now ?? DateTime.now()).hour;
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}
