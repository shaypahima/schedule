import { createClient } from "@supabase/supabase-js";

export type CoachInfo = {
  name: string;
  contactPhone: string | null;
  bio: string | null;
  specialty: string | null;
  yearsExperience: number | null;
};

export type CoachInfoPatch = {
  contactPhone?: string;
  bio?: string | null;
  specialty?: string | null;
  yearsExperience?: number | null;
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function getCoachInfo(): Promise<CoachInfo | null> {
  const db = admin();
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

export async function updateCoachContactPhone(coachId: string, phone: string): Promise<void> {
  const db = admin();
  // coach_settings is a single-row table; upsert by id (matching profile id)
  const { error } = await db
    .from("coach_settings")
    .upsert({ id: coachId, contact_phone: phone }, { onConflict: "id" });
  if (error) throw new Error(`updateCoachContactPhone failed: ${error.message}`);
}

export async function updateCoachInfo(coachId: string, patch: CoachInfoPatch): Promise<void> {
  const db = admin();
  const dbPatch: Record<string, unknown> = { id: coachId };
  if (patch.contactPhone !== undefined) dbPatch.contact_phone = patch.contactPhone;
  if (patch.bio !== undefined) dbPatch.bio = patch.bio;
  if (patch.specialty !== undefined) dbPatch.specialty = patch.specialty;
  if (patch.yearsExperience !== undefined) dbPatch.years_experience = patch.yearsExperience;

  const { error } = await db
    .from("coach_settings")
    .upsert(dbPatch, { onConflict: "id" });
  if (error) throw new Error(`updateCoachInfo failed: ${error.message}`);
}
