import { Booking, Slot } from "@/lib/types";
import { BookingStore } from "./booking-service";
import { GoogleCalendarService } from "./google-calendar";
import { NotificationService, NotificationPayload } from "./notification";
import { WeeklyLimits } from "./weekly-limits";
import { israelSlotToUTC, isLockedOut } from "./israel-time";

export type ErrorCode =
  | "SLOT_FULL"
  | "ALREADY_BOOKED"
  | "NOT_FOUND"
  | "LOCKOUT"
  | "EDIT_LIMIT"
  | "WEEKLY_LIMIT"
  | "CONFLICT"
  | "CALENDAR_FAILURE";

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: ErrorCode; message: string };

export interface BookingTransactionOpts {
  bypass?: boolean;
  isAutoBooked?: boolean;
  traineeName?: string;
}

export interface BookingTransaction {
  book(
    traineeId: string,
    slotId: string,
    opts?: BookingTransactionOpts
  ): Promise<BookingResult>;

  cancel(
    bookingId: string,
    traineeId: string,
    opts?: { bypass?: boolean }
  ): Promise<BookingResult>;

  reschedule(
    bookingId: string,
    traineeId: string,
    newSlotId: string,
    opts?: { traineeName?: string }
  ): Promise<BookingResult>;
}

const LOCKOUT_HOURS = 7;

export function createBookingTransaction(
  store: BookingStore,
  limits: WeeklyLimits,
  calendar: GoogleCalendarService | null,
  notifier: NotificationService | null
): BookingTransaction {
  function checkLockout(slot: Slot): ErrorCode | null {
    if (slot.lockoutOverride) return null;
    if (isLockedOut(slot.date, slot.startTime, LOCKOUT_HOURS)) return "LOCKOUT";
    return null;
  }

  async function createCalendarEvent(
    slot: Slot,
    traineeName?: string
  ): Promise<string | null> {
    if (!calendar || !traineeName) return null;
    const start = israelSlotToUTC(slot.date, slot.startTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const event = await calendar.createEvent({
      summary: traineeName,
      start,
      end,
    });
    return event.id;
  }

  async function deleteCalendarEvent(eventId: string | null): Promise<void> {
    if (!calendar || !eventId) return;
    try {
      await calendar.deleteEvent(eventId);
    } catch {
      // Calendar event may already be deleted
    }
  }

  async function notify(payload: NotificationPayload): Promise<void> {
    if (!notifier) return;
    try {
      await notifier.notifyCoach(payload);
    } catch {
      // fire-and-forget
    }
  }

  return {
    async book(traineeId, slotId, opts = {}) {
      let slot = await store.getSlot(slotId);

      // Auto-create slot from "new-YYYY-MM-DD-HH:mm" placeholder IDs
      if (!slot && slotId.startsWith("new-")) {
        const match = slotId.match(/^new-(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2})$/);
        if (match) {
          slot = {
            id: crypto.randomUUID(),
            date: match[1],
            startTime: match[2],
            capacity: 2,
            lockoutOverride: false,
            currentBookings: 0,
          };
          await store.upsertSlot(slot);
        }
      }

      if (!slot) return { ok: false, error: "NOT_FOUND", message: "Slot not found" } as const;

      // Use the resolved slot ID (may differ from input for auto-created slots)
      const resolvedSlotId = slot.id;

      if (!opts.bypass) {
        const lockout = checkLockout(slot);
        if (lockout) return { ok: false, error: lockout, message: "Cannot modify within 7 hours of session" };

        try {
          await limits.assertCanBook(traineeId, slot.date);
        } catch (e) {
          return { ok: false, error: "WEEKLY_LIMIT", message: (e as Error).message };
        }
      }

      if (slot.currentBookings >= slot.capacity) {
        return { ok: false, error: "SLOT_FULL", message: "Slot is full" };
      }

      const existingBookings = await store.getConfirmedBookingsForSlot(resolvedSlotId);
      const existing = existingBookings.find((b) => b.traineeId === traineeId);
      if (existing) {
        return { ok: false, error: "ALREADY_BOOKED", message: "Already booked" };
      }

      // Optimistic lock: increment slot bookings
      try {
        await store.updateSlot({
          ...slot,
          currentBookings: slot.currentBookings + 1,
        });
      } catch {
        return { ok: false, error: "CONFLICT", message: "Slot was modified by another request" };
      }

      // Create calendar event — rollback slot on failure
      let googleEventId: string | null = null;
      try {
        googleEventId = await createCalendarEvent(slot, opts.traineeName);
      } catch {
        // Rollback slot capacity
        const fresh = await store.getSlot(resolvedSlotId);
        if (fresh) {
          await store.updateSlot({
            ...fresh,
            currentBookings: Math.max(0, fresh.currentBookings - 1),
          });
        }
        return { ok: false, error: "CALENDAR_FAILURE", message: "Failed to create calendar event" };
      }

      const booking: Booking = {
        id: crypto.randomUUID(),
        slotId: resolvedSlotId,
        traineeId,
        googleEventId,
        isAutoBooked: opts.isAutoBooked ?? false,
        status: "confirmed",
        createdAt: new Date(),
        reminderSentAt: null,
      };

      await store.addBooking(booking);
      return { ok: true, booking };
    },

    async cancel(bookingId, traineeId, opts = {}) {
      const booking = await store.getBooking(bookingId);
      if (!booking || booking.status !== "confirmed") {
        return { ok: false, error: "NOT_FOUND", message: "Booking not found" };
      }

      const slot = await store.getSlot(booking.slotId);
      if (!slot) return { ok: false, error: "NOT_FOUND", message: "Slot not found" };

      if (!opts.bypass) {
        if (booking.traineeId !== traineeId) {
          return { ok: false, error: "NOT_FOUND", message: "Not your booking" };
        }

        const lockout = checkLockout(slot);
        if (lockout) return { ok: false, error: lockout, message: "Cannot modify within 7 hours of session" };

        try {
          await limits.assertCanCancel(traineeId, slot.date, booking.isAutoBooked);
        } catch (e) {
          return { ok: false, error: "EDIT_LIMIT", message: (e as Error).message };
        }
      }

      await deleteCalendarEvent(booking.googleEventId);

      await store.updateBooking({ ...booking, status: "cancelled" });
      await store.updateSlot({
        ...slot,
        currentBookings: Math.max(0, slot.currentBookings - 1),
      });

      if (!opts.bypass) {
        await limits.trackEdit(traineeId, slot.date, booking.isAutoBooked);
      }

      await notify({
        type: "cancel",
        traineeName: traineeId,
        slotDate: slot.date,
        slotTime: slot.startTime,
      });

      return { ok: true, booking: { ...booking, status: "cancelled" } };
    },

    async reschedule(bookingId, traineeId, newSlotId, opts = {}) {
      // Validate old booking
      const oldBooking = await store.getBooking(bookingId);
      if (!oldBooking || oldBooking.status !== "confirmed") {
        return { ok: false, error: "NOT_FOUND", message: "Booking not found" };
      }
      if (oldBooking.traineeId !== traineeId) {
        return { ok: false, error: "NOT_FOUND", message: "Not your booking" };
      }

      const oldSlot = await store.getSlot(oldBooking.slotId);
      if (!oldSlot) return { ok: false, error: "NOT_FOUND", message: "Slot not found" };

      // Check lockout + edit limit on old slot BEFORE touching anything
      const lockout = checkLockout(oldSlot);
      if (lockout) return { ok: false, error: lockout, message: "Cannot modify within 7 hours of session" };

      try {
        await limits.assertCanReschedule(traineeId, oldSlot.date, oldBooking.isAutoBooked);
      } catch (e) {
        return { ok: false, error: "EDIT_LIMIT", message: (e as Error).message };
      }

      // Validate new slot BEFORE modifying old booking
      const newSlot = await store.getSlot(newSlotId);
      if (!newSlot) return { ok: false, error: "NOT_FOUND", message: "New slot not found" };

      if (newSlot.currentBookings >= newSlot.capacity) {
        return { ok: false, error: "SLOT_FULL", message: "New slot is full" };
      }

      const newSlotBookings = await store.getConfirmedBookingsForSlot(newSlotId);
      const alreadyBooked = newSlotBookings.find((b) => b.traineeId === traineeId);
      if (alreadyBooked) {
        return { ok: false, error: "ALREADY_BOOKED", message: "Already booked in new slot" };
      }

      // All checks passed — now modify atomically

      // 1. Create new calendar event first (fail fast)
      let newGoogleEventId: string | null = null;
      try {
        newGoogleEventId = await createCalendarEvent(
          newSlot,
          opts.traineeName
        );
      } catch {
        return { ok: false, error: "CALENDAR_FAILURE", message: "Failed to create calendar event" };
      }

      // 2. Cancel old booking
      await deleteCalendarEvent(oldBooking.googleEventId);
      await store.updateBooking({ ...oldBooking, status: "cancelled" });
      await store.updateSlot({
        ...oldSlot,
        currentBookings: Math.max(0, oldSlot.currentBookings - 1),
      });

      // 3. Book new slot
      try {
        await store.updateSlot({
          ...newSlot,
          currentBookings: newSlot.currentBookings + 1,
        });
      } catch {
        // Rollback: restore old booking
        await store.updateBooking({ ...oldBooking, status: "confirmed" });
        await store.updateSlot({
          ...oldSlot,
          currentBookings: oldSlot.currentBookings,
        });
        // Delete new calendar event
        await deleteCalendarEvent(newGoogleEventId);
        return { ok: false, error: "CONFLICT", message: "New slot was modified by another request" };
      }

      const newBooking: Booking = {
        id: crypto.randomUUID(),
        slotId: newSlotId,
        traineeId,
        googleEventId: newGoogleEventId,
        isAutoBooked: oldBooking.isAutoBooked,
        status: "confirmed",
        createdAt: new Date(),
        reminderSentAt: null,
      };

      await store.addBooking(newBooking);

      // Track as single edit
      await limits.trackEdit(traineeId, oldSlot.date, oldBooking.isAutoBooked);

      await notify({
        type: "reschedule",
        traineeName: traineeId,
        slotDate: oldSlot.date,
        slotTime: oldSlot.startTime,
        newSlotDate: newSlot.date,
        newSlotTime: newSlot.startTime,
      });

      return { ok: true, booking: newBooking };
    },
  };
}
