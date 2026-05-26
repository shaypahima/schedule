import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireActiveTrainee } from "@/lib/auth/require";

const DEFAULT_DAYS = 90;
const DEFAULT_LIMIT = 50;

/** Trainee's own progress: measurements (last 90 days by default) + session logs. */
export async function GET(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const url = new URL(request.url);
  const sinceDays = clampInt(url.searchParams.get("days"), DEFAULT_DAYS, 1, 365);
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, 200);

  const { progress } = getContainer();
  const measurements = await progress.listMeasurements(r.trainee.userId, {
    limit,
    sinceDays,
  });
  const sessionLogs = await progress.listSessionLogsForTrainee(r.trainee.userId, {
    limit,
  });

  return NextResponse.json({
    measurements,
    sessionLogs,
    lastMeasurement: measurements[0] ?? null,
  });
}

function clampInt(raw: string | null, def: number, min: number, max: number) {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}
