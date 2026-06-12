import { Booking, Slot, EditLog, ChangeRequest, ReminderKind } from "@/lib/types";
import { BookingStore, REMINDER_DB_COLUMN } from "@/lib/services/booking-store";
import { israelSlotToUTC } from "@/lib/services/israel-time";
import {
  mapSlotRow,
  mapBookingRow,
  mapEditLogRow,
  mapChangeRequestRow,
} from "@/lib/services/row-mappers";
import { pgQuery } from "./client";

/**
 * Native-Postgres BookingStore (local dev, DB_DRIVER=pg). Mirrors
 * SupabaseBookingStore's behavior and row→domain mapping, but issues SQL
 * directly via node-postgres. The pool connects as DB owner, so RLS is bypassed
 * (same effect as the cloud service-role key).
 */
export class PgBookingStore implements BookingStore {
  // --- Slot methods ---

  async getSlot(slotId: string): Promise<Slot | undefined> {
    const slots = await pgQuery("select * from slots where id = $1", [slotId]);
    if (slots.length === 0) return undefined;
    const counts = await pgQuery<{ n: string }>(
      "select count(*)::int as n from bookings where slot_id = $1 and status = 'confirmed'",
      [slotId],
    );
    return mapSlotRow(slots[0], Number(counts[0]?.n ?? 0));
  }

  async updateSlot(slot: Slot): Promise<void> {
    const params: unknown[] = [slot.capacity, slot.lockoutOverride, (slot.version ?? 0) + 1, slot.id];
    let sql =
      "update slots set capacity = $1, lockout_override = $2, version = $3 where id = $4";
    if (slot.version !== undefined) {
      sql += " and version = $5";
      params.push(slot.version);
    }
    const rows = await pgQuery(sql + " returning id", params);
    if (rows.length === 0) throw new Error("Slot was modified by another request");
  }

  async upsertSlot(slot: Slot): Promise<void> {
    await pgQuery(
      `insert into slots (id, date, start_time, capacity, lockout_override)
         values (coalesce($1, gen_random_uuid()), $2, $3, $4, $5)
         on conflict (date, start_time) do update
           set capacity = excluded.capacity, lockout_override = excluded.lockout_override`,
      [slot.id || null, slot.date, slot.startTime, slot.capacity, slot.lockoutOverride],
    );
  }

  async getAllSlotsForDate(date: string): Promise<Slot[]> {
    const slots = await pgQuery("select * from slots where date = $1", [date]);
    if (slots.length === 0) return [];
    const ids = slots.map((s) => (s as { id: string }).id);
    const counts = await pgQuery<{ slot_id: string; n: string }>(
      `select slot_id, count(*)::int as n from bookings
         where slot_id = any($1) and status = 'confirmed' group by slot_id`,
      [ids],
    );
    const countMap = new Map(counts.map((c) => [c.slot_id, Number(c.n)]));
    return slots.map((s) => mapSlotRow(s, countMap.get((s as { id: string }).id) ?? 0));
  }

  // --- Booking methods ---

  async addBooking(booking: Booking): Promise<void> {
    await pgQuery(
      `insert into bookings (id, slot_id, trainee_id, google_event_id, is_auto_booked, status)
         values (coalesce($1, gen_random_uuid()), $2, $3, $4, $5, $6)`,
      [
        booking.id || null,
        booking.slotId,
        booking.traineeId,
        booking.googleEventId ?? null,
        booking.isAutoBooked,
        booking.status,
      ],
    );
  }

  async getBooking(bookingId: string): Promise<Booking | undefined> {
    const rows = await pgQuery("select * from bookings where id = $1", [bookingId]);
    return rows[0] ? mapBookingRow(rows[0]) : undefined;
  }

  async updateBooking(booking: Booking): Promise<void> {
    await pgQuery(
      `update bookings set status = $1, google_event_id = $2, is_auto_booked = $3 where id = $4`,
      [booking.status, booking.googleEventId ?? null, booking.isAutoBooked, booking.id],
    );
  }

  async getConfirmedBookingsForSlot(slotId: string): Promise<Booking[]> {
    const rows = await pgQuery(
      "select * from bookings where slot_id = $1 and status = 'confirmed'",
      [slotId],
    );
    return rows.map((b) => mapBookingRow(b));
  }

  async getTraineeBookings(traineeId: string): Promise<Booking[]> {
    const rows = await pgQuery(
      "select * from bookings where trainee_id = $1 and status = 'confirmed'",
      [traineeId],
    );
    return rows.map((b) => mapBookingRow(b));
  }

  async getTraineeBookingsForWeek(traineeId: string, weekStart: string): Promise<Booking[]> {
    const start = new Date(weekStart + "T00:00:00Z");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endStr = end.toISOString().slice(0, 10);
    const rows = await pgQuery(
      `select b.* from bookings b
         join slots s on s.id = b.slot_id
         where b.trainee_id = $1 and b.status = 'confirmed'
           and s.date >= $2 and s.date <= $3`,
      [traineeId, weekStart, endStr],
    );
    return rows.map((b) => mapBookingRow(b));
  }

  async getAllBookings(): Promise<Booking[]> {
    const rows = await pgQuery("select * from bookings order by created_at desc");
    return rows.map((b) => mapBookingRow(b));
  }

  // --- Edit log methods ---

  async getEditLog(traineeId: string, weekStart: string): Promise<EditLog | undefined> {
    const rows = await pgQuery(
      "select * from edit_log where trainee_id = $1 and week_start = $2",
      [traineeId, weekStart],
    );
    return rows[0] ? mapEditLogRow(rows[0]) : undefined;
  }

  async incrementEditCount(traineeId: string, weekStart: string): Promise<void> {
    await pgQuery(
      `insert into edit_log (trainee_id, week_start, edit_count) values ($1, $2, 1)
         on conflict (trainee_id, week_start) do update
           set edit_count = edit_log.edit_count + 1`,
      [traineeId, weekStart],
    );
  }

  async resetEditCount(traineeId: string, weekStart: string): Promise<void> {
    await pgQuery(
      "update edit_log set edit_count = 0 where trainee_id = $1 and week_start = $2",
      [traineeId, weekStart],
    );
  }

  async getRemindersDue(
    kind: ReminderKind,
    windowStartUtc: Date,
    windowEndUtc: Date,
  ): Promise<Array<{ booking: Booking; slot: Slot }>> {
    const col = REMINDER_DB_COLUMN[kind];
    const rows = await pgQuery(
      `select b.*, row_to_json(s) as slot from bookings b
         join slots s on s.id = b.slot_id
         where b.status = 'confirmed' and b.${col} is null`,
    );
    const startMs = windowStartUtc.getTime();
    const endMs = windowEndUtc.getTime();
    const out: Array<{ booking: Booking; slot: Slot }> = [];
    for (const row of rows) {
      const slotRow = (row as Record<string, unknown>).slot as Record<string, unknown>;
      if (!slotRow) continue;
      const slot = mapSlotRow(slotRow, 0);
      const slotMs = israelSlotToUTC(slot.date, slot.startTime).getTime();
      if (slotMs < startMs || slotMs >= endMs) continue;
      out.push({ booking: mapBookingRow(row), slot });
    }
    return out;
  }

  async markReminderSent(bookingId: string, kind: ReminderKind, sentAt: Date): Promise<void> {
    const col = REMINDER_DB_COLUMN[kind];
    await pgQuery(
      `update bookings set ${col} = $1 where id = $2 and ${col} is null`,
      [sentAt.toISOString(), bookingId],
    );
  }

  // --- Phase 15: change-request methods ---

  async createChangeRequest(input: {
    bookingId: string;
    requestedNewSlotId: string | null;
    reason: string;
  }): Promise<ChangeRequest> {
    const rows = await pgQuery(
      `insert into booking_change_request (booking_id, requested_new_slot_id, reason)
         values ($1, $2, $3) returning *`,
      [input.bookingId, input.requestedNewSlotId, input.reason],
    );
    return mapChangeRequestRow(rows[0]);
  }

  async getChangeRequest(id: string): Promise<ChangeRequest | undefined> {
    const rows = await pgQuery("select * from booking_change_request where id = $1", [id]);
    return rows[0] ? mapChangeRequestRow(rows[0]) : undefined;
  }

  async getPendingRequestForBooking(bookingId: string): Promise<ChangeRequest | undefined> {
    const rows = await pgQuery(
      "select * from booking_change_request where booking_id = $1 and status = 'pending'",
      [bookingId],
    );
    return rows[0] ? mapChangeRequestRow(rows[0]) : undefined;
  }

  async listPendingRequests(): Promise<ChangeRequest[]> {
    const rows = await pgQuery(
      "select * from booking_change_request where status = 'pending' order by requested_at asc",
    );
    return rows.map((r) => mapChangeRequestRow(r));
  }

  async updateChangeRequest(
    id: string,
    patch: Partial<{
      status: ChangeRequest["status"];
      decisionNote: string | null;
      decidedAt: Date | null;
      decidedBy: string | null;
    }>,
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.status !== undefined) sets.push(`status = $${params.push(patch.status)}`);
    if (patch.decisionNote !== undefined)
      sets.push(`decision_note = $${params.push(patch.decisionNote)}`);
    if (patch.decidedAt !== undefined)
      sets.push(`decided_at = $${params.push(patch.decidedAt ? patch.decidedAt.toISOString() : null)}`);
    if (patch.decidedBy !== undefined) sets.push(`decided_by = $${params.push(patch.decidedBy)}`);
    if (sets.length === 0) return;
    params.push(id);
    await pgQuery(
      `update booking_change_request set ${sets.join(", ")} where id = $${params.length}`,
      params,
    );
  }

}
