import Link from "next/link";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { todayIL } from "@/lib/services/israel-time";
import { getUpcomingBookings } from "@/lib/bookings/my-bookings";
import { getOpenSlotsAhead } from "@/lib/slots/board";
import { bookingFailureMessage } from "@/lib/slots/booking-copy";
import type { BookingError_Code } from "@/lib/services/bookings";
import {
  cancelBooking,
  requestCancel,
  requestReschedule,
  rescheduleBooking,
} from "./actions";

const DAYS_AHEAD = 7;

const NOTICES: Record<string, string> = {
  cancelled: "האימון בוטל.",
  moved: "האימון הועבר.",
  requested: "הבקשה נשלחה למאמן.",
};

function SlotPicker({ slots }: { slots: { id: string; date: string; startTime: string }[] }) {
  return (
    <select
      name="newSlotId"
      required
      className="rounded-lg border border-black/15 px-2 py-1 text-sm"
    >
      <option value="">בחרו מועד חדש</option>
      {slots.map((slot) => (
        <option key={slot.id} value={slot.id}>
          {slot.date} · {slot.startTime}
        </option>
      ))}
    </select>
  );
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireActiveTraineeSession();
  const params = await searchParams;

  const [bookings, openSlots] = await Promise.all([
    getUpcomingBookings(session.userId),
    getOpenSlotsAhead(todayIL(), DAYS_AHEAD),
  ]);

  const notice = Object.keys(NOTICES).find((k) => params[k]);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">האימונים שלי</h1>
          <Link href="/" className="text-sm underline">
            קביעת אימון
          </Link>
        </header>

        {notice && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            {NOTICES[notice]}
          </p>
        )}
        {params.failed && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {bookingFailureMessage(params.failed as BookingError_Code)}
          </p>
        )}

        {bookings.length === 0 && (
          <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-black/50">
            אין אימונים קרובים.
          </p>
        )}

        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="space-y-3 rounded-lg border border-black/15 p-4"
            >
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-semibold">
                  {booking.date} · {booking.startTime}
                </p>
                {booking.insideCancelWindow && !booking.pendingRequest && (
                  <span className="text-xs text-black/50">
                    פחות מ-24 שעות — נדרש אישור המאמן
                  </span>
                )}
              </div>

              {booking.pendingRequest ? (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {booking.pendingRequest.requestedNewSlotId
                    ? "בקשת העברה ממתינה לאישור המאמן."
                    : "בקשת ביטול ממתינה לאישור המאמן."}
                </p>
              ) : booking.insideCancelWindow ? (
                <div className="space-y-3">
                  <form action={requestCancel} className="flex flex-wrap gap-2">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input
                      name="reason"
                      required
                      placeholder="סיבת הביטול"
                      className="flex-1 rounded-lg border border-black/15 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-black/20 px-3 py-1 text-sm"
                    >
                      בקשת ביטול
                    </button>
                  </form>

                  <form action={requestReschedule} className="flex flex-wrap gap-2">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <SlotPicker slots={openSlots} />
                    <input
                      name="reason"
                      required
                      placeholder="סיבת ההעברה"
                      className="flex-1 rounded-lg border border-black/15 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-black/20 px-3 py-1 text-sm"
                    >
                      בקשת העברה
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-3">
                  <form action={rescheduleBooking} className="flex flex-wrap gap-2">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <SlotPicker slots={openSlots} />
                    <button
                      type="submit"
                      className="rounded-lg border border-black/20 px-3 py-1 text-sm"
                    >
                      העברה
                    </button>
                  </form>

                  <form action={cancelBooking}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <button
                      type="submit"
                      className="text-sm text-red-700 underline"
                    >
                      ביטול האימון
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
