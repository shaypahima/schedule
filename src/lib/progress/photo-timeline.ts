import type { MeasurementLog } from "@/lib/types";

export type ProgressPhoto = {
  id: string;
  url: string;
  loggedAt: Date;
  weightKg: number | null;
};

export type ComparePair = {
  before: ProgressPhoto | null;
  after: ProgressPhoto | null;
  /** False when there aren't two distinct photos to set against each other. */
  comparable: boolean;
};

/**
 * The trainee's photos in the order they were taken. Oldest first so the
 * change reads forward, the way progress is actually experienced.
 */
export function photoTimeline(measurements: MeasurementLog[]): ProgressPhoto[] {
  return measurements
    .filter((m): m is MeasurementLog & { photoUrl: string } => Boolean(m.photoUrl))
    .map((m) => ({
      id: m.id,
      url: m.photoUrl,
      loggedAt: m.loggedAt,
      weightKg: m.weightKg,
    }))
    .sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
}

/**
 * Which two photos to set side by side. Defaults to the widest span the
 * trainee has — first against last — since that is the comparison that shows
 * the most change.
 */
export function pickComparePair(
  photos: ProgressPhoto[],
  beforeId?: string,
  afterId?: string,
): ComparePair {
  if (photos.length === 0) {
    return { before: null, after: null, comparable: false };
  }

  const first = photos[0];
  const last = photos[photos.length - 1];
  const before = photos.find((p) => p.id === beforeId) ?? first;
  const after = photos.find((p) => p.id === afterId) ?? last;

  return { before, after, comparable: before.id !== after.id };
}
