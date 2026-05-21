import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  userId: string;
  email: string;
  phone: string | null;
  name: string;
  role: "coach" | "trainee";
  status: "pending" | "active" | "rejected" | "deactivated";
  hasIntro: boolean;
  createdAt: string;
};

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await admin()
    .from("profiles")
    .select("id, email, name, role, status, is_active, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const status: Profile["status"] =
    (data.status as Profile["status"] | null) ??
    ((data.is_active as boolean) ? "active" : "deactivated");

  return {
    userId: data.id as string,
    email: data.email as string,
    phone: null, // Phase 14 wires trainee_profile.phone here
    name: data.name as string,
    role: data.role as Profile["role"],
    status,
    hasIntro: false, // Phase 14 wires trainee_profile.intro_text presence here
    createdAt: data.created_at as string,
  };
}

export async function createProfile(row: {
  userId: string;
  email: string;
  name: string;
  role: "coach" | "trainee";
}): Promise<Profile> {
  const { data, error } = await admin()
    .from("profiles")
    .insert({
      id: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
      is_active: true,
    })
    .select("id, email, name, role, status, is_active, created_at")
    .single();
  if (error || !data) throw new Error(`createProfile failed: ${error?.message}`);
  return {
    userId: data.id as string,
    email: data.email as string,
    phone: null,
    name: data.name as string,
    role: data.role as Profile["role"],
    status:
      (data.status as Profile["status"] | null) ??
      ((data.is_active as boolean) ? "active" : "deactivated"),
    hasIntro: false,
    createdAt: data.created_at as string,
  };
}
