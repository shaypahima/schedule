import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { autoBookRecurring, RecurringTrainee } from "@/lib/services/auto-book";
import { requireCron } from "@/lib/route-guard";

export async function GET(request: NextRequest) {
  const { error } = requireCron(request);
  if (error) return error;

  const { auth, tx, limits, store } = getContainer();
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

  // Calculate next week's Sunday
  const today = new Date();
  const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  const weekStart = `${nextSunday.getFullYear()}-${String(nextSunday.getMonth() + 1).padStart(2, "0")}-${String(nextSunday.getDate()).padStart(2, "0")}`;

  const results = await autoBookRecurring(
    recurringTrainees,
    tx,
    limits,
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
