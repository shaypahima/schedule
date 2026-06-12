import { CoachNote } from "@/lib/types";
import type { NotesRepo } from "@/lib/services/notes-repo";
import { mapCoachNoteRow } from "@/lib/services/row-mappers";
import { pgQuery } from "./client";

/** Native-Postgres NotesRepo (local dev). */
export class PgNotesRepo implements NotesRepo {
  async listForTrainee(traineeId: string): Promise<CoachNote[]> {
    const rows = await pgQuery<Record<string, unknown>>(
      "select * from coach_notes where trainee_id = $1 order by created_at desc",
      [traineeId],
    );
    return rows.map(mapCoachNoteRow);
  }

  async listVisibleForTrainee(traineeId: string, limit: number): Promise<CoachNote[]> {
    const rows = await pgQuery<Record<string, unknown>>(
      `select * from coach_notes where trainee_id = $1 and visible_to_trainee = true
         order by created_at desc limit $2`,
      [traineeId, limit],
    );
    return rows.map(mapCoachNoteRow);
  }

  async create(input: {
    traineeId: string;
    body: string;
    visibleToTrainee: boolean;
  }): Promise<CoachNote> {
    const rows = await pgQuery<Record<string, unknown>>(
      `insert into coach_notes (trainee_id, body, visible_to_trainee)
         values ($1, $2, $3) returning *`,
      [input.traineeId, input.body, input.visibleToTrainee],
    );
    return mapCoachNoteRow(rows[0]);
  }

  async update(
    id: string,
    patch: { body?: string; visibleToTrainee?: boolean },
  ): Promise<CoachNote> {
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [];
    if (patch.body !== undefined) sets.push(`body = $${params.push(patch.body)}`);
    if (patch.visibleToTrainee !== undefined)
      sets.push(`visible_to_trainee = $${params.push(patch.visibleToTrainee)}`);
    params.push(id);
    const rows = await pgQuery<Record<string, unknown>>(
      `update coach_notes set ${sets.join(", ")} where id = $${params.length} returning *`,
      params,
    );
    if (rows.length === 0) throw new Error("updateNote failed: not found");
    return mapCoachNoteRow(rows[0]);
  }

  async delete(id: string): Promise<void> {
    await pgQuery("delete from coach_notes where id = $1", [id]);
  }
}
