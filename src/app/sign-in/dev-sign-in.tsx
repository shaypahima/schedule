import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { devSignIn } from "./dev-actions";

/**
 * Local-only shortcut so the app is usable on the native-Postgres path, where
 * there is no GoTrue behind the Google button. Renders nothing anywhere else.
 */
export function DevSignIn() {
  if (!isDevAuthEnabled()) return null;

  return (
    <form action={devSignIn} className="space-y-2 border-t border-black/10 pt-6">
      <p className="text-xs text-black/50">התחברות מקומית (dev בלבד)</p>
      <input
        name="email"
        type="email"
        required
        placeholder="email"
        className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
      />
      <input
        name="password"
        type="password"
        required
        placeholder="DEV_PASSWORD"
        className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="w-full rounded-lg bg-black/80 px-4 py-2 text-sm text-white"
      >
        כניסה מקומית
      </button>
    </form>
  );
}
