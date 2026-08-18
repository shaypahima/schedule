import { describe, it, expect } from "vitest";
import { photoTimeline, pickComparePair } from "../photo-timeline";
import type { MeasurementLog } from "@/lib/types";

function log(over: Partial<MeasurementLog> & { id: string }): MeasurementLog {
  return {
    traineeId: "t1",
    loggedAt: new Date("2026-01-01T00:00:00Z"),
    weightKg: null,
    metrics: null,
    photoUrl: null,
    note: null,
    ...over,
  };
}

describe("photoTimeline", () => {
  it("keeps only the entries that actually carry a photo", () => {
    const timeline = photoTimeline([
      log({ id: "a", photoUrl: "a.jpg" }),
      log({ id: "b" }),
      log({ id: "c", photoUrl: "c.jpg" }),
    ]);

    expect(timeline.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("runs oldest first, so the story reads forward", () => {
    const timeline = photoTimeline([
      log({ id: "new", photoUrl: "n.jpg", loggedAt: new Date("2026-06-01Z") }),
      log({ id: "old", photoUrl: "o.jpg", loggedAt: new Date("2026-01-01Z") }),
    ]);

    expect(timeline.map((p) => p.id)).toEqual(["old", "new"]);
  });

  it("carries the weight alongside the photo when one was logged", () => {
    const [entry] = photoTimeline([log({ id: "a", photoUrl: "a.jpg", weightKg: 72 })]);

    expect(entry.weightKg).toBe(72);
  });
});

describe("pickComparePair", () => {
  const photos = photoTimeline([
    log({ id: "a", photoUrl: "a.jpg", loggedAt: new Date("2026-01-01Z") }),
    log({ id: "b", photoUrl: "b.jpg", loggedAt: new Date("2026-03-01Z") }),
    log({ id: "c", photoUrl: "c.jpg", loggedAt: new Date("2026-06-01Z") }),
  ]);

  it("defaults to the widest span — first against last", () => {
    const pair = pickComparePair(photos);

    expect([pair.before?.id, pair.after?.id]).toEqual(["a", "c"]);
  });

  it("honours an explicit choice", () => {
    const pair = pickComparePair(photos, "b", "c");

    expect([pair.before?.id, pair.after?.id]).toEqual(["b", "c"]);
  });

  it("falls back to the default when an id is unknown", () => {
    const pair = pickComparePair(photos, "ghost", "c");

    expect(pair.before?.id).toBe("a");
  });

  it("has nothing to compare with a single photo", () => {
    const one = photoTimeline([log({ id: "only", photoUrl: "o.jpg" })]);

    const pair = pickComparePair(one);

    expect(pair.before?.id).toBe("only");
    expect(pair.after?.id).toBe("only");
    expect(pair.comparable).toBe(false);
  });

  it("has nothing to compare with no photos at all", () => {
    const pair = pickComparePair([]);

    expect(pair.before).toBeNull();
    expect(pair.after).toBeNull();
    expect(pair.comparable).toBe(false);
  });
});
