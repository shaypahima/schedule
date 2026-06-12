import { SupabaseClient } from "@supabase/supabase-js";
import type {
  MeasurementLog,
  MeasurementInput,
  SessionLog,
  SessionLogInput,
} from "@/lib/types";
import { ProgressStore, validateMeasurementInput } from "@/lib/services/progress-store";
import { mapMeasurementRow, mapSessionLogRow } from "@/lib/services/row-mappers";

export class SupabaseProgressStore implements ProgressStore {
  constructor(private db: SupabaseClient) {}

  async createMeasurement(
    traineeId: string,
    input: MeasurementInput
  ): Promise<MeasurementLog> {
    validateMeasurementInput(input);
    const insert: Record<string, unknown> = {
      trainee_id: traineeId,
      weight_kg: input.weightKg ?? null,
      metrics: input.metrics ?? null,
      photo_url: input.photoUrl ?? null,
      note: input.note?.trim() ? input.note.trim() : null,
    };
    if (input.loggedAt) insert.logged_at = input.loggedAt.toISOString();
    const { data, error } = await this.db
      .from("measurement_logs")
      .insert(insert)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "insert failed");
    return mapMeasurementRow(data);
  }

  async listMeasurements(
    traineeId: string,
    opts: { limit?: number; sinceDays?: number } = {}
  ): Promise<MeasurementLog[]> {
    let q = this.db
      .from("measurement_logs")
      .select("*")
      .eq("trainee_id", traineeId)
      .order("logged_at", { ascending: false });
    if (opts.sinceDays) {
      const cutoff = new Date(Date.now() - opts.sinceDays * 86_400_000).toISOString();
      q = q.gte("logged_at", cutoff);
    }
    if (opts.limit) q = q.limit(opts.limit);
    const { data } = await q;
    return (data ?? []).map((r: Record<string, unknown>) => mapMeasurementRow(r));
  }

  async getLastMeasurement(
    traineeId: string
  ): Promise<MeasurementLog | undefined> {
    const rows = await this.listMeasurements(traineeId, { limit: 1 });
    return rows[0];
  }

  async upsertSessionLog(
    bookingId: string,
    input: SessionLogInput
  ): Promise<SessionLog> {
    const patch: Record<string, unknown> = {
      booking_id: bookingId,
      updated_at: new Date().toISOString(),
    };
    if (input.feedback !== undefined) patch.feedback = input.feedback;
    if (input.coachNotes !== undefined) patch.coach_notes = input.coachNotes;
    const { data, error } = await this.db
      .from("session_logs")
      .upsert(patch, { onConflict: "booking_id" })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "upsert failed");
    return mapSessionLogRow(data);
  }

  async getSessionLog(bookingId: string): Promise<SessionLog | undefined> {
    const { data } = await this.db
      .from("session_logs")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();
    return data ? mapSessionLogRow(data) : undefined;
  }

  async listSessionLogsForTrainee(
    traineeId: string,
    opts: { limit?: number } = {}
  ): Promise<SessionLog[]> {
    let q = this.db
      .from("session_logs")
      .select("*, bookings!inner(trainee_id)")
      .eq("bookings.trainee_id", traineeId)
      .order("updated_at", { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data } = await q;
    return (data ?? []).map((r: Record<string, unknown>) => mapSessionLogRow(r));
  }

}
