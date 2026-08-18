"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";
import { getPhotoStorage, PHOTO_EXTENSIONS } from "@/lib/services/photo-storage";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * One measurement: a weight, a note, a photo — any subset. The photo rides
 * along on the measurement rather than living in its own timeline.
 */
export async function logMeasurement(formData: FormData) {
  const session = await requireActiveTraineeSession();

  const rawWeight = String(formData.get("weightKg") ?? "").trim();
  // Hebrew keyboards produce a comma decimal as often as a dot.
  const weightKg = rawWeight === "" ? null : Number(rawWeight.replace(",", "."));
  if (weightKg !== null && !Number.isFinite(weightKg)) {
    redirect("/progress?failed=WEIGHT_INVALID");
  }

  const note = String(formData.get("note") ?? "").trim() || null;

  let photoUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!PHOTO_EXTENSIONS[photo.type]) redirect("/progress?failed=UNSUPPORTED_TYPE");
    if (photo.size > MAX_BYTES) redirect("/progress?failed=TOO_LARGE");

    const uploaded = await getPhotoStorage().upload({
      traineeId: session.userId,
      bytes: new Uint8Array(await photo.arrayBuffer()),
      contentType: photo.type,
    });
    photoUrl = uploaded.url;
  }

  if (weightKg === null && !note && !photoUrl) {
    redirect("/progress?failed=NOTHING_TO_LOG");
  }

  const { progress } = getContainer();
  await progress.createMeasurement(session.userId, { weightKg, note, photoUrl });

  revalidatePath("/progress");
  redirect("/progress?done=1");
}
