import { NextRequest, NextResponse } from "next/server";

type GuardSuccess<T> = { session: T; error: null };
type GuardFailure = { session: null; error: NextResponse };
export type GuardResult<T> = GuardSuccess<T> | GuardFailure;

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
