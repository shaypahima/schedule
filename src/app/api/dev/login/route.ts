import { NextRequest, NextResponse } from "next/server";
import { isPgDriver, pgQuery } from "@/lib/pg/client";
import { signDevToken } from "@/lib/pg/dev-auth";

/**
 * Dev-only login for the native-Postgres path (no GoTrue). Exchanges
 * email + DEV_PASSWORD for an HS256 token the rest of the app accepts as a
 * Bearer credential. Disabled (404) unless `DB_DRIVER=pg`.
 */
export async function POST(req: NextRequest) {
  if (!isPgDriver()) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "MISSING_CREDENTIALS" }, { status: 400 });
  }
  if (password !== process.env.DEV_PASSWORD) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const rows = await pgQuery<{ id: string; email: string; role: string }>(
    "select id, email, role from profiles where email = $1 limit 1",
    [email],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const user = rows[0];
  const token = signDevToken({ sub: user.id, email: user.email, role: user.role });
  return NextResponse.json({ token, user });
}
