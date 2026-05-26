import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireCoach } from "@/lib/auth/require";

const DEFAULT_DAYS = 90;
const DEFAULT_LIMIT = 100;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { id } = await params;
  const url = new URL(request.url);
  const sinceDays = clampInt(url.searchParams.get("days"), DEFAULT_DAYS, 1, 365);
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, 500);

  const { progress } = getContainer();
  const measurements = await progress.listMeasurements(id, { limit, sinceDays });
  const sessionLogs = await progress.listSessionLogsForTrainee(id, { limit });

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
