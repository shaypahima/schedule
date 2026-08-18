import Link from "next/link";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";
import { photoTimeline, pickComparePair } from "@/lib/progress/photo-timeline";
import { logMeasurement } from "./actions";

const ERRORS: Record<string, string> = {
  WEIGHT_INVALID: "משקל לא תקין.",
  UNSUPPORTED_TYPE: "אפשר להעלות תמונות JPEG, PNG או WebP בלבד.",
  TOO_LARGE: "התמונה גדולה מדי (עד 5MB).",
  NOTHING_TO_LOG: "צריך למלא לפחות שדה אחד.",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("he-IL");
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; failed?: string; before?: string; after?: string }>;
}) {
  const session = await requireActiveTraineeSession();
  const { done, failed, before, after } = await searchParams;

  const { progress } = getContainer();
  const measurements = await progress.listMeasurements(session.userId, {
    limit: 200,
    sinceDays: 365,
  });

  const photos = photoTimeline(measurements);
  const pair = pickComparePair(photos, before, after);
  const weights = measurements.filter((m) => m.weightKg !== null);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">ההתקדמות שלי</h1>
          <Link href="/" className="text-sm underline">
            קביעת אימון
          </Link>
        </header>

        {done && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            הרישום נשמר.
          </p>
        )}
        {failed && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {ERRORS[failed] ?? "לא הצלחנו לשמור."}
          </p>
        )}

        <section className="space-y-3 rounded-lg border border-black/15 p-4">
          <h2 className="text-lg font-semibold">רישום חדש</h2>
          <form action={logMeasurement} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">משקל (ק&quot;ג)</span>
              <input
                name="weightKg"
                inputMode="decimal"
                placeholder="72.5"
                className="w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">תמונה</span>
              <input
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="w-full text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">הערה</span>
              <textarea
                name="note"
                rows={2}
                className="w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white"
            >
              שמירה
            </button>
          </form>
        </section>

        {pair.before && pair.after && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">לפני ואחרי</h2>

            {!pair.comparable && (
              <p className="text-sm text-black/50">
                צריך שתי תמונות לפחות כדי להשוות.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[pair.before, pair.after].map((photo, i) => (
                <figure key={`${photo.id}-${i}`} className="space-y-1">
                  {/* Storage host is not known at build time, so next/image
                      optimisation cannot be configured for it here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={i === 0 ? "לפני" : "אחרי"}
                    className="w-full rounded-lg border border-black/10 object-cover"
                  />
                  <figcaption className="text-xs text-black/50">
                    {i === 0 ? "לפני" : "אחרי"} · {formatDate(photo.loggedAt)}
                    {photo.weightKg !== null && ` · ${photo.weightKg} ק"ג`}
                  </figcaption>
                </figure>
              ))}
            </div>

            {photos.length > 2 && (
              <form className="flex flex-wrap gap-2">
                <select
                  name="before"
                  defaultValue={pair.before.id}
                  className="rounded-lg border border-black/15 px-2 py-1 text-sm"
                >
                  {photos.map((photo) => (
                    <option key={photo.id} value={photo.id}>
                      {formatDate(photo.loggedAt)}
                    </option>
                  ))}
                </select>
                <select
                  name="after"
                  defaultValue={pair.after.id}
                  className="rounded-lg border border-black/15 px-2 py-1 text-sm"
                >
                  {photos.map((photo) => (
                    <option key={photo.id} value={photo.id}>
                      {formatDate(photo.loggedAt)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg border border-black/20 px-3 py-1 text-sm"
                >
                  השוואה
                </button>
              </form>
            )}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">רישומי משקל</h2>
          {weights.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-black/50">
              עוד לא נרשמו מדידות.
            </p>
          ) : (
            <ul className="space-y-1">
              {weights.map((entry) => (
                <li
                  key={entry.id}
                  className="flex justify-between rounded-lg border border-black/15 px-3 py-2 text-sm"
                >
                  <span>{formatDate(entry.loggedAt)}</span>
                  <span className="font-medium">{entry.weightKg} ק&quot;ג</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
