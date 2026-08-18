import { redirect } from "next/navigation";
import { getWebSession, resolveDestination } from "@/lib/auth/session";
import { submitIntro } from "./actions";

const ERRORS: Record<string, string> = {
  PHONE_INVALID: "מספר טלפון לא תקין. פורמט לדוגמה: ‎+972501234567",
  INTRO_TOO_SHORT: "כתבו קצת יותר — לפחות 10 תווים.",
};

export default async function IntroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getWebSession();
  if (resolveDestination(session) !== "/intro") {
    redirect(resolveDestination(session));
  }

  const { error } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">כמה מילים עליך</h1>
          <p className="text-sm text-black/60">
            כדי שהמאמן יוכל לאשר אותך, נשאר רק למלא טלפון ולספר קצת.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {ERRORS[error] ?? "אירעה שגיאה. נסו שוב."}
          </p>
        )}

        <form action={submitIntro} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">טלפון</span>
            <input
              name="phone"
              type="tel"
              required
              dir="ltr"
              placeholder="+972501234567"
              className="w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">למה בא לך להתאמן?</span>
            <textarea
              name="introText"
              required
              rows={4}
              minLength={10}
              className="w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white"
          >
            שליחה
          </button>
        </form>
      </div>
    </main>
  );
}
