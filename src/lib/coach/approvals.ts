import { loadProfile, setProfileStatus } from "@/lib/auth/profile-repo";

export type ApprovalError =
  | "NOT_FOUND"
  | "NOT_A_TRAINEE"
  | "NOT_PENDING"
  | "INTRO_MISSING";

export type ApprovalResult = { ok: true } | { ok: false; error: ApprovalError };

async function pendingTrainee(
  traineeId: string,
): Promise<{ ok: true; hasIntro: boolean } | { ok: false; error: ApprovalError }> {
  const target = await loadProfile(traineeId);
  if (!target) return { ok: false, error: "NOT_FOUND" };
  if (target.role !== "trainee") return { ok: false, error: "NOT_A_TRAINEE" };
  // Approval and rejection both belong to the pre-active phase. Removing an
  // active trainee is deactivation, a different act with different fallout.
  if (target.status !== "pending") return { ok: false, error: "NOT_PENDING" };
  return { ok: true, hasIntro: target.hasIntro };
}

/** Let a reviewed self-signup in. Requires the intro the review is based on. */
export async function approveTrainee(traineeId: string): Promise<ApprovalResult> {
  const target = await pendingTrainee(traineeId);
  if (!target.ok) return target;
  if (!target.hasIntro) return { ok: false, error: "INTRO_MISSING" };

  await setProfileStatus(traineeId, "active");
  return { ok: true };
}

/**
 * Turn a self-signup away. Unlike approval this needs no intro — the coach may
 * refuse on the email alone.
 */
export async function rejectTrainee(traineeId: string): Promise<ApprovalResult> {
  const target = await pendingTrainee(traineeId);
  if (!target.ok) return target;

  await setProfileStatus(traineeId, "rejected");
  return { ok: true };
}
