import type {
  TraineeProfileRepo,
  TraineeProfileFields,
  TraineeProfilePatch,
} from "@/lib/services/trainee-profile-repo";
import { mapTraineeProfileRow } from "@/lib/services/trainee-profile-repo";
import { pgQuery } from "./client";

/** Native-Postgres TraineeProfileRepo (local dev). */
export class PgTraineeProfileRepo implements TraineeProfileRepo {
  async get(userId: string): Promise<TraineeProfileFields> {
    const rows = await pgQuery<Record<string, unknown>>(
      "select * from trainee_profile where id = $1",
      [userId],
    );
    return mapTraineeProfileRow(rows[0] ?? null);
  }

  async upsert(userId: string, patch: TraineeProfilePatch): Promise<TraineeProfileFields> {
    const cols: string[] = ["id"];
    const vals: unknown[] = [userId];
    const ph: string[] = ["$1"];
    const add = (col: string, v: unknown) => {
      cols.push(col);
      vals.push(v);
      ph.push(`$${vals.length}`);
    };
    if (patch.phone !== undefined) add("phone", patch.phone);
    if (patch.introText !== undefined) add("intro_text", patch.introText);
    if (patch.photoUrl !== undefined) add("photo_url", patch.photoUrl);
    if (patch.dateOfBirth !== undefined) add("date_of_birth", patch.dateOfBirth);
    if (patch.heightCm !== undefined) add("height_cm", patch.heightCm);
    if (patch.weightKg !== undefined) add("weight_kg", patch.weightKg);
    if (patch.goals !== undefined) add("goals", patch.goals);
    if (patch.medical !== undefined) add("medical", patch.medical);
    const updates = cols
      .slice(1)
      .map((c) => `${c} = excluded.${c}`)
      .concat("updated_at = now()")
      .join(", ");
    const rows = await pgQuery<Record<string, unknown>>(
      `insert into trainee_profile (${cols.join(", ")}) values (${ph.join(", ")})
         on conflict (id) do update set ${updates}
         returning *`,
      vals,
    );
    return mapTraineeProfileRow(rows[0]);
  }
}
