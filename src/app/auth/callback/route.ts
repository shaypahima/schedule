import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWebSession, resolveDestination } from "@/lib/auth/session";

/**
 * Where Google returns the visitor. Exchanges the one-time code for a session
 * cookie, then hands off to the same role/status routing every other entry
 * point uses.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=exchange_failed`);
  }

  const session = await getWebSession();
  return NextResponse.redirect(`${origin}${resolveDestination(session)}`);
}
