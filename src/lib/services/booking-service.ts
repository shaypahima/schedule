import { Booking, Slot, EditLog } from "@/lib/types";
import { GoogleCalendarService } from "./google-calendar";

export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}

export interface BookingStore {
  getSlot(slotId: string): Slot | undefined;
  updateSlot(slot: Slot): void;
  addBooking(booking: Booking): void;
  getBooking(bookingId: string): Booking | undefined;
  updateBooking(booking: Booking): void;
  getConfirmedBookingsForSlot(slotId: string): Booking[];
  getTraineeBookings(traineeId: string): Booking[];
  getEditLog(traineeId: string, weekStart: string): EditLog | undefined;
  incrementEditCount(traineeId: string, weekStart: string): void;
}

const MAX_EDITS_PER_WEEK = 3;

/** Get the Sunday of the week containing the given date (YYYY-MM-DD) */
export function getWeekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d); // local date, no TZ issues
  const day = dt.getDay(); // 0=Sun
  dt.setDate(dt.getDate() - day);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export class BookingService {
  constructor(
    private store: BookingStore,
    private calendar?: GoogleCalendarService
  ) {}

  getRemainingEdits(traineeId: string, weekStart: string): number {
    const log = this.store.getEditLog(traineeId, weekStart);
    return MAX_EDITS_PER_WEEK - (log?.editCount || 0);
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

  async book(
    traineeId: string,
    slotId: string,
    traineeName?: string
  ): Promise<Booking> {
    const slot = this.store.getSlot(slotId);
    if (!slot) throw new BookingError("Slot not found");

    if (slot.currentBookings >= slot.capacity) {
      throw new BookingError("Slot is full");
    }

    // Check if trainee already has a confirmed booking for this slot
    const existing = this.store
      .getConfirmedBookingsForSlot(slotId)
      .find((b) => b.traineeId === traineeId);
    if (existing) throw new BookingError("Already booked");

    // Create Google Calendar event if calendar service available
    let googleEventId: string | null = null;
    if (this.calendar && traineeName) {
      const start = new Date(`${slot.date}T${slot.startTime}:00+03:00`);
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
    };

    this.store.addBooking(booking);
    this.store.updateSlot({
      ...slot,
      currentBookings: slot.currentBookings + 1,
    });

    return booking;
  }

  async cancel(bookingId: string, traineeId: string, skipEditLimit = false): Promise<void> {
    const booking = this.store.getBooking(bookingId);
    if (!booking || booking.status !== "confirmed") {
      throw new BookingError("Booking not found");
    }
    if (booking.traineeId !== traineeId) {
      throw new BookingError("Not your booking");
    }

    const slot = this.store.getSlot(booking.slotId);
    if (!slot) throw new BookingError("Slot not found");

    if (!skipEditLimit) {
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
    }
  }

  async reschedule(
    bookingId: string,
    traineeId: string,
    newSlotId: string,
    traineeName?: string
  ): Promise<Booking> {
    const oldBooking = this.store.getBooking(bookingId);
    if (!oldBooking || oldBooking.status !== "confirmed") {
      throw new BookingError("Booking not found");
    }
    const oldSlot = this.store.getSlot(oldBooking.slotId);
    if (!oldSlot) throw new BookingError("Slot not found");

    // Check edit limit once for the whole reschedule (counts as 1 edit)
    this.checkEditLimit(traineeId, oldSlot.date, oldBooking.isAutoBooked);

    // Cancel old booking (skip edit limit — we already checked)
    await this.cancel(bookingId, traineeId, true);

    // Book new slot
    const newBooking = await this.book(traineeId, newSlotId, traineeName);

    // Track as single edit
    this.trackEdit(traineeId, oldSlot.date, oldBooking.isAutoBooked);

    return newBooking;
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
    this.slots.set(slot.id, slot);
  }

  getSlot(slotId: string): Slot | undefined {
    return this.slots.get(slotId);
  }

  updateSlot(slot: Slot): void {
    this.slots.set(slot.id, slot);
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
}
