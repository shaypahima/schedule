import { createClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string;
  name: string;
  role: "coach" | "trainee";
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function findProfile(id: string): Promise<Profile | null> {
  const { data, error } = await admin()
    .from("profiles")
    .select("id, email, name, role")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

export async function createProfile(row: {
  id: string;
  email: string;
  name: string;
  role: "coach" | "trainee";
}): Promise<Profile> {
  const { data, error } = await admin()
    .from("profiles")
    .insert({ ...row, is_active: true })
    .select("id, email, name, role")
    .single();
  if (error || !data) throw new Error(`createProfile failed: ${error?.message}`);
  return data as Profile;
}
