import { describe, it, expect } from "vitest";
import { isInsideCancelWindow, CANCEL_WINDOW_HOURS } from "../cancel-window";

// 10:00 Israel time on 2026-08-18 is 07:00 UTC (IDT, UTC+3).
const SLOT = { date: "2026-08-18", startTime: "10:00" };
const SLOT_START_UTC = Date.parse("2026-08-18T07:00:00Z");
const HOUR = 3_600_000;

describe("isInsideCancelWindow", () => {
  it("is 24 hours wide", () => {
    expect(CANCEL_WINDOW_HOURS).toBe(24);
  });

  it("leaves a cancel two days out free of the coach", () => {
    const now = SLOT_START_UTC - 48 * HOUR;

    expect(isInsideCancelWindow(SLOT.date, SLOT.startTime, now)).toBe(false);
  });

  it("puts a same-morning cancel inside the window", () => {
    const now = SLOT_START_UTC - 2 * HOUR;

    expect(isInsideCancelWindow(SLOT.date, SLOT.startTime, now)).toBe(true);
  });

  it("treats exactly 24 hours before as still outside — the window has not opened", () => {
    const now = SLOT_START_UTC - 24 * HOUR;

    expect(isInsideCancelWindow(SLOT.date, SLOT.startTime, now)).toBe(false);
  });

  it("opens the window a minute later", () => {
    const now = SLOT_START_UTC - 24 * HOUR + 60_000;

    expect(isInsideCancelWindow(SLOT.date, SLOT.startTime, now)).toBe(true);
  });

  it("keeps a slot already under way inside the window", () => {
    const now = SLOT_START_UTC + HOUR;

    expect(isInsideCancelWindow(SLOT.date, SLOT.startTime, now)).toBe(true);
  });
});
