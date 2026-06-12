import type {
  TraineeProfileRepo,
  TraineeProfileFields,
  TraineeProfilePatch,
} from "@/lib/services/trainee-profile-repo";
import { mapTraineeProfileRow } from "@/lib/services/trainee-profile-repo";
import { getSupabaseAdminClient } from "./client";

/** Supabase-backed TraineeProfileRepo. */
export class SupabaseTraineeProfileRepo implements TraineeProfileRepo {
  async get(userId: string): Promise<TraineeProfileFields> {
    const { data } = await getSupabaseAdminClient()
      .from("trainee_profile")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return mapTraineeProfileRow(data);
  }

  async upsert(userId: string, patch: TraineeProfilePatch): Promise<TraineeProfileFields> {
    const dbPatch: Record<string, unknown> = {
      id: userId,
      updated_at: new Date().toISOString(),
    };
    if (patch.phone !== undefined) dbPatch.phone = patch.phone;
    if (patch.introText !== undefined) dbPatch.intro_text = patch.introText;
    if (patch.photoUrl !== undefined) dbPatch.photo_url = patch.photoUrl;
    if (patch.dateOfBirth !== undefined) dbPatch.date_of_birth = patch.dateOfBirth;
    if (patch.heightCm !== undefined) dbPatch.height_cm = patch.heightCm;
    if (patch.weightKg !== undefined) dbPatch.weight_kg = patch.weightKg;
    if (patch.goals !== undefined) dbPatch.goals = patch.goals;
    if (patch.medical !== undefined) dbPatch.medical = patch.medical;

    const { data, error } = await getSupabaseAdminClient()
      .from("trainee_profile")
      .upsert(dbPatch)
      .select("*")
      .single();
    if (error || !data) throw new Error(`upsertTraineeProfile failed: ${error?.message}`);
    return mapTraineeProfileRow(data);
  }
}
