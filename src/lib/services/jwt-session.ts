import { NextRequest } from "next/server";
import { isPgDriver } from "@/lib/pg/client";
import { verifyDevToken } from "@/lib/pg/dev-auth";
import { getSupabaseClient } from "@/lib/supabase/client";

export type JwtSession = { userId: string; email: string };

export async function getJwtSession(req: NextRequest): Promise<JwtSession | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const jwt = authHeader.slice(7);

  // Local dev on native Postgres: verify our own HS256 token (no GoTrue).
  if (isPgDriver()) return verifyDevToken(jwt);

  const { data, error } = await getSupabaseClient().auth.getUser(jwt);
  if (error || !data.user.email) return null;
  return { userId: data.user.id, email: data.user.email };
}
