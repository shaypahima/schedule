import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated, requireActiveTrainee } from "@/lib/auth/require";
import {
  getTraineeProfile,
  upsertTraineeProfile,
  TraineeProfilePatch,
} from "@/lib/services/trainee-profile-repo";
import { validateProfilePatch } from "@/lib/profile/validate";

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

  const parsed = validateProfilePatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const profile = await upsertTraineeProfile(r.trainee.userId, parsed.value);
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json(
      { error: "DB_ERROR", message: (e as Error).message },
      { status: 500 }
    );
  }
}
