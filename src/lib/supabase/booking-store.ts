import { SupabaseClient } from "@supabase/supabase-js";
import { Booking, Slot, EditLog } from "@/lib/types";
import { BookingStore } from "@/lib/services/booking-service";

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

    return this.mapSlot(slot, count ?? 0);
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
      this.mapSlot(s, countMap.get(s.id as string) ?? 0)
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

    return data ? this.mapBooking(data) : undefined;
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

    return (data ?? []).map((b: Record<string, unknown>) => this.mapBooking(b));
  }

  async getTraineeBookings(traineeId: string): Promise<Booking[]> {
    const { data } = await this.db
      .from("bookings")
      .select("*")
      .eq("trainee_id", traineeId)
      .eq("status", "confirmed");

    return (data ?? []).map((b: Record<string, unknown>) => this.mapBooking(b));
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

    return (data ?? []).map((b: Record<string, unknown>) => this.mapBooking(b));
  }

  async getAllBookings(): Promise<Booking[]> {
    const { data } = await this.db
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    return (data ?? []).map((b: Record<string, unknown>) => this.mapBooking(b));
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

    return data ? this.mapEditLog(data) : undefined;
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

  // --- Mappers ---

  private mapSlot(row: Record<string, unknown>, currentBookings: number): Slot {
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

  private mapBooking(row: Record<string, unknown>): Booking {
    return {
      id: row.id as string,
      slotId: row.slot_id as string,
      traineeId: row.trainee_id as string,
      googleEventId: (row.google_event_id as string) ?? null,
      isAutoBooked: row.is_auto_booked as boolean,
      status: row.status as "confirmed" | "cancelled",
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapEditLog(row: Record<string, unknown>): EditLog {
    return {
      id: row.id as string,
      traineeId: row.trainee_id as string,
      weekStart: String(row.week_start).slice(0, 10),
      editCount: row.edit_count as number,
    };
  }
}
