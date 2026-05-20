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
    it("allows first booking", async () => {
      await expect(limits.assertCanBook("t1", "2026-04-06")).resolves.not.toThrow();
    });

    it("allows second booking in same week", async () => {
      store.addBooking({
        id: "b1",
        slotId: "slot-6",
        traineeId: "t1",
        googleEventId: null,
        isAutoBooked: false,
        status: "confirmed",
        createdAt: new Date(),
        reminderSentAt: null,
      });
      store.updateSlot({ ...store.getSlot("slot-6")!, currentBookings: 1 });

      await expect(limits.assertCanBook("t1", "2026-04-07")).resolves.not.toThrow();
    });

    it("blocks third booking in same week", async () => {
      for (let i = 6; i <= 7; i++) {
        store.addBooking({
          id: `b${i}`,
          slotId: `slot-${i}`,
          traineeId: "t1",
          googleEventId: null,
          isAutoBooked: false,
          status: "confirmed",
          createdAt: new Date(),
          reminderSentAt: null,
        });
        store.updateSlot({ ...store.getSlot(`slot-${i}`)!, currentBookings: 1 });
      }

      await expect(limits.assertCanBook("t1", "2026-04-08")).rejects.toThrow(
        "Max 2 sessions per week"
      );
    });

    it("allows booking in a different week", async () => {
      for (let i = 6; i <= 7; i++) {
        store.addBooking({
          id: `b${i}`,
          slotId: `slot-${i}`,
          traineeId: "t1",
          googleEventId: null,
          isAutoBooked: false,
          status: "confirmed",
          createdAt: new Date(),
          reminderSentAt: null,
        });
      }

      store.addSlot({
        id: "slot-next",
        date: "2026-04-13",
        startTime: "10:00",
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });

      await expect(limits.assertCanBook("t1", "2026-04-13")).resolves.not.toThrow();
    });
  });

  describe("assertCanCancel", () => {
    it("allows first cancel", async () => {
      await expect(limits.assertCanCancel("t1", "2026-04-06")).resolves.not.toThrow();
    });

    it("allows 3 cancels in a week", async () => {
      await limits.trackEdit("t1", "2026-04-06");
      await limits.trackEdit("t1", "2026-04-07");
      await expect(limits.assertCanCancel("t1", "2026-04-08")).resolves.not.toThrow();
    });

    it("blocks 4th cancel in same week", async () => {
      await limits.trackEdit("t1", "2026-04-06");
      await limits.trackEdit("t1", "2026-04-07");
      await limits.trackEdit("t1", "2026-04-08");
      await expect(limits.assertCanCancel("t1", "2026-04-09")).rejects.toThrow(
        "Edit limit reached"
      );
    });

    it("exempts auto-booked cancels regardless of edit count", async () => {
      await limits.trackEdit("t1", "2026-04-06");
      await limits.trackEdit("t1", "2026-04-07");
      await limits.trackEdit("t1", "2026-04-08");
      await expect(
        limits.assertCanCancel("t1", "2026-04-09", true)
      ).resolves.not.toThrow();
    });
  });

  describe("assertCanReschedule", () => {
    it("checks edit limit", async () => {
      await limits.trackEdit("t1", "2026-04-06");
      await limits.trackEdit("t1", "2026-04-07");
      await limits.trackEdit("t1", "2026-04-08");
      await expect(limits.assertCanReschedule("t1", "2026-04-09")).rejects.toThrow(
        "Edit limit reached"
      );
    });

    it("exempts auto-booked", async () => {
      await limits.trackEdit("t1", "2026-04-06");
      await limits.trackEdit("t1", "2026-04-07");
      await limits.trackEdit("t1", "2026-04-08");
      await expect(
        limits.assertCanReschedule("t1", "2026-04-09", true)
      ).resolves.not.toThrow();
    });
  });

  describe("trackEdit", () => {
    it("increments edit count", async () => {
      await limits.trackEdit("t1", "2026-04-06");
      expect(await limits.getRemainingEdits("t1", "2026-04-05")).toBe(2);
    });

    it("skips increment for auto-booked", async () => {
      await limits.trackEdit("t1", "2026-04-06", true);
      expect(await limits.getRemainingEdits("t1", "2026-04-05")).toBe(3);
    });
  });

  describe("status", () => {
    it("returns initial status", async () => {
      const s = await limits.status("t1", "2026-04-06");
      expect(s).toEqual({
        bookingsUsed: 0,
        bookingsLeft: 2,
        editsUsed: 0,
        editsLeft: 3,
      });
    });

    it("reflects bookings and edits", async () => {
      store.addBooking({
        id: "b1",
        slotId: "slot-6",
        traineeId: "t1",
        googleEventId: null,
        isAutoBooked: false,
        status: "confirmed",
        createdAt: new Date(),
        reminderSentAt: null,
      });
      store.updateSlot({ ...store.getSlot("slot-6")!, currentBookings: 1 });
      await limits.trackEdit("t1", "2026-04-06");

      const s = await limits.status("t1", "2026-04-06");
      expect(s).toEqual({
        bookingsUsed: 1,
        bookingsLeft: 1,
        editsUsed: 1,
        editsLeft: 2,
      });
    });
  });

  describe("getRemainingEdits", () => {
    it("returns 3 with no edits", async () => {
      expect(await limits.getRemainingEdits("t1", "2026-04-05")).toBe(3);
    });

    it("decrements correctly", async () => {
      await limits.trackEdit("t1", "2026-04-06");
      await limits.trackEdit("t1", "2026-04-07");
      expect(await limits.getRemainingEdits("t1", "2026-04-05")).toBe(1);
    });
  });

  describe("edge case: cancel auto-booked then re-book manually", () => {
    it("auto-booked cancel does not consume edit, manual cancel does", async () => {
      // Cancel an auto-booked session — exempt
      await limits.trackEdit("t1", "2026-04-06", true);
      expect(await limits.getRemainingEdits("t1", "2026-04-05")).toBe(3);

      // Now cancel 3 manual sessions
      await limits.trackEdit("t1", "2026-04-07");
      await limits.trackEdit("t1", "2026-04-08");
      await limits.trackEdit("t1", "2026-04-09");

      // 4th manual cancel should be blocked
      await expect(limits.assertCanCancel("t1", "2026-04-10")).rejects.toThrow(
        "Edit limit reached"
      );
    });
  });
});
