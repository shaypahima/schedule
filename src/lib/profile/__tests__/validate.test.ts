import { describe, it, expect } from "vitest";
import { validateProfilePatch } from "../validate";

describe("validateProfilePatch", () => {
  it("accepts a patch that touches nothing", () => {
    expect(validateProfilePatch({})).toEqual({ ok: true, value: {} });
  });

  it("accepts sensible body data", () => {
    const patch = { heightCm: 175, weightKg: 72, goals: "לרוץ 10 ק\"מ" };

    expect(validateProfilePatch(patch)).toEqual({ ok: true, value: patch });
  });

  it("rejects a phone that is not E.164", () => {
    expect(validateProfilePatch({ phone: "0501234567" })).toEqual({
      ok: false,
      error: "PHONE_INVALID",
    });
  });

  it("rejects a height no human has", () => {
    expect(validateProfilePatch({ heightCm: 400 })).toEqual({
      ok: false,
      error: "HEIGHT_OUT_OF_RANGE",
    });
    expect(validateProfilePatch({ heightCm: 10 })).toEqual({
      ok: false,
      error: "HEIGHT_OUT_OF_RANGE",
    });
  });

  it("rejects a weight no human has", () => {
    expect(validateProfilePatch({ weightKg: 500 })).toEqual({
      ok: false,
      error: "WEIGHT_OUT_OF_RANGE",
    });
    expect(validateProfilePatch({ weightKg: 5 })).toEqual({
      ok: false,
      error: "WEIGHT_OUT_OF_RANGE",
    });
  });

  it("treats clearing a field as legitimate, not as an out-of-range value", () => {
    // null means "I no longer want this recorded" — distinct from a bad number.
    expect(validateProfilePatch({ heightCm: null, weightKg: null })).toEqual({
      ok: true,
      value: { heightCm: null, weightKg: null },
    });
  });

  it("accepts the boundaries themselves", () => {
    expect(validateProfilePatch({ heightCm: 50, weightKg: 20 }).ok).toBe(true);
    expect(validateProfilePatch({ heightCm: 250, weightKg: 400 }).ok).toBe(true);
  });
});
