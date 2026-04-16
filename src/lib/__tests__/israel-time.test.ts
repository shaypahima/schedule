import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ISRAEL_TZ,
  todayIL,
  israelSlotToUTC,
  weekStartForDate,
  isLockedOut,
} from "@/lib/services/israel-time";

describe("israel-time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("ISRAEL_TZ", () => {
    it("is Asia/Jerusalem", () => {
      expect(ISRAEL_TZ).toBe("Asia/Jerusalem");
    });
  });

  describe("todayIL", () => {
    it("returns correct date in Israel time", () => {
      // 2026-04-15 01:00 UTC → 2026-04-15 04:00 IDT (summer, UTC+3)
      vi.setSystemTime(new Date("2026-04-15T01:00:00Z"));
      expect(todayIL()).toBe("2026-04-15");
    });

    it("handles day boundary — late UTC is next day in Israel", () => {
      // 2026-04-14 22:00 UTC → 2026-04-15 01:00 IDT
      vi.setSystemTime(new Date("2026-04-14T22:00:00Z"));
      expect(todayIL()).toBe("2026-04-15");
    });

    it("handles winter time (IST = UTC+2)", () => {
      // 2026-01-15 23:00 UTC → 2026-01-16 01:00 IST
      vi.setSystemTime(new Date("2026-01-15T23:00:00Z"));
      expect(todayIL()).toBe("2026-01-16");
    });
  });

  describe("israelSlotToUTC", () => {
    it("converts summer slot (IDT = UTC+3) correctly", () => {
      const utc = israelSlotToUTC("2026-07-15", "10:00");
      // 10:00 IDT = 07:00 UTC
      expect(utc.toISOString()).toBe("2026-07-15T07:00:00.000Z");
    });

    it("converts winter slot (IST = UTC+2) correctly", () => {
      const utc = israelSlotToUTC("2026-01-15", "10:00");
      // 10:00 IST = 08:00 UTC
      expect(utc.toISOString()).toBe("2026-01-15T08:00:00.000Z");
    });

    it("handles midnight in Israel", () => {
      const utc = israelSlotToUTC("2026-07-15", "00:00");
      // 00:00 IDT = 21:00 UTC previous day
      expect(utc.toISOString()).toBe("2026-07-14T21:00:00.000Z");
    });

    it("handles DST spring-forward boundary (last Friday of March)", () => {
      // Israel springs forward on 2026-03-27 at 02:00
      // Before: IST (UTC+2). After: IDT (UTC+3).
      const beforeDST = israelSlotToUTC("2026-03-26", "10:00");
      expect(beforeDST.toISOString()).toBe("2026-03-26T08:00:00.000Z"); // UTC+2

      const afterDST = israelSlotToUTC("2026-03-28", "10:00");
      expect(afterDST.toISOString()).toBe("2026-03-28T07:00:00.000Z"); // UTC+3
    });
  });

  describe("weekStartForDate", () => {
    it("returns Sunday for a Wednesday", () => {
      // 2026-04-15 is Wednesday → Sunday is 2026-04-12
      expect(weekStartForDate("2026-04-15")).toBe("2026-04-12");
    });

    it("returns same day for a Sunday", () => {
      expect(weekStartForDate("2026-04-12")).toBe("2026-04-12");
    });

    it("returns Sunday for a Saturday", () => {
      // 2026-04-18 is Saturday → Sunday is 2026-04-12
      expect(weekStartForDate("2026-04-18")).toBe("2026-04-12");
    });

    it("handles month boundary", () => {
      // 2026-05-01 is Friday → Sunday is 2026-04-26
      expect(weekStartForDate("2026-05-01")).toBe("2026-04-26");
    });

    it("handles year boundary", () => {
      // 2026-01-01 is Thursday → Sunday is 2025-12-28
      expect(weekStartForDate("2026-01-01")).toBe("2025-12-28");
    });
  });

  describe("isLockedOut", () => {
    it("returns false when well before lockout", () => {
      // Slot at 2026-04-20 10:00 IDT = 07:00 UTC
      // Lockout starts 7h before = 03:00 IDT = 00:00 UTC
      // Now = 2026-04-19 12:00 UTC (way before)
      vi.setSystemTime(new Date("2026-04-19T12:00:00Z"));
      expect(isLockedOut("2026-04-20", "10:00")).toBe(false);
    });

    it("returns true when within lockout window", () => {
      // Slot at 2026-04-20 10:00 IDT = 07:00 UTC
      // Lockout = 7h before = 00:00 UTC on 2026-04-20
      // Now = 2026-04-20 01:00 UTC (within window)
      vi.setSystemTime(new Date("2026-04-20T01:00:00Z"));
      expect(isLockedOut("2026-04-20", "10:00")).toBe(true);
    });

    it("returns true when slot is in the past", () => {
      vi.setSystemTime(new Date("2026-04-21T00:00:00Z"));
      expect(isLockedOut("2026-04-20", "10:00")).toBe(true);
    });

    it("respects custom lockout hours", () => {
      // Slot at 10:00 IDT = 07:00 UTC. 3h lockout = 04:00 UTC
      vi.setSystemTime(new Date("2026-04-20T03:00:00Z"));
      expect(isLockedOut("2026-04-20", "10:00", 3)).toBe(false);

      vi.setSystemTime(new Date("2026-04-20T05:00:00Z"));
      expect(isLockedOut("2026-04-20", "10:00", 3)).toBe(true);
    });

    it("handles winter time lockout correctly", () => {
      // Winter: 10:00 IST = 08:00 UTC. 7h lockout = 01:00 UTC
      vi.setSystemTime(new Date("2026-01-15T00:30:00Z"));
      expect(isLockedOut("2026-01-15", "10:00")).toBe(false);

      vi.setSystemTime(new Date("2026-01-15T01:30:00Z"));
      expect(isLockedOut("2026-01-15", "10:00")).toBe(true);
    });
  });
});
