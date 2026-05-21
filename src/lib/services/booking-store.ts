import { Booking, Slot, EditLog, ChangeRequest } from "@/lib/types";
import { israelSlotToUTC } from "./israel-time";

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
  getRemindersDue(
    windowStartUtc: Date,
    windowEndUtc: Date
  ): Promise<Array<{ booking: Booking; slot: Slot }>> | Array<{ booking: Booking; slot: Slot }>;
  markReminderSent(bookingId: string, sentAt: Date): Promise<void> | void;

  // --- Phase 15: cancel-request flow ---
  createChangeRequest(input: {
    bookingId: string;
    requestedNewSlotId: string | null;
    reason: string;
  }): Promise<ChangeRequest> | ChangeRequest;
  getChangeRequest(id: string): Promise<ChangeRequest | undefined> | ChangeRequest | undefined;
  /** Returns the pending request for a booking, if any. */
  getPendingRequestForBooking(
    bookingId: string
  ): Promise<ChangeRequest | undefined> | ChangeRequest | undefined;
  listPendingRequests(): Promise<ChangeRequest[]> | ChangeRequest[];
  updateChangeRequest(
    id: string,
    patch: Partial<Pick<ChangeRequest, "status" | "decisionNote" | "decidedAt" | "decidedBy">>
  ): Promise<void> | void;
}

/** In-memory booking store for dev/testing. */
export class MockBookingStore implements BookingStore {
  private slots = new Map<string, Slot>();
  private bookings = new Map<string, Booking>();
  private editLogs = new Map<string, EditLog>();
  private changeRequests = new Map<string, ChangeRequest>();

  addSlot(slot: Slot): void {
    this.slots.set(slot.id, { ...slot, version: slot.version ?? 1 });
  }

  getSlot(slotId: string): Slot | undefined {
    const slot = this.slots.get(slotId);
    return slot ? { ...slot } : undefined;
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

  createChangeRequest(input: {
    bookingId: string;
    requestedNewSlotId: string | null;
    reason: string;
  }): ChangeRequest {
    // Enforce one pending per booking.
    const existing = this.getPendingRequestForBooking(input.bookingId);
    if (existing) {
      throw new BookingError("A pending request already exists for this booking");
    }
    const cr: ChangeRequest = {
      id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bookingId: input.bookingId,
      requestedNewSlotId: input.requestedNewSlotId,
      reason: input.reason,
      status: "pending",
      decisionNote: null,
      requestedAt: new Date(),
      decidedAt: null,
      decidedBy: null,
    };
    this.changeRequests.set(cr.id, cr);
    return { ...cr };
  }

  getChangeRequest(id: string): ChangeRequest | undefined {
    const c = this.changeRequests.get(id);
    return c ? { ...c } : undefined;
  }

  getPendingRequestForBooking(bookingId: string): ChangeRequest | undefined {
    for (const c of this.changeRequests.values()) {
      if (c.bookingId === bookingId && c.status === "pending") return { ...c };
    }
    return undefined;
  }

  listPendingRequests(): ChangeRequest[] {
    return Array.from(this.changeRequests.values())
      .filter((c) => c.status === "pending")
      .map((c) => ({ ...c }));
  }

  updateChangeRequest(
    id: string,
    patch: Partial<Pick<ChangeRequest, "status" | "decisionNote" | "decidedAt" | "decidedBy">>
  ): void {
    const c = this.changeRequests.get(id);
    if (!c) return;
    this.changeRequests.set(id, { ...c, ...patch });
  }
}

