import { pickAdapter } from "./driver";
import { PgCoachInfoRepo } from "@/lib/pg/coach-info-repo";
import { SupabaseCoachInfoRepo } from "@/lib/supabase/coach-info-repo";

export type CoachInfo = {
  name: string;
  contactPhone: string | null;
  bio: string | null;
  specialty: string | null;
  yearsExperience: number | null;
};

export type CoachInfoPatch = {
  contactPhone?: string;
  bio?: string | null;
  specialty?: string | null;
  yearsExperience?: number | null;
};

/** CoachInfoRepo — public coach info + coach_settings persistence. */
export interface CoachInfoRepo {
  get(): Promise<CoachInfo | null>;
  updateContactPhone(coachId: string, phone: string): Promise<void>;
  update(coachId: string, patch: CoachInfoPatch): Promise<void>;
}

let repo: CoachInfoRepo | undefined;

function getRepo(): CoachInfoRepo {
  return (repo ??= pickAdapter<CoachInfoRepo>({
    pg: () => new PgCoachInfoRepo(),
    supabase: () => new SupabaseCoachInfoRepo(),
  }));
}

/** Test seam: override the adapter (pass undefined to restore driver selection). */
export function setCoachInfoRepo(override: CoachInfoRepo | undefined): void {
  repo = override;
}

export async function getCoachInfo(): Promise<CoachInfo | null> {
  return getRepo().get();
}

export async function updateCoachContactPhone(coachId: string, phone: string): Promise<void> {
  return getRepo().updateContactPhone(coachId, phone);
}

export async function updateCoachInfo(coachId: string, patch: CoachInfoPatch): Promise<void> {
  return getRepo().update(coachId, patch);
}
