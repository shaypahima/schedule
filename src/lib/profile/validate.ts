import type { TraineeProfilePatch } from "@/lib/services/trainee-profile-repo";

const E164 = /^\+\d{8,15}$/;
const HEIGHT_CM = { min: 50, max: 250 };
const WEIGHT_KG = { min: 20, max: 400 };

export type ProfileError =
  | "PHONE_INVALID"
  | "HEIGHT_OUT_OF_RANGE"
  | "WEIGHT_OUT_OF_RANGE";

function outOfRange(
  value: number | null | undefined,
  bounds: { min: number; max: number },
): boolean {
  // undefined = untouched, null = deliberately cleared. Neither is a bad value.
  if (value === undefined || value === null) return false;
  return value < bounds.min || value > bounds.max;
}

/**
 * Guards the optional half of a trainee's profile. Nothing here is required —
 * the check is only that what someone did fill in could be true.
 */
export function validateProfilePatch(
  patch: TraineeProfilePatch,
): { ok: true; value: TraineeProfilePatch } | { ok: false; error: ProfileError } {
  if (patch.phone !== undefined && !E164.test(patch.phone)) {
    return { ok: false, error: "PHONE_INVALID" };
  }
  if (outOfRange(patch.heightCm, HEIGHT_CM)) {
    return { ok: false, error: "HEIGHT_OUT_OF_RANGE" };
  }
  if (outOfRange(patch.weightKg, WEIGHT_KG)) {
    return { ok: false, error: "WEIGHT_OUT_OF_RANGE" };
  }
  return { ok: true, value: patch };
}
