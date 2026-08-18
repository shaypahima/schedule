import Link from "next/link";
import { requireCoachSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";
import { todayIL } from "@/lib/services/israel-time";
import { upcomingDays } from "@/lib/slots/day-strip";
import { getDaySlots } from "@/lib/slots/board";
import { addToSlot, removeFromSlot } from "../actions";

const DAYS_AHEAD = 7;

export default async function CoachWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireCoachSession();
  const { date } = await searchParams;

  const today = todayIL();
  const days = upcomingDays(today, DAYS_AHEAD);
  const selected = days.some((d) => d.date === date) ? date! : today;

  const { coachRead } = getContainer();
  const [roster, slots, trainees] = await Promise.all([
    coachRead.getDayBookings(selected),
    getDaySlots(selected),
    coachRead.getTraineesList("active"),
  ]);

  const bySlot = new Map<string, typeof roster>();
  for (const entry of roster) {
    if (entry.status === "cancelled") continue;
    bySlot.set(entry.slotId, [...(bySlot.get(entry.slotId) ?? []), entry]);
  }

  // Only hours someone booked, or that still have room, are worth a row.
  const rows = slots.filter(
    (slot) => (bySlot.get(slot.id)?.length ?? 0) > 0 || slot.remainingCapacity > 0,
  );

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">השבוע</h1>
          <Link href="/coach" className="text-sm underline">
            לוח הבקרה
          </Link>
        </header>

        <nav className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => (
            <Link
              key={day.date}
              href={`/coach/week?date=${day.date}`}
              className={`flex min-w-16 shrink-0 flex-col items-center rounded-lg border px-3 py-2 ${
                day.date === selected
                  ? "border-black bg-black text-white"
                  : "border-black/15 hover:bg-black/5"
              }`}
            >
              <span className="text-xs">{day.label}</span>
              <span className="text-lg font-semibold">{day.dayOfMonth}</span>
            </Link>
          ))}
        </nav>

        <ul className="space-y-3">
          {rows.map((slot) => {
            const booked = bySlot.get(slot.id) ?? [];
            return (
              <li key={slot.id} className="space-y-2 rounded-lg border border-black/15 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold">{slot.startTime}</span>
                  <span className="text-sm text-black/50">
                    {booked.length} / {slot.capacity}
                  </span>
                </div>

                {booked.map((entry) => (
                  <div
                    key={entry.bookingId}
                    className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2"
                  >
                    <Link
                      href={`/coach/trainees/${entry.trainee.id}`}
                      className="text-sm underline"
                    >
                      {entry.trainee.name}
                    </Link>
                    <form action={removeFromSlot}>
                      <input type="hidden" name="bookingId" value={entry.bookingId} />
                      <input type="hidden" name="date" value={selected} />
                      <button type="submit" className="text-xs text-red-700 underline">
                        הסרה
                      </button>
                    </form>
                  </div>
                ))}

                {slot.remainingCapacity > 0 && (
                  <form action={addToSlot} className="flex gap-2">
                    <input type="hidden" name="slotId" value={slot.id} />
                    <input type="hidden" name="date" value={selected} />
                    <select
                      name="traineeId"
                      required
                      className="flex-1 rounded-lg border border-black/15 px-2 py-1 text-sm"
                    >
                      <option value="">הוספת מתאמן/ת</option>
                      {trainees.map((trainee) => (
                        <option key={trainee.id} value={trainee.id}>
                          {trainee.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-black/20 px-3 py-1 text-sm"
                    >
                      הוספה
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
