import { createClient } from "@supabase/supabase-js";

export type CoachInfo = {
  name: string;
  contactPhone: string | null;
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
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (!coach) return null;

  const { data: settings } = await db
    .from("coach_settings")
    .select("contact_phone")
    .limit(1)
    .maybeSingle();

  return {
    name: coach.name as string,
    contactPhone: (settings?.contact_phone as string | null) ?? null,
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
