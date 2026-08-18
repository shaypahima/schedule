import Link from "next/link";
import { requireCoachSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";
import { withPastFlag } from "@/lib/coach/roster-view";
import { signOut } from "../auth/actions";
import { markNoShow } from "./actions";

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <div className="rounded-lg border border-black/15 p-4 text-center">
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-black/60">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function CoachHomePage() {
  const session = await requireCoachSession();
  const { coachRead } = getContainer();
  const dashboard = await coachRead.getCoachDashboard();

  const roster = withPastFlag(dashboard.todayRoster);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">שלום, {session.name}</h1>
          <nav className="flex items-center gap-4">
            <Link href="/coach/week" className="text-sm underline">
              שבוע
            </Link>
            <Link href="/coach/trainees" className="text-sm underline">
              מתאמנים
            </Link>
            <Link href="/coach/settings" className="text-sm underline">
              הגדרות
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-sm text-black/50 underline">
                התנתקות
              </button>
            </form>
          </nav>
        </header>

        <section className="grid grid-cols-3 gap-3">
          <Stat
            label="ממתינים לאישור"
            value={dashboard.pendingApprovals}
            href="/coach/approvals"
          />
          <Stat
            label="בקשות שינוי"
            value={dashboard.pendingChangeRequests}
            href="/coach/requests"
          />
          <Stat label="אי-הגעות השבוע" value={dashboard.noShowsThisWeek} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">מי מגיע היום</h2>

          {roster.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-black/50">
              אין אימונים היום.
            </p>
          ) : (
            <ul className="space-y-2">
              {roster.map((entry) => {
                return (
                  <li
                    key={entry.bookingId}
                    className="flex items-center justify-between rounded-lg border border-black/15 p-3"
                  >
                    <div>
                      <span className="font-medium">{entry.slotTime}</span>
                      <span className="mx-2 text-black/30">·</span>
                      <Link
                        href={`/coach/trainees/${entry.trainee.id}`}
                        className="underline"
                      >
                        {entry.trainee.name}
                      </Link>
                    </div>

                    {entry.status === "no_show" ? (
                      <span className="text-sm text-red-700">לא הגיע/ה</span>
                    ) : entry.isPast && entry.status === "confirmed" ? (
                      <form action={markNoShow}>
                        <input type="hidden" name="bookingId" value={entry.bookingId} />
                        <button
                          type="submit"
                          className="rounded-lg border border-black/20 px-3 py-1 text-sm"
                        >
                          סימון אי-הגעה
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
