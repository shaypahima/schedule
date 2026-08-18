"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";

/**
 * Joining holds nothing — when a spot opens everyone waiting is told and the
 * first to complete the normal booking flow wins (ADR-0012).
 */
export async function joinWaitlist(formData: FormData) {
  const session = await requireActiveTraineeSession();
  const slotId = String(formData.get("slotId") ?? "");
  const date = String(formData.get("date") ?? "");

  const { waitlist } = getContainer();
  const result = await waitlist.join(session.userId, slotId);

  revalidatePath("/");
  redirect(
    result.ok
      ? `/?date=${date}&waitlisted=1`
      : `/?date=${date}&failed=${result.error}`,
  );
}

export async function leaveWaitlist(formData: FormData) {
  const session = await requireActiveTraineeSession();
  const slotId = String(formData.get("slotId") ?? "");
  const date = String(formData.get("date") ?? "");

  const { waitlist } = getContainer();
  await waitlist.leave(session.userId, slotId);

  revalidatePath("/");
  redirect(`/?date=${date}&left_waitlist=1`);
}
