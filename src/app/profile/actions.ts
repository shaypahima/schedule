"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { upsertTraineeProfile } from "@/lib/services/trainee-profile-repo";
import { validateProfilePatch } from "@/lib/profile/validate";

/** Empty input clears the field rather than writing an empty string. */
function optionalText(formData: FormData, field: string): string | null {
  const raw = String(formData.get(field) ?? "").trim();
  return raw === "" ? null : raw;
}

function optionalNumber(formData: FormData, field: string): number | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveProfile(formData: FormData) {
  const session = await requireActiveTraineeSession();

  const phone = String(formData.get("phone") ?? "").trim();
  const parsed = validateProfilePatch({
    ...(phone ? { phone } : {}),
    dateOfBirth: optionalText(formData, "dateOfBirth"),
    heightCm: optionalNumber(formData, "heightCm"),
    weightKg: optionalNumber(formData, "weightKg"),
    goals: optionalText(formData, "goals"),
    medical: optionalText(formData, "medical"),
  });

  if (!parsed.ok) redirect(`/profile?failed=${parsed.error}`);

  await upsertTraineeProfile(session.userId, parsed.value);
  revalidatePath("/profile");
  redirect("/profile?saved=1");
}
