import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated, requireActiveTrainee } from "@/lib/auth/require";
import {
  getTraineeProfile,
  upsertTraineeProfile,
  TraineeProfilePatch,
} from "@/lib/services/trainee-profile-repo";

export async function GET(request: NextRequest) {
  // Pending trainees can also read their own profile (to confirm what they
  // submitted in the intro). requireAuthenticated covers all statuses.
  const r = await requireAuthenticated(request);
  if ("error" in r) return r.error;
  if (r.profile.role !== "trainee") {
    return NextResponse.json({ error: "FORBIDDEN_ROLE" }, { status: 403 });
  }
  const profile = await getTraineeProfile(r.profile.userId);
  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const body = (await request.json()) as TraineeProfilePatch;

  // Lightweight validation. Phone, if provided, must be E.164.
  if (body.phone !== undefined && !/^\+\d{8,15}$/.test(body.phone)) {
    return NextResponse.json({ error: "PHONE_INVALID" }, { status: 400 });
  }
  if (body.heightCm !== undefined && body.heightCm !== null && (body.heightCm < 50 || body.heightCm > 250)) {
    return NextResponse.json({ error: "HEIGHT_OUT_OF_RANGE" }, { status: 400 });
  }
  if (body.weightKg !== undefined && body.weightKg !== null && (body.weightKg < 20 || body.weightKg > 400)) {
    return NextResponse.json({ error: "WEIGHT_OUT_OF_RANGE" }, { status: 400 });
  }

  try {
    const profile = await upsertTraineeProfile(r.trainee.userId, body);
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json(
      { error: "DB_ERROR", message: (e as Error).message },
      { status: 500 }
    );
  }
}
