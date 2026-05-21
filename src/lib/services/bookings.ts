import { Booking, Slot, ChangeRequest } from "@/lib/types";
import { BookingStore, BookingError } from "./booking-store";
import { GoogleCalendarService } from "./google-calendar";
import { NotificationService, NotificationPayload } from "./notification";
import { israelSlotToUTC, isLockedOut, weekStartForDate } from "./israel-time";

/**
 * Bookings — the single booking orchestrator.
 *
 * Collapses what used to be split across BookingService (exception-based)
 * + BookingTransaction (result-based) + WeeklyLimits (shallow wrapper).
 *
 * Per ADR-0005, the booking domain is about to grow (cancel-request flow,
 * no-show status, only-active-trainees-may-book). The verbs `decideRequest`
 * and `markNoShow` are stubbed on the interface from day 1 so Phase 15/16
 * just wire the data without changing the shape.
 */

export type BookingError_Code =
  | "SLOT_FULL"
  | "ALREADY_BOOKED"
  | "NOT_FOUND"
  | "LOCKOUT"
  | "EDIT_LIMIT"
  | "WEEKLY_LIMIT"
  | "CONFLICT"
  | "CALENDAR_FAILURE"
  | "ALREADY_REQUESTED"
  | "REQUEST_NOT_PENDING"
  | "REASON_REQUIRED"
  | "NOT_IMPLEMENTED";

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: BookingError_Code; message: string };

/** Result of decideRequest — what the coach approved/rejected. */
export type DecisionResult =
  | { ok: true; request: ChangeRequest; effectedBooking?: Booking }
  | { ok: false; error: BookingError_Code; message: string };

export type RequestResult =
  | { ok: true; request: ChangeRequest }
  | { ok: false; error: BookingError_Code; message: string };

export interface BookingOpts {
  bypass?: boolean;
  isAutoBooked?: boolean;
  traineeName?: string;
}

export interface Bookings {
  book(traineeId: string, slotId: string, opts?: BookingOpts): Promise<BookingResult>;
  cancel(bookingId: string, traineeId: string, opts?: { bypass?: boolean }): Promise<BookingResult>;
  reschedule(
    bookingId: string,
    traineeId: string,
    newSlotId: string,
    opts?: { traineeName?: string }
  ): Promise<BookingResult>;

  /** Phase 15: trainee submits a cancel/reschedule request when inside 24h. */
  requestCancel(
    bookingId: string,
    traineeId: string,
    reason: string
  ): Promise<RequestResult>;
  requestReschedule(
    bookingId: string,
    traineeId: string,
    newSlotId: string,
    reason: string
  ): Promise<RequestResult>;
  /** Phase 15: coach approves/rejects a pending request. */
  decideRequest(
    requestId: string,
    decidedBy: string,
    decision: "approve" | "reject",
    note?: string
  ): Promise<DecisionResult>;

  /** Phase 16 wires this once no_show status enum value lands. */
  markNoShow(bookingId: string): Promise<BookingResult>;

  // --- Limits (collapsed from WeeklyLimits) ---
  assertCanBook(traineeId: string, slotDate: string): Promise<void>;
  assertCanCancel(traineeId: string, slotDate: string, isAutoBooked?: boolean): Promise<void>;
  assertCanReschedule(traineeId: string, slotDate: string, isAutoBooked?: boolean): Promise<void>;
  trackEdit(traineeId: string, slotDate: string, isAutoBooked?: boolean): Promise<void>;
  getRemainingEdits(traineeId: string, weekStart: string): Promise<number>;
  status(
    traineeId: string,
    slotDate: string
  ): Promise<{ bookingsUsed: number; bookingsLeft: number; editsUsed: number; editsLeft: number }>;
}

const LOCKOUT_HOURS = 7;
const MAX_SESSIONS_PER_WEEK = 2;
const MAX_EDITS_PER_WEEK = 3;

export function makeBookings(
  store: BookingStore,
  calendar: GoogleCalendarService | null,
  notifier: NotificationService | null
): Bookings {
  // --- Internal helpers ---

  function checkLockout(slot: Slot): BookingError_Code | null {
    if (slot.lockoutOverride) return null;
    if (isLockedOut(slot.date, slot.startTime, LOCKOUT_HOURS)) return "LOCKOUT";
    return null;
  }

  async function editsUsed(traineeId: string, weekStart: string): Promise<number> {
    const log = await store.getEditLog(traineeId, weekStart);
    return log?.editCount ?? 0;
  }

  async function bookingsUsed(traineeId: string, weekStart: string): Promise<number> {
    const bookings = await store.getTraineeBookingsForWeek(traineeId, weekStart);
    return bookings.length;
  }

  async function checkBookingLimit(traineeId: string, slotDate: string): Promise<void> {
    const ws = weekStartForDate(slotDate);
    if ((await bookingsUsed(traineeId, ws)) >= MAX_SESSIONS_PER_WEEK) {
      throw new BookingError("Max 2 sessions per week");
    }
  }

  async function checkEditLimit(
    traineeId: string,
    slotDate: string,
    isAutoBooked?: boolean
  ): Promise<void> {
    if (isAutoBooked) return;
    const ws = weekStartForDate(slotDate);
    const remaining = MAX_EDITS_PER_WEEK - (await editsUsed(traineeId, ws));
    if (remaining <= 0) {
      throw new BookingError("Edit limit reached (3/week)");
    }
  }

  async function createCalendarEvent(
    slot: Slot,
    traineeName?: string
  ): Promise<string | null> {
    if (!calendar || !traineeName) return null;
    const start = israelSlotToUTC(slot.date, slot.startTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const event = await calendar.createEvent({ summary: traineeName, start, end });
    return event.id;
  }

  async function deleteCalendarEvent(eventId: string | null): Promise<void> {
    if (!calendar || !eventId) return;
    try {
      await calendar.deleteEvent(eventId);
    } catch {
      // event may already be gone
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

  // --- Verbs ---

  return {
    async book(traineeId, slotId, opts = {}) {
      let slot = await store.getSlot(slotId);

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

      if (!slot) return { ok: false, error: "NOT_FOUND", message: "Slot not found" };

      const resolvedSlotId = slot.id;

      if (!opts.bypass) {
        const lockout = checkLockout(slot);
        if (lockout) return { ok: false, error: lockout, message: "Cannot modify within 7 hours of session" };

        try {
          await checkBookingLimit(traineeId, slot.date);
        } catch (e) {
          return { ok: false, error: "WEEKLY_LIMIT", message: (e as Error).message };
        }
      }

      if (slot.currentBookings >= slot.capacity) {
        return { ok: false, error: "SLOT_FULL", message: "Slot is full" };
      }

      const existingBookings = await store.getConfirmedBookingsForSlot(resolvedSlotId);
      if (existingBookings.find((b) => b.traineeId === traineeId)) {
        return { ok: false, error: "ALREADY_BOOKED", message: "Already booked" };
      }

      try {
        await store.updateSlot({ ...slot, currentBookings: slot.currentBookings + 1 });
      } catch {
        return { ok: false, error: "CONFLICT", message: "Slot was modified by another request" };
      }

      let googleEventId: string | null = null;
      try {
        googleEventId = await createCalendarEvent(slot, opts.traineeName);
      } catch {
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
          await checkEditLimit(traineeId, slot.date, booking.isAutoBooked);
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

      if (!opts.bypass && !booking.isAutoBooked) {
        await store.incrementEditCount(traineeId, weekStartForDate(slot.date));
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
      const oldBooking = await store.getBooking(bookingId);
      if (!oldBooking || oldBooking.status !== "confirmed") {
        return { ok: false, error: "NOT_FOUND", message: "Booking not found" };
      }
      if (oldBooking.traineeId !== traineeId) {
        return { ok: false, error: "NOT_FOUND", message: "Not your booking" };
      }

      const oldSlot = await store.getSlot(oldBooking.slotId);
      if (!oldSlot) return { ok: false, error: "NOT_FOUND", message: "Slot not found" };

      const lockout = checkLockout(oldSlot);
      if (lockout) return { ok: false, error: lockout, message: "Cannot modify within 7 hours of session" };

      try {
        await checkEditLimit(traineeId, oldSlot.date, oldBooking.isAutoBooked);
      } catch (e) {
        return { ok: false, error: "EDIT_LIMIT", message: (e as Error).message };
      }

      const newSlot = await store.getSlot(newSlotId);
      if (!newSlot) return { ok: false, error: "NOT_FOUND", message: "New slot not found" };

      if (newSlot.currentBookings >= newSlot.capacity) {
        return { ok: false, error: "SLOT_FULL", message: "New slot is full" };
      }

      const newSlotBookings = await store.getConfirmedBookingsForSlot(newSlotId);
      if (newSlotBookings.find((b) => b.traineeId === traineeId)) {
        return { ok: false, error: "ALREADY_BOOKED", message: "Already booked in new slot" };
      }

      let newGoogleEventId: string | null = null;
      try {
        newGoogleEventId = await createCalendarEvent(newSlot, opts.traineeName);
      } catch {
        return { ok: false, error: "CALENDAR_FAILURE", message: "Failed to create calendar event" };
      }

      await deleteCalendarEvent(oldBooking.googleEventId);
      await store.updateBooking({ ...oldBooking, status: "cancelled" });
      await store.updateSlot({
        ...oldSlot,
        currentBookings: Math.max(0, oldSlot.currentBookings - 1),
      });

      try {
        await store.updateSlot({ ...newSlot, currentBookings: newSlot.currentBookings + 1 });
      } catch {
        await store.updateBooking({ ...oldBooking, status: "confirmed" });
        await store.updateSlot({ ...oldSlot, currentBookings: oldSlot.currentBookings });
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

      if (!oldBooking.isAutoBooked) {
        await store.incrementEditCount(traineeId, weekStartForDate(oldSlot.date));
      }

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

    async requestCancel(bookingId, traineeId, reason) {
      if (!reason || reason.trim().length === 0) {
        return { ok: false, error: "REASON_REQUIRED", message: "reason is required" };
      }
      const booking = await store.getBooking(bookingId);
      if (!booking || booking.status !== "confirmed") {
        return { ok: false, error: "NOT_FOUND", message: "Booking not found" };
      }
      if (booking.traineeId !== traineeId) {
        return { ok: false, error: "NOT_FOUND", message: "Not your booking" };
      }
      const existing = await store.getPendingRequestForBooking(bookingId);
      if (existing) {
        return { ok: false, error: "ALREADY_REQUESTED", message: "Request already pending for this booking" };
      }
      try {
        const request = await store.createChangeRequest({
          bookingId,
          requestedNewSlotId: null,
          reason: reason.trim(),
        });
        return { ok: true, request };
      } catch (e) {
        return { ok: false, error: "CONFLICT", message: (e as Error).message };
      }
    },

    async requestReschedule(bookingId, traineeId, newSlotId, reason) {
      if (!reason || reason.trim().length === 0) {
        return { ok: false, error: "REASON_REQUIRED", message: "reason is required" };
      }
      const booking = await store.getBooking(bookingId);
      if (!booking || booking.status !== "confirmed") {
        return { ok: false, error: "NOT_FOUND", message: "Booking not found" };
      }
      if (booking.traineeId !== traineeId) {
        return { ok: false, error: "NOT_FOUND", message: "Not your booking" };
      }
      const newSlot = await store.getSlot(newSlotId);
      if (!newSlot) {
        return { ok: false, error: "NOT_FOUND", message: "New slot not found" };
      }
      const existing = await store.getPendingRequestForBooking(bookingId);
      if (existing) {
        return { ok: false, error: "ALREADY_REQUESTED", message: "Request already pending for this booking" };
      }
      try {
        const request = await store.createChangeRequest({
          bookingId,
          requestedNewSlotId: newSlotId,
          reason: reason.trim(),
        });
        return { ok: true, request };
      } catch (e) {
        return { ok: false, error: "CONFLICT", message: (e as Error).message };
      }
    },

    async decideRequest(requestId, decidedBy, decision, note) {
      const request = await store.getChangeRequest(requestId);
      if (!request) return { ok: false, error: "NOT_FOUND", message: "Request not found" };
      if (request.status !== "pending") {
        return { ok: false, error: "REQUEST_NOT_PENDING", message: `status is ${request.status}` };
      }

      const booking = await store.getBooking(request.bookingId);
      if (!booking) return { ok: false, error: "NOT_FOUND", message: "Booking not found" };

      const decidedAt = new Date();
      const statusValue: "approved" | "rejected" =
        decision === "approve" ? "approved" : "rejected";

      // Reject path: stamp the request, leave the booking alone.
      if (decision === "reject") {
        await store.updateChangeRequest(requestId, {
          status: statusValue,
          decisionNote: note ?? null,
          decidedAt,
          decidedBy,
        });
        const updated = await store.getChangeRequest(requestId);
        return { ok: true, request: updated! };
      }

      // Approve path: cancel the old booking. If reschedule, book the new slot too.
      const oldSlot = await store.getSlot(booking.slotId);
      if (!oldSlot) return { ok: false, error: "NOT_FOUND", message: "Slot not found" };

      await deleteCalendarEvent(booking.googleEventId);
      await store.updateBooking({ ...booking, status: "cancelled" });
      await store.updateSlot({
        ...oldSlot,
        currentBookings: Math.max(0, oldSlot.currentBookings - 1),
      });

      let effectedBooking: Booking | undefined;
      if (request.requestedNewSlotId) {
        // Reschedule — book the new slot under the coach's authority (bypass limits).
        const r = await this.book(booking.traineeId, request.requestedNewSlotId, {
          bypass: true,
          isAutoBooked: booking.isAutoBooked,
        });
        if (r.ok) effectedBooking = r.booking;
      }

      await store.updateChangeRequest(requestId, {
        status: statusValue,
        decisionNote: note ?? null,
        decidedAt,
        decidedBy,
      });

      await notify({
        type: "cancel",
        traineeName: booking.traineeId,
        slotDate: oldSlot.date,
        slotTime: oldSlot.startTime,
      });

      const updated = await store.getChangeRequest(requestId);
      return { ok: true, request: updated!, effectedBooking };
    },

    async markNoShow(bookingId) {
      const booking = await store.getBooking(bookingId);
      if (!booking || booking.status !== "confirmed") {
        return { ok: false, error: "NOT_FOUND", message: "Booking not found or not confirmed" };
      }
      const slot = await store.getSlot(booking.slotId);
      if (!slot) return { ok: false, error: "NOT_FOUND", message: "Slot not found" };

      // Coach can only mark past slots as no-show.
      const slotStartMs = israelSlotToUTC(slot.date, slot.startTime).getTime();
      if (slotStartMs > Date.now()) {
        return {
          ok: false,
          error: "CONFLICT",
          message: "Cannot mark a future slot as no-show",
        };
      }

      await store.updateBooking({ ...booking, status: "no_show" });
      return { ok: true, booking: { ...booking, status: "no_show" } };
    },

    // --- Limits ---

    async assertCanBook(traineeId, slotDate) {
      await checkBookingLimit(traineeId, slotDate);
    },

    async assertCanCancel(traineeId, slotDate, isAutoBooked) {
      await checkEditLimit(traineeId, slotDate, isAutoBooked);
    },

    async assertCanReschedule(traineeId, slotDate, isAutoBooked) {
      await checkEditLimit(traineeId, slotDate, isAutoBooked);
    },

    async trackEdit(traineeId, slotDate, isAutoBooked) {
      if (isAutoBooked) return;
      await store.incrementEditCount(traineeId, weekStartForDate(slotDate));
    },

    async getRemainingEdits(traineeId, weekStart) {
      return MAX_EDITS_PER_WEEK - (await editsUsed(traineeId, weekStart));
    },

    async status(traineeId, slotDate) {
      const ws = weekStartForDate(slotDate);
      const bu = await bookingsUsed(traineeId, ws);
      const eu = await editsUsed(traineeId, ws);
      return {
        bookingsUsed: bu,
        bookingsLeft: Math.max(0, MAX_SESSIONS_PER_WEEK - bu),
        editsUsed: eu,
        editsLeft: Math.max(0, MAX_EDITS_PER_WEEK - eu),
      };
    },
  };
}
