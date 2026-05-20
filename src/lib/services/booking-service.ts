import { Booking, Slot, EditLog } from "@/lib/types";
import { GoogleCalendarService } from "./google-calendar";
import { NotificationService, NotificationPayload } from "./notification";
import { israelSlotToUTC, isLockedOut, weekStartForDate } from "./israel-time";

export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}

export interface BookingStore {
  getSlot(slotId: string): Promise<Slot | undefined> | Slot | undefined;
  /** Update slot. If slot has a version, check it matches current version (optimistic lock). */
  updateSlot(slot: Slot): Promise<void> | void;
  addBooking(booking: Booking): Promise<void> | void;
  getBooking(bookingId: string): Promise<Booking | undefined> | Booking | undefined;
  updateBooking(booking: Booking): Promise<void> | void;
  getConfirmedBookingsForSlot(slotId: string): Promise<Booking[]> | Booking[];
  getTraineeBookings(traineeId: string): Promise<Booking[]> | Booking[];
  getEditLog(traineeId: string, weekStart: string): Promise<EditLog | undefined> | EditLog | undefined;
  incrementEditCount(traineeId: string, weekStart: string): Promise<void> | void;
  getTraineeBookingsForWeek(traineeId: string, weekStart: string): Promise<Booking[]> | Booking[];
  getAllSlotsForDate(date: string): Promise<Slot[]> | Slot[];
  getAllBookings(): Promise<Booking[]> | Booking[];
  upsertSlot(slot: Slot): Promise<void> | void;
  resetEditCount(traineeId: string, weekStart: string): Promise<void> | void;
  /**
   * Confirmed bookings whose slot starts within [windowStartUtc, windowEndUtc)
   * and whose reminderSentAt is still null. Each result includes the slot row
   * so callers can localize the time + send the push without an extra fetch.
   */
  getRemindersDue(
    windowStartUtc: Date,
    windowEndUtc: Date
  ): Promise<Array<{ booking: Booking; slot: Slot }>> | Array<{ booking: Booking; slot: Slot }>;
  markReminderSent(bookingId: string, sentAt: Date): Promise<void> | void;
}

const MAX_EDITS_PER_WEEK = 3;
const MAX_SESSIONS_PER_WEEK = 2;
const LOCKOUT_HOURS = 7;

/** @deprecated Use weekStartForDate from israel-time.ts */
export function getWeekStart(date: string): string {
  return weekStartForDate(date);
}

export class BookingService {
  constructor(
    private store: BookingStore,
    private calendar?: GoogleCalendarService,
    private notifier?: NotificationService
  ) {}

  getRemainingEdits(traineeId: string, weekStart: string): number {
    const log = this.store.getEditLog(traineeId, weekStart) as EditLog | undefined;
    return MAX_EDITS_PER_WEEK - (log?.editCount || 0);
  }

  private async notify(payload: NotificationPayload): Promise<void> {
    if (this.notifier) {
      try { await this.notifier.notifyCoach(payload); } catch { /* non-blocking */ }
    }
  }

  private checkEditLimit(traineeId: string, slotDate: string, isAutoBooked: boolean): void {
    if (isAutoBooked) return; // auto-booked edits exempt
    const weekStart = getWeekStart(slotDate);
    const remaining = this.getRemainingEdits(traineeId, weekStart);
    if (remaining <= 0) {
      throw new BookingError("Edit limit reached (3/week)");
    }
  }

  private trackEdit(traineeId: string, slotDate: string, isAutoBooked: boolean): void {
    if (isAutoBooked) return;
    const weekStart = getWeekStart(slotDate);
    this.store.incrementEditCount(traineeId, weekStart);
  }

  private checkWeeklyLimit(traineeId: string, slotDate: string): void {
    const weekStart = getWeekStart(slotDate);
    const bookings = this.store.getTraineeBookingsForWeek(traineeId, weekStart) as Booking[];
    if (bookings.length >= MAX_SESSIONS_PER_WEEK) {
      throw new BookingError("Max 2 sessions per week");
    }
  }

  private checkLockout(slot: Slot): void {
    if (slot.lockoutOverride) return;
    if (isLockedOut(slot.date, slot.startTime, LOCKOUT_HOURS)) {
      throw new BookingError("Cannot modify within 7 hours of session");
    }
  }

  async book(
    traineeId: string,
    slotId: string,
    traineeName?: string
  ): Promise<Booking> {
    let slot = this.store.getSlot(slotId) as Slot | undefined;

    // Auto-create slot from "new-YYYY-MM-DD-HH:mm" placeholder IDs
    if (!slot && slotId.startsWith("new-")) {
      const match = slotId.match(/^new-(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2})$/);
      if (match) {
        slot = {
          id: slotId,
          date: match[1],
          startTime: match[2],
          capacity: 2,
          lockoutOverride: false,
          currentBookings: 0,
        };
        this.store.upsertSlot(slot);
      }
    }

    if (!slot) throw new BookingError("Slot not found");

    this.checkLockout(slot);
    this.checkWeeklyLimit(traineeId, slot.date);

    if (slot.currentBookings >= slot.capacity) {
      throw new BookingError("Slot is full");
    }

    // Check if trainee already has a confirmed booking for this slot
    const existing = (this.store.getConfirmedBookingsForSlot(slotId) as Booking[])
      .find((b) => b.traineeId === traineeId);
    if (existing) throw new BookingError("Already booked");

    // Create Google Calendar event if calendar service available
    let googleEventId: string | null = null;
    if (this.calendar && traineeName) {
      const start = israelSlotToUTC(slot.date, slot.startTime);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const event = await this.calendar.createEvent({
        summary: traineeName,
        start,
        end,
      });
      googleEventId = event.id;
    }

    const booking: Booking = {
      id: `booking-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      slotId,
      traineeId,
      googleEventId,
      isAutoBooked: false,
      status: "confirmed",
      createdAt: new Date(),
      reminderSentAt: null,
    };

    this.store.addBooking(booking);
    this.store.updateSlot({
      ...slot,
      currentBookings: slot.currentBookings + 1,
    });

    return booking;
  }

  async cancel(bookingId: string, traineeId: string, skipEditLimit = false): Promise<void> {
    const booking = this.store.getBooking(bookingId) as Booking | undefined;
    if (!booking || booking.status !== "confirmed") {
      throw new BookingError("Booking not found");
    }
    if (booking.traineeId !== traineeId) {
      throw new BookingError("Not your booking");
    }

    const slot = this.store.getSlot(booking.slotId) as Slot | undefined;
    if (!slot) throw new BookingError("Slot not found");

    if (!skipEditLimit) {
      this.checkLockout(slot);
      this.checkEditLimit(traineeId, slot.date, booking.isAutoBooked);
    }

    // Delete Google Calendar event if exists
    if (this.calendar && booking.googleEventId) {
      try {
        await this.calendar.deleteEvent(booking.googleEventId);
      } catch {
        // Calendar event may already be deleted — proceed with cancel
      }
    }

    this.store.updateBooking({ ...booking, status: "cancelled" });
    this.store.updateSlot({
      ...slot,
      currentBookings: Math.max(0, slot.currentBookings - 1),
    });

    if (!skipEditLimit) {
      this.trackEdit(traineeId, slot.date, booking.isAutoBooked);
      await this.notify({
        type: "cancel",
        traineeName: traineeId, // caller can pass name via context
        slotDate: slot.date,
        slotTime: slot.startTime,
      });
    }
  }

  async reschedule(
    bookingId: string,
    traineeId: string,
    newSlotId: string,
    traineeName?: string
  ): Promise<Booking> {
    const oldBooking = this.store.getBooking(bookingId) as Booking | undefined;
    if (!oldBooking || oldBooking.status !== "confirmed") {
      throw new BookingError("Booking not found");
    }
    const oldSlot = this.store.getSlot(oldBooking.slotId) as Slot | undefined;
    if (!oldSlot) throw new BookingError("Slot not found");

    // Check lockout + edit limit once for the whole reschedule (counts as 1 edit)
    this.checkLockout(oldSlot);
    this.checkEditLimit(traineeId, oldSlot.date, oldBooking.isAutoBooked);

    // Cancel old booking (skip edit limit — we already checked)
    await this.cancel(bookingId, traineeId, true);

    // Book new slot
    const newBooking = await this.book(traineeId, newSlotId, traineeName);

    // Track as single edit
    this.trackEdit(traineeId, oldSlot.date, oldBooking.isAutoBooked);

    const newSlot = this.store.getSlot(newSlotId) as Slot | undefined;
    await this.notify({
      type: "reschedule",
      traineeName: traineeId,
      slotDate: oldSlot.date,
      slotTime: oldSlot.startTime,
      newSlotDate: newSlot?.date,
      newSlotTime: newSlot?.startTime,
    });

    return newBooking;
  }

  /** Admin: book trainee into slot, bypassing all limits */
  async adminBook(traineeId: string, slotId: string, traineeName?: string): Promise<Booking> {
    let slot = this.store.getSlot(slotId) as Slot | undefined;

    if (!slot && slotId.startsWith("new-")) {
      const match = slotId.match(/^new-(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2})$/);
      if (match) {
        slot = {
          id: slotId,
          date: match[1],
          startTime: match[2],
          capacity: 2,
          lockoutOverride: false,
          currentBookings: 0,
        };
        this.store.upsertSlot(slot);
      }
    }

    if (!slot) throw new BookingError("Slot not found");
    if (slot.currentBookings >= slot.capacity) throw new BookingError("Slot is full");

    const existing = (this.store.getConfirmedBookingsForSlot(slotId) as Booking[])
      .find((b) => b.traineeId === traineeId);
    if (existing) throw new BookingError("Already booked");

    let googleEventId: string | null = null;
    if (this.calendar && traineeName) {
      const start = israelSlotToUTC(slot.date, slot.startTime);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const event = await this.calendar.createEvent({ summary: traineeName, start, end });
      googleEventId = event.id;
    }

    const booking: Booking = {
      id: `booking-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      slotId,
      traineeId,
      googleEventId,
      isAutoBooked: false,
      status: "confirmed",
      createdAt: new Date(),
      reminderSentAt: null,
    };

    this.store.addBooking(booking);
    this.store.updateSlot({ ...slot, currentBookings: slot.currentBookings + 1 });
    return booking;
  }

  /** Admin: cancel booking, bypassing all limits */
  async adminCancel(bookingId: string): Promise<void> {
    const booking = this.store.getBooking(bookingId) as Booking | undefined;
    if (!booking || booking.status !== "confirmed") throw new BookingError("Booking not found");

    const slot = this.store.getSlot(booking.slotId) as Slot | undefined;
    if (!slot) throw new BookingError("Slot not found");

    if (this.calendar && booking.googleEventId) {
      try { await this.calendar.deleteEvent(booking.googleEventId); } catch { /* ok */ }
    }

    this.store.updateBooking({ ...booking, status: "cancelled" });
    this.store.updateSlot({ ...slot, currentBookings: Math.max(0, slot.currentBookings - 1) });
  }
}

/**
 * In-memory booking store for dev/testing
 */
export class MockBookingStore implements BookingStore {
  private slots = new Map<string, Slot>();
  private bookings = new Map<string, Booking>();
  private editLogs = new Map<string, EditLog>();

  addSlot(slot: Slot): void {
    this.slots.set(slot.id, { ...slot, version: slot.version ?? 1 });
  }

  getSlot(slotId: string): Slot | undefined {
    const slot = this.slots.get(slotId);
    return slot ? { ...slot } : undefined; // return copy
  }

  updateSlot(slot: Slot): void {
    const current = this.slots.get(slot.id);
    if (current && slot.version !== undefined && current.version !== slot.version) {
      throw new BookingError("Slot was modified by another request");
    }
    this.slots.set(slot.id, { ...slot, version: (current?.version ?? 0) + 1 });
  }

  addBooking(booking: Booking): void {
    this.bookings.set(booking.id, booking);
  }

  getBooking(bookingId: string): Booking | undefined {
    return this.bookings.get(bookingId);
  }

  updateBooking(booking: Booking): void {
    this.bookings.set(booking.id, booking);
  }

  getConfirmedBookingsForSlot(slotId: string): Booking[] {
    return Array.from(this.bookings.values()).filter(
      (b) => b.slotId === slotId && b.status === "confirmed"
    );
  }

  getTraineeBookings(traineeId: string): Booking[] {
    return Array.from(this.bookings.values()).filter(
      (b) => b.traineeId === traineeId && b.status === "confirmed"
    );
  }

  getTraineeBookingsForWeek(traineeId: string, weekStart: string): Booking[] {
    // Compute week end by adding 7 days to YYYY-MM-DD string (pure date math, no TZ)
    const [y, m, d] = weekStart.split("-").map(Number);
    const end = new Date(y, m - 1, d + 7);
    const weekEndStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    return Array.from(this.bookings.values()).filter((b) => {
      if (b.traineeId !== traineeId || b.status !== "confirmed") return false;
      const slot = this.slots.get(b.slotId);
      return slot && slot.date >= weekStart && slot.date < weekEndStr;
    });
  }

  getEditLog(traineeId: string, weekStart: string): EditLog | undefined {
    return this.editLogs.get(`${traineeId}:${weekStart}`);
  }

  incrementEditCount(traineeId: string, weekStart: string): void {
    const key = `${traineeId}:${weekStart}`;
    const existing = this.editLogs.get(key);
    if (existing) {
      existing.editCount++;
    } else {
      this.editLogs.set(key, {
        id: `edit-${Date.now()}`,
        traineeId,
        weekStart,
        editCount: 1,
      });
    }
  }

  getAllSlotsForDate(date: string): Slot[] {
    return Array.from(this.slots.values()).filter((s) => s.date === date);
  }

  getAllBookings(): Booking[] {
    return Array.from(this.bookings.values());
  }

  upsertSlot(slot: Slot): void {
    this.slots.set(slot.id, slot);
  }

  resetEditCount(traineeId: string, weekStart: string): void {
    this.editLogs.delete(`${traineeId}:${weekStart}`);
  }

  getRemindersDue(
    windowStartUtc: Date,
    windowEndUtc: Date
  ): Array<{ booking: Booking; slot: Slot }> {
    const startMs = windowStartUtc.getTime();
    const endMs = windowEndUtc.getTime();
    const out: Array<{ booking: Booking; slot: Slot }> = [];
    for (const b of this.bookings.values()) {
      if (b.status !== "confirmed" || b.reminderSentAt !== null) continue;
      const slot = this.slots.get(b.slotId);
      if (!slot) continue;
      const slotMs = israelSlotToUTC(slot.date, slot.startTime).getTime();
      if (slotMs >= startMs && slotMs < endMs) {
        out.push({ booking: { ...b }, slot: { ...slot } });
      }
    }
    return out;
  }

  markReminderSent(bookingId: string, sentAt: Date): void {
    const b = this.bookings.get(bookingId);
    if (!b) return;
    this.bookings.set(bookingId, { ...b, reminderSentAt: sentAt });
  }
}
