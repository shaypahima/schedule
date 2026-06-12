import type {
  CoachInfoRepo,
  CoachInfo,
  CoachInfoPatch,
} from "@/lib/services/coach-info-repo";
import { pgQuery } from "./client";

/** Native-Postgres CoachInfoRepo (local dev). */
export class PgCoachInfoRepo implements CoachInfoRepo {
  async get(): Promise<CoachInfo | null> {
    const coach = await pgQuery<{ name: string }>(
      "select name from profiles where role = 'coach' order by created_at limit 1",
    );
    if (coach.length === 0) return null;
    const s = await pgQuery<Record<string, unknown>>(
      "select contact_phone, bio, specialty, years_experience from coach_settings limit 1",
    );
    return {
      name: coach[0].name,
      contactPhone: (s[0]?.contact_phone as string | null) ?? null,
      bio: (s[0]?.bio as string | null) ?? null,
      specialty: (s[0]?.specialty as string | null) ?? null,
      yearsExperience: (s[0]?.years_experience as number | null) ?? null,
    };
  }

  async updateContactPhone(coachId: string, phone: string): Promise<void> {
    await pgQuery(
      `insert into coach_settings (id, contact_phone) values ($1, $2)
         on conflict (id) do update set contact_phone = excluded.contact_phone`,
      [coachId, phone],
    );
  }

  async update(coachId: string, patch: CoachInfoPatch): Promise<void> {
    const cols: string[] = ["id"];
    const vals: unknown[] = [coachId];
    const ph: string[] = ["$1"];
    const add = (col: string, v: unknown) => {
      cols.push(col);
      vals.push(v);
      ph.push(`$${vals.length}`);
    };
    if (patch.contactPhone !== undefined) add("contact_phone", patch.contactPhone);
    if (patch.bio !== undefined) add("bio", patch.bio);
    if (patch.specialty !== undefined) add("specialty", patch.specialty);
    if (patch.yearsExperience !== undefined) add("years_experience", patch.yearsExperience);
    const updates = cols
      .slice(1)
      .map((c) => `${c} = excluded.${c}`)
      .join(", ");
    await pgQuery(
      `insert into coach_settings (${cols.join(", ")}) values (${ph.join(", ")})
         on conflict (id) do update set ${updates || "id = excluded.id"}`,
      vals,
    );
  }
}
