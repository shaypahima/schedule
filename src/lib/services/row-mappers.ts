import type {
  Booking,
  Slot,
  EditLog,
  ChangeRequest,
  MeasurementLog,
  SessionLog,
  Profile,
  UserRole,
} from "@/lib/types";

/**
 * Row→domain mappers shared by every storage adapter (Supabase + pg).
 * Pure snake_case→camelCase translation — nothing here may depend on which
 * driver produced the row.
 */

export function mapSlotRow(row: Record<string, unknown>, currentBookings: number): Slot {
  return {
    id: row.id as string,
    date: String(row.date).slice(0, 10),
    startTime: String(row.start_time).slice(0, 5),
    capacity: row.capacity as number,
    lockoutOverride: row.lockout_override as boolean,
    currentBookings,
    version: row.version as number | undefined,
  };
}

export function mapBookingRow(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    slotId: row.slot_id as string,
    traineeId: row.trainee_id as string,
    googleEventId: (row.google_event_id as string) ?? null,
    isAutoBooked: row.is_auto_booked as boolean,
    status: row.status as Booking["status"],
    createdAt: new Date(row.created_at as string),
    reminder24hSentAt: row.reminder_24h_sent_at
      ? new Date(row.reminder_24h_sent_at as string)
      : null,
    reminder2hSentAt: row.reminder_2h_sent_at
      ? new Date(row.reminder_2h_sent_at as string)
      : null,
    postSessionPromptSentAt: row.postsession_prompt_sent_at
      ? new Date(row.postsession_prompt_sent_at as string)
      : null,
  };
}

export function mapEditLogRow(row: Record<string, unknown>): EditLog {
  return {
    id: row.id as string,
    traineeId: row.trainee_id as string,
    weekStart: String(row.week_start).slice(0, 10),
    editCount: row.edit_count as number,
  };
}

export function mapChangeRequestRow(row: Record<string, unknown>): ChangeRequest {
  return {
    id: row.id as string,
    bookingId: row.booking_id as string,
    requestedNewSlotId: (row.requested_new_slot_id as string) ?? null,
    reason: row.reason as string,
    status: row.status as ChangeRequest["status"],
    decisionNote: (row.decision_note as string) ?? null,
    requestedAt: new Date(row.requested_at as string),
    decidedAt: row.decided_at ? new Date(row.decided_at as string) : null,
    decidedBy: (row.decided_by as string) ?? null,
  };
}

export function mapMeasurementRow(row: Record<string, unknown>): MeasurementLog {
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

export function mapSessionLogRow(row: Record<string, unknown>): SessionLog {
  return {
    bookingId: row.booking_id as string,
    feedback: (row.feedback as Record<string, unknown> | null) ?? null,
    coachNotes: (row.coach_notes as string) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export function mapProfileRow(
  row: Record<string, unknown>
): Profile & { email?: string | null; status?: string } {
  return {
    id: row.id as string,
    name: row.name as string,
    role: row.role as UserRole,
    isRecurring: (row.is_recurring as boolean) ?? false,
    preferredDay: row.preferred_day as number | null,
    preferredTime: row.preferred_time ? String(row.preferred_time).slice(0, 5) : null,
    isActive: (row.is_active as boolean) ?? true,
    createdAt: new Date(row.created_at as string),
    email: (row.email as string | null) ?? null,
    status: (row.status as string) ?? ((row.is_active as boolean) ? "active" : "deactivated"),
  };
}
