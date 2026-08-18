import { redirect } from "next/navigation";
import { getWebSession, resolveDestination } from "@/lib/auth/session";
import { signInWithGoogle } from "../auth/actions";
import { DevSignIn } from "./dev-sign-in";

const ERRORS: Record<string, string> = {
  missing_code: "ההתחברות לא הושלמה. נסו שוב.",
  exchange_failed: "ההתחברות נכשלה. נסו שוב.",
  oauth_failed: "לא הצלחנו להתחיל התחברות מול Google.",
  dev_credentials: "סיסמת dev שגויה.",
  dev_no_user: "לא נמצא משתמש עם המייל הזה.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already signed in? Nothing to do here.
  const session = await getWebSession();
  if (session) redirect(resolveDestination(session));

  const { error } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Velofit</h1>
          <p className="text-black/60">קביעת אימונים אישיים</p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {ERRORS[error] ?? "אירעה שגיאה. נסו שוב."}
          </p>
        )}

        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="w-full rounded-lg border border-black/15 px-4 py-3 font-medium hover:bg-black/5"
          >
            התחברות עם Google
          </button>
        </form>

        <DevSignIn />
      </div>
    </main>
  );
}
