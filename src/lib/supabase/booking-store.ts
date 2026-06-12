import { SupabaseClient } from "@supabase/supabase-js";
import { Booking, Slot, EditLog, ChangeRequest, ReminderKind } from "@/lib/types";
import { BookingStore, REMINDER_DB_COLUMN } from "@/lib/services/booking-store";
import { israelSlotToUTC } from "@/lib/services/israel-time";
import {
  mapSlotRow,
  mapBookingRow,
  mapEditLogRow,
  mapChangeRequestRow,
} from "@/lib/services/row-mappers";

/**
 * Supabase-backed BookingStore implementation.
 *
 * Maps between the app's camelCase domain types and the DB's snake_case columns.
 * Computes `currentBookings` on slots from confirmed booking count.
 */
export class SupabaseBookingStore implements BookingStore {
  constructor(private db: SupabaseClient) {}

  // --- Slot methods ---

  async getSlot(slotId: string): Promise<Slot | undefined> {
    const { data: slot } = await this.db
      .from("slots")
      .select("*")
      .eq("id", slotId)
      .single();

    if (!slot) return undefined;

    const { count } = await this.db
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("slot_id", slotId)
      .eq("status", "confirmed");

    return mapSlotRow(slot, count ?? 0);
  }

  async updateSlot(slot: Slot): Promise<void> {
    const updateData: Record<string, unknown> = {
      capacity: slot.capacity,
      lockout_override: slot.lockoutOverride,
      version: (slot.version ?? 0) + 1,
    };

    let query = this.db
      .from("slots")
      .update(updateData)
      .eq("id", slot.id);

    // Optimistic lock: if version is set, check it matches
    if (slot.version !== undefined) {
      query = query.eq("version", slot.version);
    }

    const { data, error } = await query.select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("Slot was modified by another request");
    }
  }

  async upsertSlot(slot: Slot): Promise<void> {
    const { error } = await this.db
      .from("slots")
      .upsert({
        id: slot.id || undefined,
        date: slot.date,
        start_time: slot.startTime,
        capacity: slot.capacity,
        lockout_override: slot.lockoutOverride,
      }, { onConflict: "date,start_time" });

    if (error) throw new Error(error.message);
  }

  async getAllSlotsForDate(date: string): Promise<Slot[]> {
    const { data: slots } = await this.db
      .from("slots")
      .select("*")
      .eq("date", date);

    if (!slots || slots.length === 0) return [];

    const slotIds = slots.map((s: { id: string }) => s.id);
    const { data: bookings } = await this.db
      .from("bookings")
      .select("slot_id")
      .in("slot_id", slotIds)
      .eq("status", "confirmed");

    const countMap = new Map<string, number>();
    for (const b of bookings ?? []) {
      countMap.set(b.slot_id, (countMap.get(b.slot_id) ?? 0) + 1);
    }

    return slots.map((s: Record<string, unknown>) =>
      mapSlotRow(s, countMap.get(s.id as string) ?? 0)
    );
  }

  // --- Booking methods ---

  async addBooking(booking: Booking): Promise<void> {
    const { error } = await this.db.from("bookings").insert({
      id: booking.id || undefined,
      slot_id: booking.slotId,
      trainee_id: booking.traineeId,
      google_event_id: booking.googleEventId,
      is_auto_booked: booking.isAutoBooked,
      status: booking.status,
    });
    if (error) throw new Error(error.message);
  }

  async getBooking(bookingId: string): Promise<Booking | undefined> {
    const { data } = await this.db
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    return data ? mapBookingRow(data) : undefined;
  }

  async updateBooking(booking: Booking): Promise<void> {
    const { error } = await this.db
      .from("bookings")
      .update({
        status: booking.status,
        google_event_id: booking.googleEventId,
        is_auto_booked: booking.isAutoBooked,
      })
      .eq("id", booking.id);

    if (error) throw new Error(error.message);
  }

  async getConfirmedBookingsForSlot(slotId: string): Promise<Booking[]> {
    const { data } = await this.db
      .from("bookings")
      .select("*")
      .eq("slot_id", slotId)
      .eq("status", "confirmed");

    return (data ?? []).map((b: Record<string, unknown>) => mapBookingRow(b));
  }

  async getTraineeBookings(traineeId: string): Promise<Booking[]> {
    const { data } = await this.db
      .from("bookings")
      .select("*")
      .eq("trainee_id", traineeId)
      .eq("status", "confirmed");

    return (data ?? []).map((b: Record<string, unknown>) => mapBookingRow(b));
  }

  async getTraineeBookingsForWeek(
    traineeId: string,
    weekStart: string
  ): Promise<Booking[]> {
    const start = new Date(weekStart + "T00:00:00Z");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endStr = end.toISOString().slice(0, 10);

    const { data } = await this.db
      .from("bookings")
      .select("*, slots!inner(date)")
      .eq("trainee_id", traineeId)
      .eq("status", "confirmed")
      .gte("slots.date", weekStart)
      .lte("slots.date", endStr);

    return (data ?? []).map((b: Record<string, unknown>) => mapBookingRow(b));
  }

  async getAllBookings(): Promise<Booking[]> {
    const { data } = await this.db
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    return (data ?? []).map((b: Record<string, unknown>) => mapBookingRow(b));
  }

  // --- Edit log methods ---

  async getEditLog(
    traineeId: string,
    weekStart: string
  ): Promise<EditLog | undefined> {
    const { data } = await this.db
      .from("edit_log")
      .select("*")
      .eq("trainee_id", traineeId)
      .eq("week_start", weekStart)
      .maybeSingle();

    return data ? mapEditLogRow(data) : undefined;
  }

  async incrementEditCount(
    traineeId: string,
    weekStart: string
  ): Promise<void> {
    const { data: existing } = await this.db
      .from("edit_log")
      .select("id, edit_count")
      .eq("trainee_id", traineeId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (existing) {
      await this.db
        .from("edit_log")
        .update({ edit_count: existing.edit_count + 1 })
        .eq("id", existing.id);
    } else {
      await this.db.from("edit_log").insert({
        trainee_id: traineeId,
        week_start: weekStart,
        edit_count: 1,
      });
    }
  }

  async resetEditCount(
    traineeId: string,
    weekStart: string
  ): Promise<void> {
    await this.db
      .from("edit_log")
      .update({ edit_count: 0 })
      .eq("trainee_id", traineeId)
      .eq("week_start", weekStart);
  }

  async getRemindersDue(
    kind: ReminderKind,
    windowStartUtc: Date,
    windowEndUtc: Date
  ): Promise<Array<{ booking: Booking; slot: Slot }>> {
    const col = REMINDER_DB_COLUMN[kind];
    const { data } = await this.db
      .from("bookings")
      .select("*, slots!inner(*)")
      .eq("status", "confirmed")
      .is(col, null);

    const startMs = windowStartUtc.getTime();
    const endMs = windowEndUtc.getTime();
    const out: Array<{ booking: Booking; slot: Slot }> = [];
    for (const row of data ?? []) {
      const slotRow = (row as Record<string, unknown>).slots as Record<string, unknown>;
      if (!slotRow) continue;
      const slot = mapSlotRow(slotRow, 0);
      const slotMs = israelSlotToUTC(slot.date, slot.startTime).getTime();
      if (slotMs < startMs || slotMs >= endMs) continue;
      const booking = mapBookingRow(row as Record<string, unknown>);
      out.push({ booking, slot });
    }
    return out;
  }

  async markReminderSent(
    bookingId: string,
    kind: ReminderKind,
    sentAt: Date
  ): Promise<void> {
    const col = REMINDER_DB_COLUMN[kind];
    const { error } = await this.db
      .from("bookings")
      .update({ [col]: sentAt.toISOString() })
      .eq("id", bookingId)
      .is(col, null);
    if (error) throw new Error(error.message);
  }

  // --- Phase 15: cancel-request methods ---

  async createChangeRequest(input: {
    bookingId: string;
    requestedNewSlotId: string | null;
    reason: string;
  }): Promise<ChangeRequest> {
    const { data, error } = await this.db
      .from("booking_change_request")
      .insert({
        booking_id: input.bookingId,
        requested_new_slot_id: input.requestedNewSlotId,
        reason: input.reason,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapChangeRequestRow(data);
  }

  async getChangeRequest(id: string): Promise<ChangeRequest | undefined> {
    const { data } = await this.db
      .from("booking_change_request")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? mapChangeRequestRow(data) : undefined;
  }

  async getPendingRequestForBooking(bookingId: string): Promise<ChangeRequest | undefined> {
    const { data } = await this.db
      .from("booking_change_request")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("status", "pending")
      .maybeSingle();
    return data ? mapChangeRequestRow(data) : undefined;
  }

  async listPendingRequests(): Promise<ChangeRequest[]> {
    const { data } = await this.db
      .from("booking_change_request")
      .select("*")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });
    return (data ?? []).map((r: Record<string, unknown>) => mapChangeRequestRow(r));
  }

  async updateChangeRequest(
    id: string,
    patch: Partial<{
      status: ChangeRequest["status"];
      decisionNote: string | null;
      decidedAt: Date | null;
      decidedBy: string | null;
    }>
  ): Promise<void> {
    const dbPatch: Record<string, unknown> = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.decisionNote !== undefined) dbPatch.decision_note = patch.decisionNote;
    if (patch.decidedAt !== undefined) {
      dbPatch.decided_at = patch.decidedAt ? patch.decidedAt.toISOString() : null;
    }
    if (patch.decidedBy !== undefined) dbPatch.decided_by = patch.decidedBy;
    const { error } = await this.db
      .from("booking_change_request")
      .update(dbPatch)
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}
