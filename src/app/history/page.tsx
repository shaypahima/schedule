import Link from "next/link";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { getTraineeHistory } from "@/lib/bookings/history";
import { listVisibleNotesForTrainee } from "@/lib/services/notes-repo";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "התקיים",
  cancelled: "בוטל",
  no_show: "לא הגעת",
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-green-50 text-green-800",
  cancelled: "bg-black/5 text-black/50",
  no_show: "bg-red-50 text-red-700",
};

export default async function HistoryPage() {
  const session = await requireActiveTraineeSession();

  const [history, notes] = await Promise.all([
    getTraineeHistory(session.userId),
    listVisibleNotesForTrainee(session.userId, 20),
  ]);

  const past = history.filter((entry) => entry.isPast);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">ההיסטוריה שלי</h1>
          <Link href="/" className="text-sm underline">
            קביעת אימון
          </Link>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">אימונים שעברו</h2>

          {past.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-black/50">
              עוד לא היו אימונים.
            </p>
          ) : (
            <ul className="space-y-2">
              {past.map((entry) => (
                <li
                  key={entry.bookingId}
                  className="flex items-center justify-between rounded-lg border border-black/15 p-3"
                >
                  <span className="font-medium">
                    {entry.date} · {entry.startTime}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      STATUS_STYLE[entry.status] ?? "bg-black/5"
                    }`}
                  >
                    {STATUS_LABEL[entry.status] ?? entry.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">הערות מהמאמן</h2>

          {notes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-black/50">
              אין עדיין הערות.
            </p>
          ) : (
            <ul className="space-y-2">
              {notes.map((note) => (
                <li key={note.id} className="rounded-lg border border-black/15 p-3">
                  <p className="whitespace-pre-wrap">{note.body}</p>
                  <p className="mt-2 text-xs text-black/40">
                    {new Date(note.createdAt).toLocaleDateString("he-IL")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
