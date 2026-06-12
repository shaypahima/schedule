import { isPgDriver } from "@/lib/pg/client";
import { PgTraineeProfileRepo } from "@/lib/pg/trainee-profile-repo";
import { SupabaseTraineeProfileRepo } from "@/lib/supabase/trainee-profile-repo";

export type TraineeProfileFields = {
  phone: string | null;
  introText: string | null;
  photoUrl: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  heightCm: number | null;
  weightKg: number | null;
  goals: string | null;
  medical: string | null;
};

export type TraineeProfilePatch = Partial<{
  phone: string;
  introText: string;
  photoUrl: string | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  goals: string | null;
  medical: string | null;
}>;

/** TraineeProfileRepo — trainee_profile persistence (1:1 with profiles). */
export interface TraineeProfileRepo {
  get(userId: string): Promise<TraineeProfileFields>;
  upsert(userId: string, patch: TraineeProfilePatch): Promise<TraineeProfileFields>;
}

export const EMPTY_TRAINEE_PROFILE: TraineeProfileFields = {
  phone: null,
  introText: null,
  photoUrl: null,
  dateOfBirth: null,
  heightCm: null,
  weightKg: null,
  goals: null,
  medical: null,
};

export function mapTraineeProfileRow(
  row: Record<string, unknown> | null
): TraineeProfileFields {
  if (!row) return { ...EMPTY_TRAINEE_PROFILE };
  return {
    phone: (row.phone as string) ?? null,
    introText: (row.intro_text as string) ?? null,
    photoUrl: (row.photo_url as string) ?? null,
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : null,
    heightCm: (row.height_cm as number) ?? null,
    weightKg: (row.weight_kg as number) ?? null,
    goals: (row.goals as string) ?? null,
    medical: (row.medical as string) ?? null,
  };
}

let repo: TraineeProfileRepo | undefined;

function getRepo(): TraineeProfileRepo {
  return (repo ??= isPgDriver()
    ? new PgTraineeProfileRepo()
    : new SupabaseTraineeProfileRepo());
}

/** Test seam: override the adapter (pass undefined to restore driver selection). */
export function setTraineeProfileRepo(override: TraineeProfileRepo | undefined): void {
  repo = override;
}

export async function getTraineeProfile(userId: string): Promise<TraineeProfileFields> {
  return getRepo().get(userId);
}

export async function upsertTraineeProfile(
  userId: string,
  patch: TraineeProfilePatch
): Promise<TraineeProfileFields> {
  return getRepo().upsert(userId, patch);
}
