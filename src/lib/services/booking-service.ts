import { Booking, Slot } from "@/lib/types";
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
}

export class BookingService {
  constructor(
    private store: BookingStore,
    private calendar?: GoogleCalendarService
  ) {}

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

  async cancel(bookingId: string, traineeId: string): Promise<void> {
    const booking = this.store.getBooking(bookingId);
    if (!booking || booking.status !== "confirmed") {
      throw new BookingError("Booking not found");
    }
    if (booking.traineeId !== traineeId) {
      throw new BookingError("Not your booking");
    }

    const slot = this.store.getSlot(booking.slotId);
    if (!slot) throw new BookingError("Slot not found");

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
  }
}

/**
 * In-memory booking store for dev/testing
 */
export class MockBookingStore implements BookingStore {
  private slots = new Map<string, Slot>();
  private bookings = new Map<string, Booking>();

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
}
