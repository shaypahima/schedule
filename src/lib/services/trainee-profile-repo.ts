import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { isPgDriver, pgQuery } from "@/lib/pg/client";

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

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function map(row: Record<string, unknown> | null): TraineeProfileFields {
  if (!row) {
    return {
      phone: null,
      introText: null,
      photoUrl: null,
      dateOfBirth: null,
      heightCm: null,
      weightKg: null,
      goals: null,
      medical: null,
    };
  }
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

export async function getTraineeProfile(userId: string): Promise<TraineeProfileFields> {
  if (isPgDriver()) {
    const rows = await pgQuery<Record<string, unknown>>(
      "select * from trainee_profile where id = $1",
      [userId],
    );
    return map(rows[0] ?? null);
  }
  const { data } = await admin()
    .from("trainee_profile")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return map(data);
}

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

export async function upsertTraineeProfile(
  userId: string,
  patch: TraineeProfilePatch
): Promise<TraineeProfileFields> {
  if (isPgDriver()) {
    const cols: string[] = ["id"];
    const vals: unknown[] = [userId];
    const ph: string[] = ["$1"];
    const add = (col: string, v: unknown) => {
      cols.push(col);
      vals.push(v);
      ph.push(`$${vals.length}`);
    };
    if (patch.phone !== undefined) add("phone", patch.phone);
    if (patch.introText !== undefined) add("intro_text", patch.introText);
    if (patch.photoUrl !== undefined) add("photo_url", patch.photoUrl);
    if (patch.dateOfBirth !== undefined) add("date_of_birth", patch.dateOfBirth);
    if (patch.heightCm !== undefined) add("height_cm", patch.heightCm);
    if (patch.weightKg !== undefined) add("weight_kg", patch.weightKg);
    if (patch.goals !== undefined) add("goals", patch.goals);
    if (patch.medical !== undefined) add("medical", patch.medical);
    const updates = cols
      .slice(1)
      .map((c) => `${c} = excluded.${c}`)
      .concat("updated_at = now()")
      .join(", ");
    const rows = await pgQuery<Record<string, unknown>>(
      `insert into trainee_profile (${cols.join(", ")}) values (${ph.join(", ")})
         on conflict (id) do update set ${updates}
         returning *`,
      vals,
    );
    return map(rows[0]);
  }
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

  const { data, error } = await admin()
    .from("trainee_profile")
    .upsert(dbPatch)
    .select("*")
    .single();
  if (error || !data) throw new Error(`upsertTraineeProfile failed: ${error?.message}`);
  return map(data);
}
