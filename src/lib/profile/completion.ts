import type { TraineeProfileFields } from "@/lib/services/trainee-profile-repo";

/**
 * The optional half of a profile. Phone and intro text are excluded on
 * purpose — those were mandatory at self-signup, so counting them would make
 * every trainee look partly done before they lifted a finger.
 */
const OPTIONAL_FIELDS = [
  "photoUrl",
  "dateOfBirth",
  "heightCm",
  "weightKg",
  "goals",
  "medical",
] as const;

export type OptionalField = (typeof OPTIONAL_FIELDS)[number];

export type Completion = {
  filled: number;
  total: number;
  percent: number;
  complete: boolean;
  missing: OptionalField[];
};

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  // A field of spaces is not an answer.
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

/**
 * How much of the optional profile a trainee has filled in. Feeds a dismissible
 * nudge — never a gate. Booking stays open at 0%.
 */
export function profileCompletion(profile: TraineeProfileFields): Completion {
  const missing = OPTIONAL_FIELDS.filter((field) => !isFilled(profile[field]));
  const total = OPTIONAL_FIELDS.length;
  const filled = total - missing.length;

  return {
    filled,
    total,
    percent: Math.round((filled / total) * 100),
    complete: missing.length === 0,
    missing,
  };
}
