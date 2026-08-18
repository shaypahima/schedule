import Link from "next/link";
import { requireCoachSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";
import { decideRequest } from "../actions";

const NOTICES: Record<string, string> = {
  approve: "הבקשה אושרה.",
  reject: "הבקשה נדחתה.",
};

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("he-IL")} · ${d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; failed?: string }>;
}) {
  await requireCoachSession();
  const { done, failed } = await searchParams;

  const { coachRead } = getContainer();
  const requests = await coachRead.getPendingChangeRequests();

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">בקשות שינוי</h1>
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

        {requests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-black/50">
            אין בקשות ממתינות.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((request) => (
              <li
                key={request.id}
                className="space-y-3 rounded-lg border border-black/15 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {request.trainee.name}
                    <span className="mx-2 text-black/30">·</span>
                    <span className="text-sm font-normal text-black/60">
                      {request.toSlot ? "בקשת העברה" : "בקשת ביטול"}
                    </span>
                  </p>
                  <p className="text-sm text-black/60">
                    {when(request.fromSlot.startsAt)}
                    {request.toSlot && ` → ${when(request.toSlot.startsAt)}`}
                  </p>
                </div>

                <p className="whitespace-pre-wrap rounded-lg bg-black/5 p-3 text-sm">
                  {request.reason}
                </p>

                <div className="flex flex-wrap gap-2">
                  <form action={decideRequest} className="flex flex-1 gap-2">
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <input
                      name="note"
                      placeholder="הערה (רשות)"
                      className="flex-1 rounded-lg border border-black/15 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
                    >
                      אישור
                    </button>
                  </form>
                  <form action={decideRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="reject" />
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
