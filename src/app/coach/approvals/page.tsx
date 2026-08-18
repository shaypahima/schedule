import Link from "next/link";
import { requireCoachSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";
import { approve, reject } from "../actions";

const NOTICES: Record<string, string> = {
  approved: "המתאמן/ת אושרו.",
  rejected: "הבקשה נדחתה.",
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; failed?: string }>;
}) {
  await requireCoachSession();
  const { done, failed } = await searchParams;

  const { coachRead } = getContainer();
  const pending = await coachRead.getPendingApprovals();

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">ממתינים לאישור</h1>
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
            לא הצלחנו לבצע את הפעולה ({failed}).
          </p>
        )}

        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-black/50">
            אין בקשות ממתינות.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((candidate) => (
              <li
                key={candidate.id}
                className="space-y-3 rounded-lg border border-black/15 p-4"
              >
                <div>
                  <p className="font-semibold">{candidate.name}</p>
                  <p className="text-sm text-black/50" dir="ltr">
                    {candidate.email}
                    {candidate.phone ? ` · ${candidate.phone}` : ""}
                  </p>
                </div>

                {candidate.introText && (
                  <p className="whitespace-pre-wrap rounded-lg bg-black/5 p-3 text-sm">
                    {candidate.introText}
                  </p>
                )}

                <div className="flex gap-2">
                  <form action={approve}>
                    <input type="hidden" name="traineeId" value={candidate.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
                    >
                      אישור
                    </button>
                  </form>
                  <form action={reject}>
                    <input type="hidden" name="traineeId" value={candidate.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-black/20 px-4 py-2 text-sm"
                    >
                      דחייה
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
