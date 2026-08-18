import Link from "next/link";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { todayIL } from "@/lib/services/israel-time";
import { upcomingDays } from "@/lib/slots/day-strip";
import { bookingFailureMessage } from "@/lib/slots/booking-copy";
import { getDaySlots, bookedSlotIdsFor } from "@/lib/slots/board";
import type { BookingError_Code } from "@/lib/services/bookings";
import { bookSlot } from "./book/actions";
import { signOut } from "./auth/actions";

const DAYS_AHEAD = 7;

export default async function TraineeHomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; failed?: string; booked?: string }>;
}) {
  const session = await requireActiveTraineeSession();
  const { date, failed, booked } = await searchParams;

  const today = todayIL();
  const days = upcomingDays(today, DAYS_AHEAD);
  const selected = days.some((d) => d.date === date) ? date! : today;

  const [slots, bookedSlotIds] = await Promise.all([
    getDaySlots(selected),
    bookedSlotIdsFor(session.userId),
  ]);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">שלום, {session.name}</h1>
          <nav className="flex items-center gap-4">
            <Link href="/bookings" className="text-sm underline">
              האימונים שלי
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-sm text-black/50 underline">
                התנתקות
              </button>
            </form>
          </nav>
        </header>

        {booked && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            האימון נקבע. נתראה!
          </p>
        )}
        {failed && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {bookingFailureMessage(failed as BookingError_Code)}
          </p>
        )}

        <nav className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const isSelected = day.date === selected;
            return (
              <Link
                key={day.date}
                href={`/?date=${day.date}`}
                aria-current={isSelected ? "date" : undefined}
                className={`flex min-w-16 shrink-0 flex-col items-center rounded-lg border px-3 py-2 ${
                  isSelected
                    ? "border-black bg-black text-white"
                    : "border-black/15 hover:bg-black/5"
                }`}
              >
                <span className="text-xs">{day.label}</span>
                <span className="text-lg font-semibold">{day.dayOfMonth}</span>
              </Link>
            );
          })}
        </nav>

        <section className="space-y-2">
          {slots.length === 0 && (
            <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-black/50">
              אין אימונים פנויים ביום הזה.
            </p>
          )}

          {slots.map((slot) => {
            const alreadyBooked = bookedSlotIds.has(slot.id);
            const isFull = slot.remainingCapacity <= 0;
            const disabled = alreadyBooked || isFull || slot.lockedOut;

            return (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded-lg border border-black/15 p-4"
              >
                <div>
                  <p className="text-lg font-semibold">{slot.startTime}</p>
                  <p className="text-sm text-black/50">
                    {isFull
                      ? "מלא"
                      : `${slot.remainingCapacity} מתוך ${slot.capacity} מקומות פנויים`}
                  </p>
                </div>

                {alreadyBooked ? (
                  <span className="text-sm font-medium text-green-700">קבוע</span>
                ) : slot.lockedOut ? (
                  <span className="text-sm text-black/40">סגור לשינויים</span>
                ) : (
                  <form action={bookSlot}>
                    <input type="hidden" name="slotId" value={slot.id} />
                    <input type="hidden" name="date" value={selected} />
                    <button
                      type="submit"
                      disabled={disabled}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:bg-black/20"
                    >
                      קביעה
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
