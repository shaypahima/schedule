import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { autoBookRecurring, RecurringTrainee } from "@/lib/services/auto-book";
import { requireCron } from "@/lib/auth/require";
import { todayIL, weekStartForDate } from "@/lib/services/israel-time";

export async function GET(request: NextRequest) {
  const { error } = requireCron(request);
  if (error) return error;

  const { auth, bookings, store } = getContainer();
  const allTrainees = await auth.getTrainees();

  const recurringTrainees: RecurringTrainee[] = allTrainees
    .filter(
      (t) =>
        t.isActive &&
        t.isRecurring &&
        t.preferredDay !== null &&
        t.preferredTime !== null
    )
    .map((t) => ({
      id: t.id,
      name: t.name,
      preferredDay: t.preferredDay!,
      preferredTime: t.preferredTime!,
    }));

  // Calculate next week's Sunday (Israel time)
  const todayStr = todayIL();
  const thisWeekStart = weekStartForDate(todayStr);
  const [y, m, d] = thisWeekStart.split("-").map(Number);
  const nextSunday = new Date(y, m - 1, d + 7, 12);
  const weekStart = `${nextSunday.getFullYear()}-${String(nextSunday.getMonth() + 1).padStart(2, "0")}-${String(nextSunday.getDate()).padStart(2, "0")}`;

  const results = await autoBookRecurring(
    recurringTrainees,
    bookings,
    store,
    weekStart
  );

  return NextResponse.json({
    weekStart,
    total: recurringTrainees.length,
    booked: results.filter((r) => r.success).length,
    skipped: results.filter((r) => !r.success).length,
    results,
  });
}
