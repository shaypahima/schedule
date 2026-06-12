import { NextRequest, NextResponse } from "next/server";
import { getJwtSession } from "@/lib/services/jwt-session";
import { loadProfile } from "./profile-repo";

export type { Profile } from "./profile-repo";
import type { Profile } from "./profile-repo";

type Err = { error: NextResponse };

function unauthenticated(): Err {
  return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
}

function profileNotFound(): Err {
  return { error: NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 401 }) };
}

function forbiddenRole(): Err {
  return { error: NextResponse.json({ error: "FORBIDDEN_ROLE" }, { status: 403 }) };
}

function forbiddenStatus(): Err {
  return { error: NextResponse.json({ error: "FORBIDDEN_STATUS" }, { status: 403 }) };
}

async function loadAuthedProfile(req: NextRequest): Promise<Profile | Err> {
  const session = await getJwtSession(req);
  if (!session) return unauthenticated();
  const profile = await loadProfile(session.userId);
  if (!profile) return profileNotFound();
  return profile;
}

function isErr(x: Profile | Err): x is Err {
  return (x as Err).error !== undefined;
}

export async function requireAuthenticated(
  req: NextRequest
): Promise<{ profile: Profile } | Err> {
  const r = await loadAuthedProfile(req);
  if (isErr(r)) return r;
  return { profile: r };
}

export async function requireCoach(
  req: NextRequest
): Promise<{ coach: Profile } | Err> {
  const r = await loadAuthedProfile(req);
  if (isErr(r)) return r;
  if (r.role !== "coach") return forbiddenRole();
  return { coach: r };
}

export async function requireActiveTrainee(
  req: NextRequest
): Promise<{ trainee: Profile } | Err> {
  const r = await loadAuthedProfile(req);
  if (isErr(r)) return r;
  if (r.role !== "trainee") return forbiddenRole();
  if (r.status !== "active") return forbiddenStatus();
  return { trainee: r };
}

/**
 * Accepts a coach OR an active trainee. Use for read-only endpoints that
 * expose shared coach-owned data (e.g., available slots) — the coach needs
 * to see what their trainees see, but pending/rejected trainees still can't.
 */
export async function requireCoachOrActiveTrainee(
  req: NextRequest
): Promise<{ profile: Profile } | Err> {
  const r = await loadAuthedProfile(req);
  if (isErr(r)) return r;
  if (r.role === "coach") return { profile: r };
  if (r.role === "trainee" && r.status === "active") return { profile: r };
  if (r.role === "trainee") return forbiddenStatus();
  return forbiddenRole();
}

export async function requirePendingTrainee(
  req: NextRequest
): Promise<{ trainee: Profile } | Err> {
  const r = await loadAuthedProfile(req);
  if (isErr(r)) return r;
  if (r.role !== "trainee") return forbiddenRole();
  if (r.status !== "pending") return forbiddenStatus();
  return { trainee: r };
}

type GuardSuccess<T> = { session: T; error: null };
type GuardFailure = { session: null; error: NextResponse };
export type GuardResult<T> = GuardSuccess<T> | GuardFailure;

/** Cron endpoints authenticate with a shared secret, not a user JWT. */
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
