import { describe, it, expect } from "vitest";
import { upcomingDays } from "../day-strip";

describe("upcomingDays", () => {
  it("starts on the given day and runs forward", () => {
    // 2026-08-18 is a Tuesday.
    const days = upcomingDays("2026-08-18", 3);

    expect(days.map((d) => d.date)).toEqual([
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
    ]);
  });

  it("labels each day in Hebrew", () => {
    const days = upcomingDays("2026-08-18", 3);

    expect(days.map((d) => d.label)).toEqual(["שלישי", "רביעי", "חמישי"]);
  });

  it("rolls over Saturday into Sunday and across the month boundary", () => {
    const days = upcomingDays("2026-08-30", 3);

    expect(days).toEqual([
      { date: "2026-08-30", label: "ראשון", dayOfMonth: 30 },
      { date: "2026-08-31", label: "שני", dayOfMonth: 31 },
      { date: "2026-09-01", label: "שלישי", dayOfMonth: 1 },
    ]);
  });

  it("covers a week when asked for one", () => {
    expect(upcomingDays("2026-08-22", 7).map((d) => d.label)).toEqual([
      "שבת",
      "ראשון",
      "שני",
      "שלישי",
      "רביעי",
      "חמישי",
      "שישי",
    ]);
  });
});
