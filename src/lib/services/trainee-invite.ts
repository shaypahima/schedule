import { createClient } from "@supabase/supabase-js";

export type InviteInput = {
  email: string;
  name: string;
  isRecurring?: boolean;
  preferredDay?: number | null; // 0=Sun..5=Fri
  preferredTime?: string | null; // HH:mm
};

export type InvitedProfile = {
  id: string;
  email: string;
  name: string;
  status: "pending" | "active" | "deactivated";
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Create a pending trainee:
 * 1. Supabase Admin API sends an invite email (creates auth.users row).
 * 2. Insert/upsert profiles row with status='pending'.
 * 3. On first /api/me call, server promotes status to 'active'.
 */
export async function inviteTraineeByEmail(input: InviteInput): Promise<InvitedProfile> {
  const db = admin();

  // 1. Invite via Supabase Auth — creates auth.users row + sends magic-link
  const { data: invited, error: inviteErr } = await db.auth.admin.inviteUserByEmail(input.email);
  if (inviteErr || !invited.user) {
    throw new Error(`Invite failed: ${inviteErr?.message ?? "unknown"}`);
  }

  // 2. Upsert pending profile keyed to the new auth.users.id
  const { data: profile, error: upsertErr } = await db
    .from("profiles")
    .upsert(
      {
        id: invited.user.id,
        email: input.email,
        name: input.name,
        role: "trainee",
        status: "pending",
        is_active: true,
        is_recurring: input.isRecurring ?? false,
        preferred_day: input.preferredDay ?? null,
        preferred_time: input.preferredTime ?? null,
      },
      { onConflict: "id" }
    )
    .select("id, email, name, status")
    .single();
  if (upsertErr || !profile) {
    throw new Error(`Profile upsert failed: ${upsertErr?.message ?? "unknown"}`);
  }

  return profile as InvitedProfile;
}

/** Re-trigger Supabase invite email for a trainee already in 'pending' state. */
export async function resendInvite(email: string): Promise<void> {
  const { error } = await admin().auth.admin.inviteUserByEmail(email);
  if (error) throw new Error(`Resend failed: ${error.message}`);
}
