import Link from "next/link";
import { requireCoachSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";
import { invite, deactivate } from "../actions";

const NOTICES: Record<string, string> = {
  invited: "ההזמנה נשלחה.",
  deactivated: "המתאמן/ת הוסרו מהרשימה הפעילה.",
};

const TREND_LABEL: Record<string, string> = {
  up: "▲",
  down: "▼",
  flat: "=",
};

export default async function TraineesPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; failed?: string }>;
}) {
  await requireCoachSession();
  const { done, failed } = await searchParams;

  const { coachRead } = getContainer();
  const trainees = await coachRead.getTraineesList("all");
  const active = trainees.filter((t) => t.status === "active");

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">מתאמנים</h1>
          <Link href="/coach" className="text-sm underline">
            לוח הבקרה
          </Link>
        </header>

        {done && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            {NOTICES[done]}
          </p>
        )}
        {failed && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {decodeURIComponent(failed)}
          </p>
        )}

        <form
          action={invite}
          className="flex flex-wrap gap-2 rounded-lg border border-black/15 p-4"
        >
          <input
            name="email"
            type="email"
            required
            dir="ltr"
            placeholder="email@example.com"
            className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
          <input
            name="name"
            placeholder="שם (רשות)"
            className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            הזמנה
          </button>
        </form>
        <p className="-mt-4 text-xs text-black/50">
          מוזמן/ת נכנס/ת ישירות כפעיל/ה — בלי מסך אישור.
        </p>

        <ul className="space-y-2">
          {active.map((trainee) => (
            <li
              key={trainee.id}
              className="flex items-center justify-between rounded-lg border border-black/15 p-3"
            >
              <div>
                <Link
                  href={`/coach/trainees/${trainee.id}`}
                  className="font-medium underline"
                >
                  {trainee.name}
                </Link>
                <div className="flex flex-wrap gap-2 pt-1 text-xs text-black/50">
                  {trainee.lastWeightKg !== null && (
                    <span>
                      {trainee.lastWeightKg} ק&quot;ג{" "}
                      {trainee.weightTrend14d && TREND_LABEL[trainee.weightTrend14d]}
                    </span>
                  )}
                  {trainee.attendanceRate !== null && (
                    <span>נוכחות {Math.round(trainee.attendanceRate * 100)}%</span>
                  )}
                  {trainee.atRisk && (
                    <span className="text-red-700">
                      {trainee.atRisk === "no_shows" ? "אי-הגעות" : "לא פעיל/ה"}
                    </span>
                  )}
                </div>
              </div>

              <form action={deactivate}>
                <input type="hidden" name="traineeId" value={trainee.id} />
                <button type="submit" className="text-sm text-red-700 underline">
                  השבתה
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
