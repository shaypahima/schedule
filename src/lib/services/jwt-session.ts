import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export type JwtSession = { userId: string; email: string };

export async function getJwtSession(req: NextRequest): Promise<JwtSession | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const jwt = authHeader.slice(7);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user.email) return null;
  return { userId: data.user.id, email: data.user.email };
}
