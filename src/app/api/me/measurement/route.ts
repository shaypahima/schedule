import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireActiveTrainee } from "@/lib/auth/require";
import { MeasurementValidationError } from "@/lib/services/progress-store";

interface Body {
  weightKg?: number | null;
  metrics?: Record<string, unknown> | null;
  photoUrl?: string | null;
  note?: string | null;
  loggedAt?: string;
}

export async function POST(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const body = (await request.json()) as Body;
  const { progress } = getContainer();

  try {
    const row = await progress.createMeasurement(r.trainee.userId, {
      weightKg: body.weightKg ?? null,
      metrics: body.metrics ?? null,
      photoUrl: body.photoUrl ?? null,
      note: body.note ?? null,
      loggedAt: body.loggedAt ? new Date(body.loggedAt) : undefined,
    });
    return NextResponse.json({ measurement: row });
  } catch (e) {
    if (e instanceof MeasurementValidationError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: 400 }
      );
    }
    throw e;
  }
}
