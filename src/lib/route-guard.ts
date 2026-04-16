import { NextRequest, NextResponse } from "next/server";
import { getSession } from "./services/session";

export type Session = {
  id: string;
  name: string;
  role: string;
  phone: string;
};

type GuardSuccess<T> = { session: T; error: null };
type GuardFailure = { session: null; error: NextResponse };
export type GuardResult<T> = GuardSuccess<T> | GuardFailure;

export async function requireAuth(): Promise<GuardResult<Session>> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

export async function requireAdmin(): Promise<GuardResult<Session>> {
  const result = await requireAuth();
  if (result.error) return result;
  if (result.session.role !== "admin") {
    return {
      session: null,
      error: NextResponse.json({ error: "Admin only" }, { status: 403 }),
    };
  }
  return result;
}

export function requireCron(req: NextRequest): GuardResult<null> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      ),
    };
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session: null, error: null };
}
