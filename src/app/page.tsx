import Link from "next/link";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { todayIL } from "@/lib/services/israel-time";
import { upcomingDays } from "@/lib/slots/day-strip";
import { bookingFailureMessage } from "@/lib/slots/booking-copy";
import { getDaySlots, bookedSlotIdsFor } from "@/lib/slots/board";
import type { BookingError_Code } from "@/lib/services/bookings";
import { getContainer } from "@/lib/services";
import { getTraineeProfile } from "@/lib/services/trainee-profile-repo";
import { profileCompletion } from "@/lib/profile/completion";
import { bookSlot } from "./book/actions";
import { joinWaitlist, leaveWaitlist } from "./book/waitlist-actions";
import { signOut } from "./auth/actions";

const DAYS_AHEAD = 7;

export default async function TraineeHomePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    failed?: string;
    booked?: string;
    waitlisted?: string;
    left_waitlist?: string;
    hide_nudge?: string;
  }>;
}) {
  const session = await requireActiveTraineeSession();
  const {
    date,
    failed,
    booked,
    waitlisted,
    left_waitlist,
    hide_nudge: dismissed,
  } = await searchParams;

  const today = todayIL();
  const days = upcomingDays(today, DAYS_AHEAD);
  const selected = days.some((d) => d.date === date) ? date! : today;

  const { waitlist } = getContainer();
  const [slots, bookedSlotIds, waitlistedSlotIds, profile] = await Promise.all([
    getDaySlots(selected),
    bookedSlotIdsFor(session.userId),
    waitlist.slotIdsFor(session.userId).then((ids) => new Set(ids)),
    getTraineeProfile(session.userId),
  ]);

  const completion = profileCompletion(profile);
  const showNudge = !completion.complete && !dismissed;

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">שלום, {session.name}</h1>
          <nav className="flex items-center gap-4">
            <Link href="/bookings" className="text-sm underline">
              האימונים שלי
            </Link>
            <Link href="/progress" className="text-sm underline">
              התקדמות
            </Link>
            <Link href="/history" className="text-sm underline">
              היסטוריה
            </Link>
            <Link href="/profile" className="text-sm underline">
              פרופיל
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-sm text-black/50 underline">
                התנתקות
              </button>
            </form>
          </nav>
        </header>

        {showNudge && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-black/15 p-3 text-sm">
            <div>
              <p className="font-medium">הפרופיל שלך {completion.percent}% מלא</p>
              <p className="text-black/50">
                עוד כמה פרטים עוזרים למאמן להתאים לך אימון.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link href="/profile" className="underline">
                השלמה
              </Link>
              <Link
                href={`/?date=${selected}&hide_nudge=1`}
                className="text-black/40"
              >
                לא עכשיו
              </Link>
            </div>
          </div>
        )}

        {booked && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            האימון נקבע. נתראה!
          </p>
        )}
        {waitlisted && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            נרשמת לרשימת ההמתנה. כשמתפנה מקום כולם מקבלים הודעה — הראשון שקובע
            זוכה.
          </p>
        )}
        {left_waitlist && (
          <p className="rounded-lg bg-black/5 p-3 text-sm text-black/60">
            יצאת מרשימת ההמתנה.
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
                href={`/?date=${day.date}${dismissed ? "&hide_nudge=1" : ""}`}
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
                ) : isFull ? (
                  waitlistedSlotIds.has(slot.id) ? (
                    <form action={leaveWaitlist} className="text-center">
                      <input type="hidden" name="slotId" value={slot.id} />
                      <input type="hidden" name="date" value={selected} />
                      <p className="text-xs text-black/50">ברשימת המתנה</p>
                      <button type="submit" className="text-xs underline">
                        יציאה
                      </button>
                    </form>
                  ) : (
                    <form action={joinWaitlist}>
                      <input type="hidden" name="slotId" value={slot.id} />
                      <input type="hidden" name="date" value={selected} />
                      <button
                        type="submit"
                        className="rounded-lg border border-black/20 px-4 py-2 text-sm"
                      >
                        רשימת המתנה
                      </button>
                    </form>
                  )
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
