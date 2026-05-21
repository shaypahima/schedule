import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockBookingStore } from "@/lib/services/booking-store";
import { makeBookings, Bookings } from "@/lib/services/bookings";
import { MockNotificationService } from "@/lib/services/notification";
import { GoogleCalendarService } from "@/lib/services/google-calendar";

function makeSlot(id: string, date: string, time = "10:00", capacity = 2) {
  return {
    id,
    date,
    startTime: time,
    capacity,
    lockoutOverride: false,
    currentBookings: 0,
  };
}

describe("Bookings", () => {
  let store: MockBookingStore;
  let tx: Bookings;
  let notifier: MockNotificationService;
  let mockCalendar: GoogleCalendarService;

  beforeEach(() => {
    store = new MockBookingStore();
    notifier = new MockNotificationService();
    mockCalendar = {
      createEvent: vi.fn().mockResolvedValue({ id: "gcal-123", summary: "Test", start: new Date(), end: new Date() }),
      deleteEvent: vi.fn().mockResolvedValue(undefined),
      getFreeBusy: vi.fn().mockResolvedValue({ busy: [] }),
    };
    
    tx = makeBookings(store, mockCalendar, notifier);

    // Set time well before any slots (no lockout issues)
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    // Add slots for the week
    for (let i = 5; i <= 11; i++) {
      store.addSlot(makeSlot(`slot-${i}`, `2026-04-${String(i).padStart(2, "0")}`));
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("book", () => {
    it("succeeds and creates booking + calendar event", async () => {
      const result = await tx.book("t1", "slot-6", { traineeName: "Alice" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.booking.status).toBe("confirmed");
        expect(result.booking.traineeId).toBe("t1");
        expect(result.booking.slotId).toBe("slot-6");
      }
      expect(mockCalendar.createEvent).toHaveBeenCalled();
    });

    it("returns SLOT_FULL when slot at capacity", async () => {
      store.updateSlot({ ...store.getSlot("slot-6")!, currentBookings: 2 });
      const result = await tx.book("t1", "slot-6");
      expect(result).toEqual({ ok: false, error: "SLOT_FULL", message: "Slot is full" });
    });

    it("returns ALREADY_BOOKED for duplicate", async () => {
      await tx.book("t1", "slot-6");
      const result = await tx.book("t1", "slot-6");
      expect(result).toEqual({ ok: false, error: "ALREADY_BOOKED", message: "Already booked" });
    });

    it("returns NOT_FOUND for missing slot", async () => {
      const result = await tx.book("t1", "nonexistent");
      expect(result).toEqual({ ok: false, error: "NOT_FOUND", message: "Slot not found" });
    });

    it("returns WEEKLY_LIMIT after 2 bookings in same week", async () => {
      await tx.book("t1", "slot-6");
      await tx.book("t1", "slot-7");
      const result = await tx.book("t1", "slot-8");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("WEEKLY_LIMIT");
    });

    it("returns LOCKOUT when within 7 hours", async () => {
      // Slot at 2026-04-06 10:00 IDT = 07:00 UTC. Lockout from 00:00 UTC.
      vi.setSystemTime(new Date("2026-04-06T01:00:00Z"));
      const result = await tx.book("t1", "slot-6");
      expect(result).toMatchObject({ ok: false, error: "LOCKOUT" });
    });

    it("bypass=true skips lockout and weekly limit", async () => {
      vi.setSystemTime(new Date("2026-04-06T01:00:00Z"));
      await tx.book("t1", "slot-6", { bypass: true });
      await tx.book("t1", "slot-7", { bypass: true });
      const result = await tx.book("t1", "slot-8", { bypass: true });
      expect(result.ok).toBe(true);
    });

    it("rollback slot capacity on calendar failure", async () => {
      (mockCalendar.createEvent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Google API down"));
      const result = await tx.book("t1", "slot-6", { traineeName: "Alice" });
      expect(result).toMatchObject({ ok: false, error: "CALENDAR_FAILURE" });
      // Slot capacity should be rolled back
      expect(store.getSlot("slot-6")!.currentBookings).toBe(0);
    });

    it("isAutoBooked marks booking correctly", async () => {
      const result = await tx.book("t1", "slot-6", { isAutoBooked: true, bypass: true });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.booking.isAutoBooked).toBe(true);
    });
  });

  describe("cancel", () => {
    it("cancels booking and deletes calendar event", async () => {
      const bookResult = await tx.book("t1", "slot-6", { traineeName: "Alice" });
      if (!bookResult.ok) throw new Error("Setup failed");

      const result = await tx.cancel(bookResult.booking.id, "t1");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.booking.status).toBe("cancelled");
      expect(mockCalendar.deleteEvent).toHaveBeenCalled();
      expect(notifier.sent.length).toBe(1);
    });

    it("returns NOT_FOUND for missing booking", async () => {
      const result = await tx.cancel("nope", "t1");
      expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    });

    it("returns NOT_FOUND for wrong trainee", async () => {
      const bookResult = await tx.book("t1", "slot-6");
      if (!bookResult.ok) throw new Error("Setup failed");
      const result = await tx.cancel(bookResult.booking.id, "t2");
      expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    });

    it("returns EDIT_LIMIT after 3 cancels", async () => {
      for (let i = 6; i <= 8; i++) {
        const b = await tx.book("t1", `slot-${i}`);
        if (!b.ok) throw new Error("Setup failed");
        await tx.cancel(b.booking.id, "t1");
      }
      const b4 = await tx.book("t1", "slot-9");
      if (!b4.ok) throw new Error("Setup failed");
      const result = await tx.cancel(b4.booking.id, "t1");
      expect(result).toMatchObject({ ok: false, error: "EDIT_LIMIT" });
    });

    it("auto-booked cancel is exempt from edit limit", async () => {
      // Exhaust edit limit
      for (let i = 6; i <= 8; i++) {
        const b = await tx.book("t1", `slot-${i}`);
        if (!b.ok) throw new Error("Setup failed");
        await tx.cancel(b.booking.id, "t1");
      }

      // Auto-booked booking in store
      store.addBooking({
        id: "auto-1",
        slotId: "slot-9",
        traineeId: "t1",
        googleEventId: null,
        isAutoBooked: true,
        status: "confirmed",
        createdAt: new Date(),
        reminderSentAt: null,
      });
      store.updateSlot({ ...store.getSlot("slot-9")!, currentBookings: 1 });

      const result = await tx.cancel("auto-1", "t1");
      expect(result.ok).toBe(true);
    });
  });

  describe("reschedule", () => {
    it("cancels old and books new atomically", async () => {
      const b = await tx.book("t1", "slot-6");
      if (!b.ok) throw new Error("Setup failed");

      const result = await tx.reschedule(b.booking.id, "t1", "slot-7");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.booking.slotId).toBe("slot-7");
        expect(result.booking.status).toBe("confirmed");
      }
      // Old booking cancelled
      expect(store.getBooking(b.booking.id)!.status).toBe("cancelled");
      // Notification sent
      expect(notifier.sent.length).toBe(1);
      expect(notifier.sent[0].type).toBe("reschedule");
    });

    it("does NOT cancel old booking if new slot is full", async () => {
      store.updateSlot({ ...store.getSlot("slot-7")!, currentBookings: 2 });
      const b = await tx.book("t1", "slot-6");
      if (!b.ok) throw new Error("Setup failed");

      const result = await tx.reschedule(b.booking.id, "t1", "slot-7");
      expect(result).toMatchObject({ ok: false, error: "SLOT_FULL" });
      // Old booking should still be confirmed
      expect(store.getBooking(b.booking.id)!.status).toBe("confirmed");
      // Old slot capacity unchanged
      expect(store.getSlot("slot-6")!.currentBookings).toBe(1);
    });

    it("counts as 1 edit", async () => {
      const b = await tx.book("t1", "slot-6");
      if (!b.ok) throw new Error("Setup failed");

      await tx.reschedule(b.booking.id, "t1", "slot-7");
      
      expect(await tx.getRemainingEdits("t1", "2026-04-05")).toBe(2);
    });

    it("returns EDIT_LIMIT when exhausted", async () => {
      // Use up 3 edits
      for (let i = 6; i <= 8; i++) {
        const b = await tx.book("t1", `slot-${i}`);
        if (!b.ok) throw new Error("Setup failed");
        await tx.cancel(b.booking.id, "t1");
      }

      const b = await tx.book("t1", "slot-9");
      if (!b.ok) throw new Error("Setup failed");
      const result = await tx.reschedule(b.booking.id, "t1", "slot-10");
      expect(result).toMatchObject({ ok: false, error: "EDIT_LIMIT" });
      // Old booking still confirmed
      expect(store.getBooking(b.booking.id)!.status).toBe("confirmed");
    });

    it("rolls back if calendar fails for new event", async () => {
      const b = await tx.book("t1", "slot-6", { traineeName: "Alice" });
      if (!b.ok) throw new Error("Setup failed");

      // Calendar fails on second createEvent call (the reschedule's new event)
      (mockCalendar.createEvent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Google API down"));

      const result = await tx.reschedule(b.booking.id, "t1", "slot-7", { traineeName: "Alice" });
      expect(result).toMatchObject({ ok: false, error: "CALENDAR_FAILURE" });
      // Old booking still confirmed
      expect(store.getBooking(b.booking.id)!.status).toBe("confirmed");
      expect(store.getSlot("slot-6")!.currentBookings).toBe(1);
    });
  });

  describe("book without calendar (null)", () => {
    it("works when calendar is null", async () => {
      const txNoCalendar = makeBookings(store, null, notifier);
      const result = await txNoCalendar.book("t1", "slot-6", { traineeName: "Alice" });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.booking.googleEventId).toBeNull();
    });
  });
});
