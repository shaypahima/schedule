import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { isPgDriver, pgQuery } from "@/lib/pg/client";

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
 * Create an *active* trainee (the invitation IS the approval — ADR-0004).
 *
 * Cloud: Supabase Admin API sends an invite email (creates auth.users) then
 * upserts an active profile. Local pg dev: no GoTrue/email — create an
 * auth.users stub row and the active profile directly so the coach's
 * "add trainee" flow works offline.
 */
export async function inviteTraineeByEmail(input: InviteInput): Promise<InvitedProfile> {
  if (isPgDriver()) {
    const existing = await pgQuery<{ id: string }>(
      "select id from auth.users where email = $1",
      [input.email],
    );
    const userId = existing[0]?.id ?? randomUUID();
    if (!existing[0]) {
      await pgQuery("insert into auth.users (id, email) values ($1, $2)", [userId, input.email]);
    }
    const rows = await pgQuery<InvitedProfile>(
      `insert into profiles (id, email, name, role, status, is_active, is_recurring, preferred_day, preferred_time)
         values ($1, $2, $3, 'trainee', 'active', true, $4, $5, $6)
         on conflict (id) do update set
           email = excluded.email, name = excluded.name, status = 'active', is_active = true,
           is_recurring = excluded.is_recurring, preferred_day = excluded.preferred_day,
           preferred_time = excluded.preferred_time
         returning id, email, name, status`,
      [
        userId,
        input.email,
        input.name,
        input.isRecurring ?? false,
        input.preferredDay ?? null,
        input.preferredTime ?? null,
      ],
    );
    return rows[0];
  }

  const db = admin();

  // 1. Invite via Supabase Auth — creates auth.users row + sends magic-link
  const { data: invited, error: inviteErr } = await db.auth.admin.inviteUserByEmail(input.email);
  if (inviteErr || !invited.user) {
    throw new Error(`Invite failed: ${inviteErr?.message ?? "unknown"}`);
  }

  // 2. Upsert active profile keyed to the new auth.users.id
  const { data: profile, error: upsertErr } = await db
    .from("profiles")
    .upsert(
      {
        id: invited.user.id,
        email: input.email,
        name: input.name,
        role: "trainee",
        status: "active",
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
  if (isPgDriver()) return; // no email service locally — no-op
  const { error } = await admin().auth.admin.inviteUserByEmail(email);
  if (error) throw new Error(`Resend failed: ${error.message}`);
}
