import { describe, it, expect, beforeEach } from "vitest";
import {
  MockProgressStore,
  MeasurementValidationError,
  validateMeasurementInput,
} from "@/lib/services/progress-store";

describe("MockProgressStore — measurements", () => {
  let store: MockProgressStore;
  beforeEach(() => {
    store = new MockProgressStore();
  });

  it("creates a measurement with just a weight", async () => {
    const m = await store.createMeasurement("t1", { weightKg: 72.5 });
    expect(m).toMatchObject({ traineeId: "t1", weightKg: 72.5, photoUrl: null });
    expect(m.id).toMatch(/^ml-/);
    expect(m.loggedAt).toBeInstanceOf(Date);
  });

  it("rejects an empty payload", async () => {
    await expect(store.createMeasurement("t1", {})).rejects.toThrow(
      MeasurementValidationError
    );
  });

  it("rejects implausible weight (negative or > 500kg)", async () => {
    await expect(
      store.createMeasurement("t1", { weightKg: -10 })
    ).rejects.toMatchObject({ code: "INVALID_WEIGHT" });
    await expect(
      store.createMeasurement("t1", { weightKg: 600 })
    ).rejects.toMatchObject({ code: "INVALID_WEIGHT" });
  });

  it("accepts a row with only metrics", async () => {
    const m = await store.createMeasurement("t1", {
      metrics: { energy: 4, soreness: 2 },
    });
    expect(m.metrics).toEqual({ energy: 4, soreness: 2 });
  });

  it("accepts a row with only a photo", async () => {
    const m = await store.createMeasurement("t1", {
      photoUrl: "https://example.com/p.jpg",
    });
    expect(m.photoUrl).toBe("https://example.com/p.jpg");
  });

  it("rejects whitespace-only note as empty", async () => {
    await expect(
      store.createMeasurement("t1", { note: "   " })
    ).rejects.toMatchObject({ code: "EMPTY_PAYLOAD" });
  });

  it("trims notes on insert", async () => {
    const m = await store.createMeasurement("t1", { note: "  felt strong  " });
    expect(m.note).toBe("felt strong");
  });

  it("lists newest first; per-trainee scoped", async () => {
    await store.createMeasurement("t1", {
      weightKg: 70,
      loggedAt: new Date("2026-01-01"),
    });
    await store.createMeasurement("t1", {
      weightKg: 71,
      loggedAt: new Date("2026-02-01"),
    });
    await store.createMeasurement("t2", { weightKg: 99 });

    const list = await store.listMeasurements("t1");
    expect(list).toHaveLength(2);
    expect(list[0].weightKg).toBe(71);
    expect(list[1].weightKg).toBe(70);
  });

  it("respects sinceDays filter", async () => {
    const longAgo = new Date(Date.now() - 200 * 86_400_000);
    await store.createMeasurement("t1", { weightKg: 65, loggedAt: longAgo });
    await store.createMeasurement("t1", { weightKg: 66 });

    const last90 = await store.listMeasurements("t1", { sinceDays: 90 });
    expect(last90).toHaveLength(1);
    expect(last90[0].weightKg).toBe(66);
  });

  it("getLastMeasurement returns the newest", async () => {
    await store.createMeasurement("t1", {
      weightKg: 70,
      loggedAt: new Date("2026-01-01"),
    });
    await store.createMeasurement("t1", {
      weightKg: 71,
      loggedAt: new Date("2026-02-01"),
    });
    const last = await store.getLastMeasurement("t1");
    expect(last?.weightKg).toBe(71);
  });
});

describe("MockProgressStore — session logs", () => {
  let store: MockProgressStore;
  beforeEach(() => {
    store = new MockProgressStore();
  });

  it("upsert creates then updates idempotently", async () => {
    const a = await store.upsertSessionLog("b1", {
      feedback: { energy: 3 },
    });
    expect(a.feedback).toEqual({ energy: 3 });

    const b = await store.upsertSessionLog("b1", {
      feedback: { energy: 5, free_text: "great" },
    });
    expect(b.feedback).toEqual({ energy: 5, free_text: "great" });
    expect(b.createdAt).toEqual(a.createdAt);
    expect(b.updatedAt.getTime()).toBeGreaterThanOrEqual(a.updatedAt.getTime());
  });

  it("partial update preserves other fields", async () => {
    await store.upsertSessionLog("b1", { feedback: { energy: 4 } });
    await store.upsertSessionLog("b1", { coachNotes: "good form on squats" });

    const r = await store.getSessionLog("b1");
    expect(r?.feedback).toEqual({ energy: 4 });
    expect(r?.coachNotes).toBe("good form on squats");
  });

  it("getSessionLog returns undefined for unknown booking", async () => {
    expect(await store.getSessionLog("ghost")).toBeUndefined();
  });
});

describe("validateMeasurementInput — guard", () => {
  it("treats empty metrics object as empty", () => {
    expect(() => validateMeasurementInput({ metrics: {} })).toThrow();
  });

  it("treats empty photoUrl string as empty", () => {
    expect(() => validateMeasurementInput({ photoUrl: "" })).toThrow();
  });

  it("accepts zero-decimal weight", () => {
    expect(() => validateMeasurementInput({ weightKg: 72 })).not.toThrow();
  });
});
