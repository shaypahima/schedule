import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoachSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";
import { listNotesForTrainee } from "@/lib/services/notes-repo";
import { writeNote, removeNote } from "../../actions";

export default async function TraineeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string; failed?: string }>;
}) {
  await requireCoachSession();
  const [{ id }, { failed }] = await Promise.all([params, searchParams]);

  const { coachRead } = getContainer();
  const [detail, notes] = await Promise.all([
    coachRead.getTraineeDetail(id),
    listNotesForTrainee(id),
  ]);

  if (!detail) notFound();

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{detail.trainee.name}</h1>
          <Link href="/coach/trainees" className="text-sm underline">
            כל המתאמנים
          </Link>
        </header>

        <section className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-black/15 p-3">
            <p className="text-2xl font-bold">
              {Math.round(detail.attendanceRate * 100)}%
            </p>
            <p className="text-xs text-black/60">נוכחות</p>
          </div>
          <div className="rounded-lg border border-black/15 p-3">
            <p className="text-2xl font-bold">{detail.weekBookingsCount}</p>
            <p className="text-xs text-black/60">אימונים השבוע</p>
          </div>
          <div className="rounded-lg border border-black/15 p-3">
            <p className="text-2xl font-bold">
              {detail.trainee.lastWeightKg ?? "—"}
            </p>
            <p className="text-xs text-black/60">משקל אחרון</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">אימונים אחרונים</h2>
          {detail.recentBookings.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/15 p-4 text-center text-sm text-black/50">
              אין אימונים עדיין.
            </p>
          ) : (
            <ul className="space-y-1">
              {detail.recentBookings.map((entry) => (
                <li
                  key={entry.bookingId}
                  className="flex justify-between rounded-lg border border-black/15 px-3 py-2 text-sm"
                >
                  <span>
                    {entry.slotDate} · {entry.slotTime}
                  </span>
                  {entry.status === "no_show" && (
                    <span className="text-red-700">לא הגיע/ה</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">הערות</h2>

          {failed && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              צריך לכתוב תוכן להערה.
            </p>
          )}

          <form
            action={writeNote}
            className="space-y-2 rounded-lg border border-black/15 p-4"
          >
            <input type="hidden" name="traineeId" value={id} />
            <textarea
              name="body"
              required
              rows={3}
              placeholder="הערה על המתאמן/ת"
              className="w-full rounded-lg border border-black/15 px-3 py-2"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="visibleToTrainee" />
              גם המתאמן/ת יראו את ההערה
            </label>
            <button
              type="submit"
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
            >
              שמירת הערה
            </button>
          </form>

          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border border-black/15 p-3">
                <p className="whitespace-pre-wrap">{note.body}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-black/40">
                  <span>
                    {new Date(note.createdAt).toLocaleDateString("he-IL")}
                    {note.visibleToTrainee ? " · גלוי למתאמן/ת" : " · פרטי"}
                  </span>
                  <form action={removeNote}>
                    <input type="hidden" name="noteId" value={note.id} />
                    <input type="hidden" name="traineeId" value={id} />
                    <button type="submit" className="text-red-700 underline">
                      מחיקה
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
