import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { isPgDriver, pgQuery } from "@/lib/pg/client";

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

function statusOf(row: { status?: unknown; is_active?: unknown }): Profile["status"] {
  return (
    (row.status as Profile["status"] | null) ??
    ((row.is_active as boolean) ? "active" : "deactivated")
  );
}

async function loadProfilePg(userId: string): Promise<Profile | null> {
  const rows = await pgQuery<Record<string, unknown>>(
    "select id, email, name, role, status, is_active, created_at from profiles where id = $1",
    [userId],
  );
  if (rows.length === 0) return null;
  const data = rows[0];
  const tp = await pgQuery<{ phone: string | null; intro_text: string | null }>(
    "select phone, intro_text from trainee_profile where id = $1",
    [userId],
  );
  return {
    userId: data.id as string,
    email: data.email as string,
    phone: tp[0]?.phone ?? null,
    name: data.name as string,
    role: data.role as Profile["role"],
    status: statusOf(data),
    hasIntro: !!(tp[0]?.intro_text && tp[0].intro_text.trim().length > 0),
    createdAt: new Date(data.created_at as string).toISOString(),
  };
}

async function createProfilePg(row: {
  userId: string;
  email: string;
  name: string;
  role: "coach" | "trainee";
}): Promise<Profile> {
  // Ensure the auth.users stub row exists (profiles.id FKs to it).
  await pgQuery(
    "insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing",
    [row.userId, row.email],
  );
  const rows = await pgQuery<Record<string, unknown>>(
    `insert into profiles (id, email, name, role, is_active)
       values ($1, $2, $3, $4, true)
       returning id, email, name, role, status, is_active, created_at`,
    [row.userId, row.email, row.name, row.role],
  );
  const data = rows[0];
  return {
    userId: data.id as string,
    email: data.email as string,
    phone: null,
    name: data.name as string,
    role: data.role as Profile["role"],
    status: statusOf(data),
    hasIntro: false,
    createdAt: new Date(data.created_at as string).toISOString(),
  };
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  if (isPgDriver()) return loadProfilePg(userId);
  const db = admin();
  const { data, error } = await db
    .from("profiles")
    .select("id, email, name, role, status, is_active, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const status: Profile["status"] =
    (data.status as Profile["status"] | null) ??
    ((data.is_active as boolean) ? "active" : "deactivated");

  // Read optional trainee_profile row for phone + hasIntro. Coach rows have none.
  const { data: tp } = await db
    .from("trainee_profile")
    .select("phone, intro_text")
    .eq("id", userId)
    .maybeSingle();

  return {
    userId: data.id as string,
    email: data.email as string,
    phone: (tp?.phone as string | undefined) ?? null,
    name: data.name as string,
    role: data.role as Profile["role"],
    status,
    hasIntro: !!(tp?.intro_text && (tp.intro_text as string).trim().length > 0),
    createdAt: data.created_at as string,
  };
}

export async function createProfile(row: {
  userId: string;
  email: string;
  name: string;
  role: "coach" | "trainee";
}): Promise<Profile> {
  if (isPgDriver()) return createProfilePg(row);
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
