"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/auth/session";
import { getContainer, getRealCalendarService } from "@/lib/services";

/**
 * Three-legged OAuth needs a real redirect URL, so the connect step hands the
 * browser to Google rather than doing the work here.
 */
export async function connectCalendar() {
  await requireCoachSession();

  const calendar = getRealCalendarService();
  if (!calendar) redirect("/coach/settings?failed=CALENDAR_NOT_CONFIGURED");

  redirect(calendar.getAuthUrl());
}

/** Capacity and lockout overrides for one hour of one day. */
export async function updateSlotSettings(formData: FormData) {
  await requireCoachSession();

  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const capacity = Number(formData.get("capacity") ?? 0);
  const lockoutOverride = formData.get("lockoutOverride") === "on";

  if (!date || !startTime || !Number.isFinite(capacity) || capacity < 0) {
    redirect("/coach/settings?failed=INVALID_INPUT");
  }

  const { store } = getContainer();
  const id = `slot-${date}-${startTime}`;
  const existing = await store.getSlot(id);

  await store.upsertSlot({
    id,
    date,
    startTime,
    capacity,
    lockoutOverride,
    currentBookings: existing?.currentBookings ?? 0,
  });

  revalidatePath("/coach/settings");
  redirect("/coach/settings?done=slot");
}
