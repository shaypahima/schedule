import { redirect } from "next/navigation";
import { getWebSession, resolveDestination } from "@/lib/auth/session";
import { signOut } from "../auth/actions";

export default async function PendingPage() {
  const session = await getWebSession();
  if (resolveDestination(session) !== "/pending") {
    redirect(resolveDestination(session));
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-bold">הבקשה נשלחה</h1>
        <p className="text-black/60">
          המאמן יבדוק את הפרטים שלך ויאשר בהקדם. נעדכן אותך כשתוכל להתחיל לקבוע
          אימונים.
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
