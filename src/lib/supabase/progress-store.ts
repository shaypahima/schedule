import { SupabaseClient } from "@supabase/supabase-js";
import type {
  MeasurementLog,
  MeasurementInput,
  SessionLog,
  SessionLogInput,
} from "@/lib/types";
import { ProgressStore, validateMeasurementInput } from "@/lib/services/progress-store";

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
    return this.mapMeasurement(data);
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
    return (data ?? []).map((r: Record<string, unknown>) => this.mapMeasurement(r));
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
    return this.mapSessionLog(data);
  }

  async getSessionLog(bookingId: string): Promise<SessionLog | undefined> {
    const { data } = await this.db
      .from("session_logs")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();
    return data ? this.mapSessionLog(data) : undefined;
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
    return (data ?? []).map((r: Record<string, unknown>) => this.mapSessionLog(r));
  }

  private mapMeasurement(row: Record<string, unknown>): MeasurementLog {
    return {
      id: row.id as string,
      traineeId: row.trainee_id as string,
      loggedAt: new Date(row.logged_at as string),
      weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
      metrics: (row.metrics as Record<string, unknown> | null) ?? null,
      photoUrl: (row.photo_url as string) ?? null,
      note: (row.note as string) ?? null,
    };
  }

  private mapSessionLog(row: Record<string, unknown>): SessionLog {
    return {
      bookingId: row.booking_id as string,
      feedback: (row.feedback as Record<string, unknown> | null) ?? null,
      coachNotes: (row.coach_notes as string) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
