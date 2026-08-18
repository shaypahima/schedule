"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";

/** Outside the cancel window — the trainee just cancels. */
export async function cancelBooking(formData: FormData) {
  const session = await requireActiveTraineeSession();
  const bookingId = String(formData.get("bookingId") ?? "");

  const { bookings } = getContainer();
  const result = await bookings.cancel(bookingId, session.userId);

  revalidatePath("/bookings");
  redirect(result.ok ? "/bookings?cancelled=1" : `/bookings?failed=${result.error}`);
}

/** Inside the window — the trainee asks, the coach decides. */
export async function requestCancel(formData: FormData) {
  const session = await requireActiveTraineeSession();
  const bookingId = String(formData.get("bookingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const { bookings } = getContainer();
  const result = await bookings.requestCancel(bookingId, session.userId, reason);

  revalidatePath("/bookings");
  redirect(result.ok ? "/bookings?requested=1" : `/bookings?failed=${result.error}`);
}

/** Inside the window, but naming a slot they'd rather move to. */
export async function requestReschedule(formData: FormData) {
  const session = await requireActiveTraineeSession();
  const bookingId = String(formData.get("bookingId") ?? "");
  const newSlotId = String(formData.get("newSlotId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const { bookings } = getContainer();
  const result = await bookings.requestReschedule(
    bookingId,
    session.userId,
    newSlotId,
    reason,
  );

  revalidatePath("/bookings");
  redirect(result.ok ? "/bookings?requested=1" : `/bookings?failed=${result.error}`);
}

/** Outside the window — move the booking outright. */
export async function rescheduleBooking(formData: FormData) {
  const session = await requireActiveTraineeSession();
  const bookingId = String(formData.get("bookingId") ?? "");
  const newSlotId = String(formData.get("newSlotId") ?? "");

  const { bookings } = getContainer();
  const result = await bookings.reschedule(bookingId, session.userId, newSlotId, {
    traineeName: session.name,
  });

  revalidatePath("/bookings");
  redirect(result.ok ? "/bookings?moved=1" : `/bookings?failed=${result.error}`);
}
