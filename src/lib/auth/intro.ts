import { isPgDriver, pgQuery } from "@/lib/pg/client";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

const E164 = /^\+\d{8,15}$/;
const MIN_INTRO_LENGTH = 10;

export type IntroInput = { phone?: string | null; introText?: string | null };
export type IntroValue = { phone: string; introText: string };
export type IntroError = "PHONE_INVALID" | "INTRO_TOO_SHORT";

/**
 * The intro is the minimum a self-signup owes the coach before review: a phone
 * to reach them on, and enough words to judge whether to take them on.
 */
export function validateIntro(
  input: IntroInput,
): { ok: true; value: IntroValue } | { ok: false; error: IntroError } {
  const phone = typeof input.phone === "string" ? input.phone : "";
  if (!E164.test(phone)) return { ok: false, error: "PHONE_INVALID" };

  const introText = (input.introText ?? "").trim();
  if (introText.length < MIN_INTRO_LENGTH) {
    return { ok: false, error: "INTRO_TOO_SHORT" };
  }

  return { ok: true, value: { phone, introText } };
}

export async function saveIntro(
  userId: string,
  value: IntroValue,
): Promise<void> {
  if (isPgDriver()) {
    await pgQuery(
      `insert into trainee_profile (id, phone, intro_text, updated_at)
         values ($1, $2, $3, now())
         on conflict (id) do update set
           phone = excluded.phone, intro_text = excluded.intro_text, updated_at = now()`,
      [userId, value.phone, value.introText],
    );
    return;
  }

  const { error } = await getSupabaseAdminClient().from("trainee_profile").upsert({
    id: userId,
    phone: value.phone,
    intro_text: value.introText,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`saveIntro failed: ${error.message}`);
}
