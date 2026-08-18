import { describe, it, expect } from "vitest";
import { bookingFailureMessage } from "../booking-copy";

describe("bookingFailureMessage", () => {
  it("explains each gate in its own words", () => {
    const messages = (
      ["LOCKOUT", "WEEKLY_LIMIT", "SLOT_FULL", "ALREADY_BOOKED"] as const
    ).map(bookingFailureMessage);

    // Every gate a trainee can hit reads differently — "couldn't book" tells
    // them nothing about what to do next.
    expect(new Set(messages).size).toBe(4);
    for (const m of messages) expect(m.length).toBeGreaterThan(0);
  });

  it("names the 7-hour lockout so the trainee knows it is about timing", () => {
    expect(bookingFailureMessage("LOCKOUT")).toContain("7");
  });

  it("names the weekly cap so the trainee knows it is about quota", () => {
    expect(bookingFailureMessage("WEEKLY_LIMIT")).toContain("שבוע");
  });

  it("falls back to something sayable for an unexpected failure", () => {
    expect(bookingFailureMessage("CALENDAR_FAILURE")).toBeTruthy();
    expect(bookingFailureMessage("NOT_IMPLEMENTED")).toBeTruthy();
  });
});
