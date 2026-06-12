import type {
  CoachInfoRepo,
  CoachInfo,
  CoachInfoPatch,
} from "@/lib/services/coach-info-repo";
import { getSupabaseAdminClient } from "./client";

/** Supabase-backed CoachInfoRepo. */
export class SupabaseCoachInfoRepo implements CoachInfoRepo {
  async get(): Promise<CoachInfo | null> {
    const db = getSupabaseAdminClient();
    const { data: coach } = await db
      .from("profiles")
      .select("id, name")
      .eq("role", "coach")
      .limit(1)
      .maybeSingle();
    if (!coach) return null;

    const { data: settings } = await db
      .from("coach_settings")
      .select("contact_phone, bio, specialty, years_experience")
      .limit(1)
      .maybeSingle();

    return {
      name: coach.name as string,
      contactPhone: (settings?.contact_phone as string | null) ?? null,
      bio: (settings?.bio as string | null) ?? null,
      specialty: (settings?.specialty as string | null) ?? null,
      yearsExperience: (settings?.years_experience as number | null) ?? null,
    };
  }

  async updateContactPhone(coachId: string, phone: string): Promise<void> {
    // coach_settings is a single-row table; upsert by id (matching profile id)
    const { error } = await getSupabaseAdminClient()
      .from("coach_settings")
      .upsert({ id: coachId, contact_phone: phone }, { onConflict: "id" });
    if (error) throw new Error(`updateCoachContactPhone failed: ${error.message}`);
  }

  async update(coachId: string, patch: CoachInfoPatch): Promise<void> {
    const dbPatch: Record<string, unknown> = { id: coachId };
    if (patch.contactPhone !== undefined) dbPatch.contact_phone = patch.contactPhone;
    if (patch.bio !== undefined) dbPatch.bio = patch.bio;
    if (patch.specialty !== undefined) dbPatch.specialty = patch.specialty;
    if (patch.yearsExperience !== undefined) dbPatch.years_experience = patch.yearsExperience;

    const { error } = await getSupabaseAdminClient()
      .from("coach_settings")
      .upsert(dbPatch, { onConflict: "id" });
    if (error) throw new Error(`updateCoachInfo failed: ${error.message}`);
  }
}
