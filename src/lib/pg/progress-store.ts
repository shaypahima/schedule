import type {
  MeasurementLog,
  MeasurementInput,
  SessionLog,
  SessionLogInput,
} from "@/lib/types";
import { ProgressStore, validateMeasurementInput } from "@/lib/services/progress-store";
import { mapMeasurementRow, mapSessionLogRow } from "@/lib/services/row-mappers";
import { pgQuery } from "./client";

/** Native-Postgres ProgressStore (local dev). Mirrors SupabaseProgressStore. */
export class PgProgressStore implements ProgressStore {
  async createMeasurement(traineeId: string, input: MeasurementInput): Promise<MeasurementLog> {
    validateMeasurementInput(input);
    const rows = await pgQuery<Record<string, unknown>>(
      `insert into measurement_logs (trainee_id, weight_kg, metrics, photo_url, note, logged_at)
         values ($1, $2, $3, $4, $5, coalesce($6, now()))
         returning *`,
      [
        traineeId,
        input.weightKg ?? null,
        input.metrics ? JSON.stringify(input.metrics) : null,
        input.photoUrl ?? null,
        input.note?.trim() ? input.note.trim() : null,
        input.loggedAt ? input.loggedAt.toISOString() : null,
      ],
    );
    return mapMeasurementRow(rows[0]);
  }

  async listMeasurements(
    traineeId: string,
    opts: { limit?: number; sinceDays?: number } = {},
  ): Promise<MeasurementLog[]> {
    const params: unknown[] = [traineeId];
    let sql =
      "select * from measurement_logs where trainee_id = $1";
    if (opts.sinceDays) {
      const cutoff = new Date(Date.now() - opts.sinceDays * 86_400_000).toISOString();
      sql += ` and logged_at >= $${params.push(cutoff)}`;
    }
    sql += " order by logged_at desc";
    if (opts.limit) sql += ` limit $${params.push(opts.limit)}`;
    const rows = await pgQuery<Record<string, unknown>>(sql, params);
    return rows.map((r) => mapMeasurementRow(r));
  }

  async getLastMeasurement(traineeId: string): Promise<MeasurementLog | undefined> {
    const rows = await this.listMeasurements(traineeId, { limit: 1 });
    return rows[0];
  }

  async listMeasurementsForTrainees(
    traineeIds: string[],
    opts: { sinceDays?: number } = {},
  ): Promise<MeasurementLog[]> {
    if (traineeIds.length === 0) return [];
    const params: unknown[] = [traineeIds];
    let sql = "select * from measurement_logs where trainee_id = any($1)";
    if (opts.sinceDays) {
      const cutoff = new Date(Date.now() - opts.sinceDays * 86_400_000).toISOString();
      sql += ` and logged_at >= $${params.push(cutoff)}`;
    }
    sql += " order by logged_at desc";
    const rows = await pgQuery<Record<string, unknown>>(sql, params);
    return rows.map((r) => mapMeasurementRow(r));
  }

  async upsertSessionLog(bookingId: string, input: SessionLogInput): Promise<SessionLog> {
    const rows = await pgQuery<Record<string, unknown>>(
      `insert into session_logs (booking_id, feedback, coach_notes, updated_at)
         values ($1, $2, $3, now())
         on conflict (booking_id) do update set
           feedback = coalesce($2, session_logs.feedback),
           coach_notes = coalesce($3, session_logs.coach_notes),
           updated_at = now()
         returning *`,
      [
        bookingId,
        input.feedback !== undefined ? JSON.stringify(input.feedback) : null,
        input.coachNotes !== undefined ? input.coachNotes : null,
      ],
    );
    return mapSessionLogRow(rows[0]);
  }

  async getSessionLog(bookingId: string): Promise<SessionLog | undefined> {
    const rows = await pgQuery<Record<string, unknown>>(
      "select * from session_logs where booking_id = $1",
      [bookingId],
    );
    return rows[0] ? mapSessionLogRow(rows[0]) : undefined;
  }

  async listSessionLogsForTrainee(
    traineeId: string,
    opts: { limit?: number } = {},
  ): Promise<SessionLog[]> {
    const params: unknown[] = [traineeId];
    let sql = `select sl.* from session_logs sl
        join bookings b on b.id = sl.booking_id
        where b.trainee_id = $1
        order by sl.updated_at desc`;
    if (opts.limit) sql += ` limit $${params.push(opts.limit)}`;
    const rows = await pgQuery<Record<string, unknown>>(sql, params);
    return rows.map((r) => mapSessionLogRow(r));
  }

}
