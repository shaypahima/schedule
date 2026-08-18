import Link from "next/link";
import { requireCoachSession } from "@/lib/auth/session";
import { getRealCalendarService } from "@/lib/services";
import { todayIL } from "@/lib/services/israel-time";
import { connectCalendar, updateSlotSettings } from "./actions";

const ERRORS: Record<string, string> = {
  CALENDAR_NOT_CONFIGURED: "יומן Google לא מוגדר בשרת.",
  INVALID_INPUT: "הפרטים שהוזנו אינם תקינים.",
};

export default async function CoachSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; failed?: string }>;
}) {
  await requireCoachSession();
  const { done, failed } = await searchParams;

  const calendar = getRealCalendarService();
  const connected = calendar ? await calendar.isConnected() : false;

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">הגדרות</h1>
          <Link href="/coach" className="text-sm underline">
            לוח הבקרה
          </Link>
        </header>

        {done && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            ההגדרות נשמרו.
          </p>
        )}
        {failed && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {ERRORS[failed] ?? "אירעה שגיאה."}
          </p>
        )}

        <section className="space-y-3 rounded-lg border border-black/15 p-4">
          <h2 className="text-lg font-semibold">יומן Google</h2>
          <p className="text-sm text-black/60">
            חיבור היומן קובע אילו שעות פנויות להזמנה, ורושם כל אימון כאירוע.
          </p>

          {!calendar ? (
            <p className="text-sm text-black/50">
              היומן לא מוגדר בשרת (מצב mock).
            </p>
          ) : connected ? (
            <p className="text-sm font-medium text-green-700">היומן מחובר.</p>
          ) : (
            <form action={connectCalendar}>
              <button
                type="submit"
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
              >
                חיבור יומן Google
              </button>
            </form>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-black/15 p-4">
          <h2 className="text-lg font-semibold">חריגות בשעה מסוימת</h2>
          <p className="text-sm text-black/60">
            שינוי מספר המקומות בשעה מסוימת, או פתיחתה לשינויים גם בתוך חלון
            7 השעות.
          </p>

          <form action={updateSlotSettings} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-sm font-medium">תאריך</span>
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={todayIL()}
                  className="w-full rounded-lg border border-black/15 px-3 py-2"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">שעה</span>
                <input
                  name="startTime"
                  type="time"
                  step={3600}
                  required
                  className="w-full rounded-lg border border-black/15 px-3 py-2"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium">מספר מקומות</span>
              <input
                name="capacity"
                type="number"
                min={0}
                required
                defaultValue={2}
                className="w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="lockoutOverride" />
              לאפשר שינויים גם בתוך 7 השעות
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white"
            >
              שמירה
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
