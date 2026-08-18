import { describe, it, expect } from "vitest";
import { withPastFlag } from "../roster-view";
import type { RosterEntry } from "../read-model";

function entry(startsAt: string): RosterEntry {
  return {
    bookingId: `b-${startsAt}`,
    slotId: "s1",
    startsAt,
    slotDate: startsAt.slice(0, 10),
    slotTime: "10:00",
    trainee: { id: "t1", name: "Trainee" },
    status: "confirmed",
    isAutoBooked: false,
  };
}

const NOON = Date.parse("2026-08-18T12:00:00Z");

describe("withPastFlag", () => {
  it("marks a session that has already started as past", () => {
    const [row] = withPastFlag([entry("2026-08-18T09:00:00Z")], NOON);

    expect(row.isPast).toBe(true);
  });

  it("leaves a session later today alone — no-show cannot be judged yet", () => {
    const [row] = withPastFlag([entry("2026-08-18T18:00:00Z")], NOON);

    expect(row.isPast).toBe(false);
  });

  it("keeps every other field untouched", () => {
    const original = entry("2026-08-18T09:00:00Z");

    const [row] = withPastFlag([original], NOON);

    expect(row).toEqual({ ...original, isPast: true });
  });
});
