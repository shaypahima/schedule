"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/auth/session";
import { getContainer } from "@/lib/services";
import { approveTrainee, rejectTrainee } from "@/lib/coach/approvals";
import { inviteTraineeByEmail } from "@/lib/services/trainee-invite";
import { createNote, deleteNote } from "@/lib/services/notes-repo";

/** Let a reviewed self-signup in. */
export async function approve(formData: FormData) {
  await requireCoachSession();
  const result = await approveTrainee(String(formData.get("traineeId") ?? ""));

  revalidatePath("/coach/approvals");
  redirect(result.ok ? "/coach/approvals?done=approved" : `/coach/approvals?failed=${result.error}`);
}

/** Turn a self-signup away. */
export async function reject(formData: FormData) {
  await requireCoachSession();
  const result = await rejectTrainee(String(formData.get("traineeId") ?? ""));

  revalidatePath("/coach/approvals");
  redirect(result.ok ? "/coach/approvals?done=rejected" : `/coach/approvals?failed=${result.error}`);
}

/** Pre-invite someone so they skip the approval queue entirely. */
export async function invite(formData: FormData) {
  await requireCoachSession();
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!email) redirect("/coach/trainees?failed=EMAIL_REQUIRED");

  try {
    await inviteTraineeByEmail({ email, name: name || email.split("@")[0] });
  } catch (e) {
    return redirect(`/coach/trainees?failed=${encodeURIComponent((e as Error).message)}`);
  }

  revalidatePath("/coach/trainees");
  redirect("/coach/trainees?done=invited");
}

/** Remove a trainee from active rotation; their history survives. */
export async function deactivate(formData: FormData) {
  await requireCoachSession();
  const traineeId = String(formData.get("traineeId") ?? "");

  try {
    await getContainer().auth.deleteTrainee(traineeId);
  } catch (e) {
    return redirect(`/coach/trainees?failed=${encodeURIComponent((e as Error).message)}`);
  }

  revalidatePath("/coach/trainees");
  redirect("/coach/trainees?done=deactivated");
}

/** Decide a trainee's cancel/reschedule request. */
export async function decideRequest(formData: FormData) {
  const session = await requireCoachSession();
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "") as "approve" | "reject";
  const note = String(formData.get("note") ?? "").trim();

  const { bookings } = getContainer();
  const result = await bookings.decideRequest(
    requestId,
    session.userId,
    decision,
    note || undefined,
  );

  revalidatePath("/coach/requests");
  redirect(result.ok ? `/coach/requests?done=${decision}` : `/coach/requests?failed=${result.error}`);
}

/** Flag a past session the trainee didn't turn up for. */
export async function markNoShow(formData: FormData) {
  await requireCoachSession();
  const bookingId = String(formData.get("bookingId") ?? "");

  const { bookings } = getContainer();
  const result = await bookings.markNoShow(bookingId);

  revalidatePath("/coach");
  redirect(result.ok ? "/coach?done=no_show" : `/coach?failed=${result.error}`);
}

export async function writeNote(formData: FormData) {
  await requireCoachSession();
  const traineeId = String(formData.get("traineeId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) redirect(`/coach/trainees/${traineeId}?failed=BODY_REQUIRED`);

  await createNote({
    traineeId,
    body,
    // Private by default — the coach opts a note into the trainee's view.
    visibleToTrainee: formData.get("visibleToTrainee") === "on",
  });

  revalidatePath(`/coach/trainees/${traineeId}`);
  redirect(`/coach/trainees/${traineeId}?done=note`);
}

export async function removeNote(formData: FormData) {
  await requireCoachSession();
  const noteId = String(formData.get("noteId") ?? "");
  const traineeId = String(formData.get("traineeId") ?? "");

  await deleteNote(noteId);

  revalidatePath(`/coach/trainees/${traineeId}`);
  redirect(`/coach/trainees/${traineeId}?done=note_deleted`);
}

/** Manual roster edits for the exceptions the normal flow can't cover. */
export async function addToSlot(formData: FormData) {
  await requireCoachSession();
  const traineeId = String(formData.get("traineeId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  const date = String(formData.get("date") ?? "");

  const { bookings } = getContainer();
  const result = await bookings.book(traineeId, slotId, { bypass: true });

  revalidatePath("/coach/week");
  redirect(
    result.ok
      ? `/coach/week?date=${date}&done=added`
      : `/coach/week?date=${date}&failed=${result.error}`,
  );
}

export async function removeFromSlot(formData: FormData) {
  await requireCoachSession();
  const bookingId = String(formData.get("bookingId") ?? "");
  const date = String(formData.get("date") ?? "");

  const { bookings } = getContainer();
  const result = await bookings.cancel(bookingId, "", { bypass: true });

  revalidatePath("/coach/week");
  redirect(
    result.ok
      ? `/coach/week?date=${date}&done=removed`
      : `/coach/week?date=${date}&failed=${result.error}`,
  );
}
