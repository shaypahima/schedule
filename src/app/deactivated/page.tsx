import { redirect } from "next/navigation";
import { getWebSession, resolveDestination } from "@/lib/auth/session";
import { signOut } from "../auth/actions";

export default async function DeactivatedPage() {
  const session = await getWebSession();
  if (resolveDestination(session) !== "/deactivated") {
    redirect(resolveDestination(session));
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-bold">החשבון אינו פעיל</h1>
        <p className="text-black/60">
          החשבון שלך הוסר מרשימת המתאמנים הפעילים, ולא ניתן לקבוע אימונים חדשים.
          היסטוריית האימונים שלך נשמרה.
        </p>
        <form action={signOut}>
          <button type="submit" className="text-sm text-black/50 underline">
            התנתקות
          </button>
        </form>
      </div>
    </main>
  );
}
