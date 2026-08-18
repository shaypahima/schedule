"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createServerSupabase, hasSupabaseEnv } from "@/lib/supabase/server";
import { DEV_SESSION_COOKIE } from "@/lib/auth/dev-session";

export async function signInWithGoogle() {
  if (!hasSupabaseEnv()) redirect("/sign-in?error=oauth_failed");

  const supabase = await createServerSupabase();
  const origin = (await headers()).get("origin") ?? "";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) redirect("/sign-in?error=oauth_failed");
  redirect(data.url);
}

export async function signOut() {
  // Clear both credentials: whichever one signed this visitor in, signing out
  // must leave neither behind.
  (await cookies()).delete(DEV_SESSION_COOKIE);

  if (hasSupabaseEnv()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }

  redirect("/sign-in");
}
