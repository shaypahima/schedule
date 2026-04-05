import { describe, it, expect } from "vitest";
import { generateAvailableSlots, AvailableSlot } from "@/lib/services/slot-availability";
import { TimePeriod, Slot } from "@/lib/types";

// Helper: create a date in Asia/Jerusalem context (using ISO strings for clarity)
function d(dateStr: string, time: string): Date {
  // We use explicit UTC offsets for Israel (UTC+3 in summer, UTC+2 in winter)
  // April 2026 is summer time (IDT = UTC+3)
  return new Date(`${dateStr}T${time}:00+03:00`);
}

describe("generateAvailableSlots", () => {
  const DATE = "2026-04-05"; // Sunday

  describe("empty calendar (no busy periods)", () => {
    it("generates slots for every hour from 00:00 to 23:00", () => {
      const slots = generateAvailableSlots(DATE, [], []);
      // 24 hours in a day
      expect(slots.length).toBe(24);
      expect(slots[0].startTime).toBe("00:00");
      expect(slots[23].startTime).toBe("23:00");
    });

    it("each slot has default capacity of 2 and 0 bookings", () => {
      const slots = generateAvailableSlots(DATE, [], []);
      for (const slot of slots) {
        expect(slot.capacity).toBe(2);
        expect(slot.currentBookings).toBe(0);
        expect(slot.remainingCapacity).toBe(2);
      }
    });
  });

  describe("with busy periods", () => {
    it("excludes slots that overlap with busy periods", () => {
      const busy: TimePeriod[] = [
        { start: d(DATE, "10:00"), end: d(DATE, "11:00") }, // blocks 10:00 slot
      ];
      const slots = generateAvailableSlots(DATE, busy, []);
      const times = slots.map((s) => s.startTime);
      expect(times).not.toContain("10:00");
      expect(times).toContain("09:00");
      expect(times).toContain("11:00");
    });

    it("excludes slots partially overlapping a busy period", () => {
      const busy: TimePeriod[] = [
        { start: d(DATE, "10:30"), end: d(DATE, "11:30") }, // overlaps 10:00 and 11:00
      ];
      const slots = generateAvailableSlots(DATE, busy, []);
      const times = slots.map((s) => s.startTime);
      expect(times).not.toContain("10:00");
      expect(times).not.toContain("11:00");
      expect(times).toContain("09:00");
      expect(times).toContain("12:00");
    });

    it("handles a multi-hour busy block", () => {
      const busy: TimePeriod[] = [
        { start: d(DATE, "08:00"), end: d(DATE, "12:00") }, // blocks 8,9,10,11
      ];
      const slots = generateAvailableSlots(DATE, busy, []);
      const times = slots.map((s) => s.startTime);
      expect(times).not.toContain("08:00");
      expect(times).not.toContain("09:00");
      expect(times).not.toContain("10:00");
      expect(times).not.toContain("11:00");
      expect(times).toContain("07:00");
      expect(times).toContain("12:00");
    });

    it("handles fully booked day (busy all day)", () => {
      const busy: TimePeriod[] = [
        { start: d(DATE, "00:00"), end: d("2026-04-06", "00:00") },
      ];
      const slots = generateAvailableSlots(DATE, busy, []);
      expect(slots.length).toBe(0);
    });
  });

  describe("with existing bookings (capacity)", () => {
    it("reduces remaining capacity based on confirmed bookings", () => {
      const existingSlots: Slot[] = [
        {
          id: "slot-1",
          date: DATE,
          startTime: "10:00",
          capacity: 2,
          lockoutOverride: false,
          currentBookings: 1,
        },
      ];
      const slots = generateAvailableSlots(DATE, [], existingSlots);
      const slot10 = slots.find((s) => s.startTime === "10:00");
      expect(slot10).toBeDefined();
      expect(slot10!.remainingCapacity).toBe(1);
      expect(slot10!.currentBookings).toBe(1);
    });

    it("excludes slots that are at full capacity", () => {
      const existingSlots: Slot[] = [
        {
          id: "slot-1",
          date: DATE,
          startTime: "10:00",
          capacity: 2,
          lockoutOverride: false,
          currentBookings: 2,
        },
      ];
      const slots = generateAvailableSlots(DATE, [], existingSlots);
      const slot10 = slots.find((s) => s.startTime === "10:00");
      expect(slot10).toBeUndefined();
    });

    it("respects capacity override of 3", () => {
      const existingSlots: Slot[] = [
        {
          id: "slot-1",
          date: DATE,
          startTime: "10:00",
          capacity: 3,
          lockoutOverride: false,
          currentBookings: 2,
        },
      ];
      const slots = generateAvailableSlots(DATE, [], existingSlots);
      const slot10 = slots.find((s) => s.startTime === "10:00");
      expect(slot10).toBeDefined();
      expect(slot10!.remainingCapacity).toBe(1);
      expect(slot10!.capacity).toBe(3);
    });
  });

  describe("combined busy + bookings", () => {
    it("excludes busy slots AND full-capacity slots", () => {
      const busy: TimePeriod[] = [
        { start: d(DATE, "09:00"), end: d(DATE, "10:00") },
      ];
      const existingSlots: Slot[] = [
        {
          id: "slot-1",
          date: DATE,
          startTime: "14:00",
          capacity: 2,
          lockoutOverride: false,
          currentBookings: 2,
        },
      ];
      const slots = generateAvailableSlots(DATE, busy, existingSlots);
      const times = slots.map((s) => s.startTime);
      expect(times).not.toContain("09:00"); // busy
      expect(times).not.toContain("14:00"); // full
      expect(times).toContain("08:00");
      expect(times).toContain("15:00");
    });
  });

  describe("slot metadata", () => {
    it("returns correct date for all slots", () => {
      const slots = generateAvailableSlots(DATE, [], []);
      for (const slot of slots) {
        expect(slot.date).toBe(DATE);
      }
    });

    it("preserves slot ID from existing slots", () => {
      const existingSlots: Slot[] = [
        {
          id: "existing-id",
          date: DATE,
          startTime: "10:00",
          capacity: 2,
          lockoutOverride: false,
          currentBookings: 1,
        },
      ];
      const slots = generateAvailableSlots(DATE, [], existingSlots);
      const slot10 = slots.find((s) => s.startTime === "10:00");
      expect(slot10!.id).toBe("existing-id");
    });

    it("generates placeholder IDs for slots without existing records", () => {
      const slots = generateAvailableSlots(DATE, [], []);
      for (const slot of slots) {
        expect(slot.id).toBeDefined();
        expect(slot.id.length).toBeGreaterThan(0);
      }
    });
  });
});
