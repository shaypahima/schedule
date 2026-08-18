"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";

export async function bookSlot(formData: FormData) {
  const session = await requireActiveTraineeSession();

  const slotId = String(formData.get("slotId") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!slotId) redirect(`/?date=${date}`);

  const { bookings } = getContainer();
  const result = await bookings.book(session.userId, slotId, {
    traineeName: session.name,
  });

  revalidatePath("/");
  if (!result.ok) redirect(`/?date=${date}&failed=${result.error}`);
  redirect(`/?date=${date}&booked=1`);
}
