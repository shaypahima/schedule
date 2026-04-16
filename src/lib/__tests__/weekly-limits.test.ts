import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockBookingStore } from "@/lib/services/booking-service";
import { createWeeklyLimits, WeeklyLimits } from "@/lib/services/weekly-limits";

describe("WeeklyLimits", () => {
  let store: MockBookingStore;
  let limits: WeeklyLimits;

  beforeEach(() => {
    store = new MockBookingStore();
    limits = createWeeklyLimits(store);
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    // Add slots for the week of 2026-04-05 (Sunday) through 2026-04-11
    for (let i = 5; i <= 11; i++) {
      store.addSlot({
        id: `slot-${i}`,
        date: `2026-04-${String(i).padStart(2, "0")}`,
        startTime: "10:00",
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("assertCanBook", () => {
    it("allows first booking", () => {
      expect(() => limits.assertCanBook("t1", "2026-04-06")).not.toThrow();
    });

    it("allows second booking in same week", () => {
      // Add one confirmed booking
      store.addBooking({
        id: "b1",
        slotId: "slot-6",
        traineeId: "t1",
        googleEventId: null,
        isAutoBooked: false,
        status: "confirmed",
        createdAt: new Date(),
      });
      store.updateSlot({ ...store.getSlot("slot-6")!, currentBookings: 1 });

      expect(() => limits.assertCanBook("t1", "2026-04-07")).not.toThrow();
    });

    it("blocks third booking in same week", () => {
      for (let i = 6; i <= 7; i++) {
        store.addBooking({
          id: `b${i}`,
          slotId: `slot-${i}`,
          traineeId: "t1",
          googleEventId: null,
          isAutoBooked: false,
          status: "confirmed",
          createdAt: new Date(),
        });
        store.updateSlot({ ...store.getSlot(`slot-${i}`)!, currentBookings: 1 });
      }

      expect(() => limits.assertCanBook("t1", "2026-04-08")).toThrow(
        "Max 2 sessions per week"
      );
    });

    it("allows booking in a different week", () => {
      for (let i = 6; i <= 7; i++) {
        store.addBooking({
          id: `b${i}`,
          slotId: `slot-${i}`,
          traineeId: "t1",
          googleEventId: null,
          isAutoBooked: false,
          status: "confirmed",
          createdAt: new Date(),
        });
      }

      // Next week slot
      store.addSlot({
        id: "slot-next",
        date: "2026-04-13",
        startTime: "10:00",
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });

      expect(() => limits.assertCanBook("t1", "2026-04-13")).not.toThrow();
    });
  });

  describe("assertCanCancel", () => {
    it("allows first cancel", () => {
      expect(() => limits.assertCanCancel("t1", "2026-04-06")).not.toThrow();
    });

    it("allows 3 cancels in a week", () => {
      limits.trackEdit("t1", "2026-04-06");
      limits.trackEdit("t1", "2026-04-07");
      expect(() => limits.assertCanCancel("t1", "2026-04-08")).not.toThrow();
    });

    it("blocks 4th cancel in same week", () => {
      limits.trackEdit("t1", "2026-04-06");
      limits.trackEdit("t1", "2026-04-07");
      limits.trackEdit("t1", "2026-04-08");
      expect(() => limits.assertCanCancel("t1", "2026-04-09")).toThrow(
        "Edit limit reached"
      );
    });

    it("exempts auto-booked cancels regardless of edit count", () => {
      limits.trackEdit("t1", "2026-04-06");
      limits.trackEdit("t1", "2026-04-07");
      limits.trackEdit("t1", "2026-04-08");
      // Would normally throw, but auto-booked is exempt
      expect(() =>
        limits.assertCanCancel("t1", "2026-04-09", true)
      ).not.toThrow();
    });
  });

  describe("assertCanReschedule", () => {
    it("checks edit limit", () => {
      limits.trackEdit("t1", "2026-04-06");
      limits.trackEdit("t1", "2026-04-07");
      limits.trackEdit("t1", "2026-04-08");
      expect(() => limits.assertCanReschedule("t1", "2026-04-09")).toThrow(
        "Edit limit reached"
      );
    });

    it("exempts auto-booked", () => {
      limits.trackEdit("t1", "2026-04-06");
      limits.trackEdit("t1", "2026-04-07");
      limits.trackEdit("t1", "2026-04-08");
      expect(() =>
        limits.assertCanReschedule("t1", "2026-04-09", true)
      ).not.toThrow();
    });
  });

  describe("trackEdit", () => {
    it("increments edit count", () => {
      limits.trackEdit("t1", "2026-04-06");
      expect(limits.getRemainingEdits("t1", "2026-04-05")).toBe(2);
    });

    it("skips increment for auto-booked", () => {
      limits.trackEdit("t1", "2026-04-06", true);
      expect(limits.getRemainingEdits("t1", "2026-04-05")).toBe(3);
    });
  });

  describe("status", () => {
    it("returns initial status", () => {
      const s = limits.status("t1", "2026-04-06");
      expect(s).toEqual({
        bookingsUsed: 0,
        bookingsLeft: 2,
        editsUsed: 0,
        editsLeft: 3,
      });
    });

    it("reflects bookings and edits", () => {
      store.addBooking({
        id: "b1",
        slotId: "slot-6",
        traineeId: "t1",
        googleEventId: null,
        isAutoBooked: false,
        status: "confirmed",
        createdAt: new Date(),
      });
      store.updateSlot({ ...store.getSlot("slot-6")!, currentBookings: 1 });
      limits.trackEdit("t1", "2026-04-06");

      const s = limits.status("t1", "2026-04-06");
      expect(s).toEqual({
        bookingsUsed: 1,
        bookingsLeft: 1,
        editsUsed: 1,
        editsLeft: 2,
      });
    });
  });

  describe("getRemainingEdits", () => {
    it("returns 3 with no edits", () => {
      expect(limits.getRemainingEdits("t1", "2026-04-05")).toBe(3);
    });

    it("decrements correctly", () => {
      limits.trackEdit("t1", "2026-04-06");
      limits.trackEdit("t1", "2026-04-07");
      expect(limits.getRemainingEdits("t1", "2026-04-05")).toBe(1);
    });
  });

  describe("edge case: cancel auto-booked then re-book manually", () => {
    it("auto-booked cancel does not consume edit, manual cancel does", () => {
      // Cancel an auto-booked session — exempt
      limits.trackEdit("t1", "2026-04-06", true);
      expect(limits.getRemainingEdits("t1", "2026-04-05")).toBe(3);

      // Now cancel 3 manual sessions
      limits.trackEdit("t1", "2026-04-07");
      limits.trackEdit("t1", "2026-04-08");
      limits.trackEdit("t1", "2026-04-09");

      // 4th manual cancel should be blocked
      expect(() => limits.assertCanCancel("t1", "2026-04-10")).toThrow(
        "Edit limit reached"
      );
    });
  });
});
