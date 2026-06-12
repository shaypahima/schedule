import type {
  MeasurementLog,
  MeasurementInput,
  SessionLog,
  SessionLogInput,
} from "@/lib/types";

/**
 * ProgressStore — measurement_logs + session_logs persistence.
 *
 * Service-role backed; route handlers gate access via require* helpers,
 * RLS on the table is for the eventual direct-from-client case.
 */
export interface ProgressStore {
  createMeasurement(
    traineeId: string,
    input: MeasurementInput
  ): Promise<MeasurementLog>;
  listMeasurements(
    traineeId: string,
    opts?: { limit?: number; sinceDays?: number }
  ): Promise<MeasurementLog[]>;
  getLastMeasurement(traineeId: string): Promise<MeasurementLog | undefined>;
  /** Batch form of listMeasurements — newest-first across many trainees in one query. */
  listMeasurementsForTrainees(
    traineeIds: string[],
    opts?: { sinceDays?: number }
  ): Promise<MeasurementLog[]>;

  upsertSessionLog(
    bookingId: string,
    input: SessionLogInput
  ): Promise<SessionLog>;
  getSessionLog(bookingId: string): Promise<SessionLog | undefined>;
  listSessionLogsForTrainee(
    traineeId: string,
    opts?: { limit?: number }
  ): Promise<SessionLog[]>;
}

export class MeasurementValidationError extends Error {
  constructor(public code: "EMPTY_PAYLOAD" | "INVALID_WEIGHT", message: string) {
    super(message);
    this.name = "MeasurementValidationError";
  }
}

export function validateMeasurementInput(input: MeasurementInput): void {
  const hasField =
    input.weightKg != null ||
    (input.metrics != null && Object.keys(input.metrics).length > 0) ||
    (input.photoUrl != null && input.photoUrl.length > 0) ||
    (input.note != null && input.note.trim().length > 0);
  if (!hasField) {
    throw new MeasurementValidationError(
      "EMPTY_PAYLOAD",
      "Measurement log requires at least one field"
    );
  }
  if (input.weightKg != null && (input.weightKg <= 0 || input.weightKg >= 500)) {
    throw new MeasurementValidationError(
      "INVALID_WEIGHT",
      "weightKg must be > 0 and < 500"
    );
  }
}

/** In-memory store for tests + dev. */
export class MockProgressStore implements ProgressStore {
  private measurements = new Map<string, MeasurementLog>();
  private sessionLogs = new Map<string, SessionLog>();

  async createMeasurement(
    traineeId: string,
    input: MeasurementInput
  ): Promise<MeasurementLog> {
    validateMeasurementInput(input);
    const row: MeasurementLog = {
      id: `ml-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      traineeId,
      loggedAt: input.loggedAt ?? new Date(),
      weightKg: input.weightKg ?? null,
      metrics: input.metrics ?? null,
      photoUrl: input.photoUrl ?? null,
      note: input.note?.trim() ? input.note.trim() : null,
    };
    this.measurements.set(row.id, row);
    return { ...row };
  }

  async listMeasurements(
    traineeId: string,
    opts: { limit?: number; sinceDays?: number } = {}
  ): Promise<MeasurementLog[]> {
    const cutoff = opts.sinceDays
      ? Date.now() - opts.sinceDays * 86_400_000
      : -Infinity;
    const out = Array.from(this.measurements.values())
      .filter((m) => m.traineeId === traineeId && m.loggedAt.getTime() >= cutoff)
      .sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime());
    return opts.limit ? out.slice(0, opts.limit).map((m) => ({ ...m })) : out.map((m) => ({ ...m }));
  }

  async getLastMeasurement(
    traineeId: string
  ): Promise<MeasurementLog | undefined> {
    const list = await this.listMeasurements(traineeId, { limit: 1 });
    return list[0];
  }

  async listMeasurementsForTrainees(
    traineeIds: string[],
    opts: { sinceDays?: number } = {}
  ): Promise<MeasurementLog[]> {
    const ids = new Set(traineeIds);
    const cutoff = opts.sinceDays
      ? Date.now() - opts.sinceDays * 86_400_000
      : -Infinity;
    return Array.from(this.measurements.values())
      .filter((m) => ids.has(m.traineeId) && m.loggedAt.getTime() >= cutoff)
      .sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime())
      .map((m) => ({ ...m }));
  }

  async upsertSessionLog(
    bookingId: string,
    input: SessionLogInput
  ): Promise<SessionLog> {
    const existing = this.sessionLogs.get(bookingId);
    const now = new Date();
    const row: SessionLog = existing
      ? {
          ...existing,
          feedback: input.feedback !== undefined ? input.feedback : existing.feedback,
          coachNotes:
            input.coachNotes !== undefined ? input.coachNotes : existing.coachNotes,
          updatedAt: now,
        }
      : {
          bookingId,
          feedback: input.feedback ?? null,
          coachNotes: input.coachNotes ?? null,
          createdAt: now,
          updatedAt: now,
        };
    this.sessionLogs.set(bookingId, row);
    return { ...row };
  }

  async getSessionLog(bookingId: string): Promise<SessionLog | undefined> {
    const r = this.sessionLogs.get(bookingId);
    return r ? { ...r } : undefined;
  }

  async listSessionLogsForTrainee(): Promise<SessionLog[]> {
    // Mock can't easily join to bookings. Returns all rows; tests should filter.
    return Array.from(this.sessionLogs.values()).map((r) => ({ ...r }));
  }
}
