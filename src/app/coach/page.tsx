import { requireCoachSession } from "@/lib/auth/session";
import { signOut } from "../auth/actions";

export default async function CoachHomePage() {
  const session = await requireCoachSession();

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">שלום, {session.name}</h1>
          <form action={signOut}>
            <button type="submit" className="text-sm text-black/50 underline">
              התנתקות
            </button>
          </form>
        </header>

        {/* Roster, approvals and the request inbox arrive with #103, #104, #105. */}
        <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-black/50">
          לוח המאמן יופיע כאן.
        </p>
      </div>
    </main>
  );
}
