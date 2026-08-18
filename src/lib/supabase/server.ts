import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Whether this deployment talks to Supabase at all. The local Postgres path
 * runs with no Supabase credentials, and must degrade to "nobody is signed in"
 * rather than blowing up.
 */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Supabase client bound to the request's cookies. Auth state lives in cookies
 * rather than a bearer token, so Server Components and Server Actions can read
 * the signed-in user without threading a header through every call.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required",
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Session refresh still lands
          // via middleware, so this is safe to swallow.
        }
      },
    },
  });
}
