import { NextRequest, NextResponse } from "next/server";
import { getAuthService, getBookingService, getBookingStore } from "@/lib/services";
import { autoBookRecurring, RecurringTrainee } from "@/lib/services/auto-book";
import { getWeekStart } from "@/lib/services/booking-service";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authService = getAuthService();
  const allTrainees = await authService.getTrainees();

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
    getBookingService(),
    getBookingStore(),
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
