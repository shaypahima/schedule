import { describe, it, expect } from "vitest";
import { validateIntro } from "../intro";

describe("validateIntro", () => {
  it("accepts an E.164 phone with a real message", () => {
    expect(
      validateIntro({
        phone: "+972501234567",
        introText: "אני רוצה להתאמן כדי לחזור לכושר",
      }),
    ).toEqual({
      ok: true,
      value: {
        phone: "+972501234567",
        introText: "אני רוצה להתאמן כדי לחזור לכושר",
      },
    });
  });

  it("rejects a phone that is not E.164", () => {
    expect(
      validateIntro({ phone: "050-123-4567", introText: "a long enough message" }),
    ).toEqual({ ok: false, error: "PHONE_INVALID" });
  });

  it("rejects an intro too short to tell the coach anything", () => {
    expect(validateIntro({ phone: "+972501234567", introText: "היי" })).toEqual({
      ok: false,
      error: "INTRO_TOO_SHORT",
    });
  });

  it("trims the message before judging its length", () => {
    expect(
      validateIntro({ phone: "+972501234567", introText: "   short   " }),
    ).toEqual({ ok: false, error: "INTRO_TOO_SHORT" });
  });

  it("rejects a missing phone", () => {
    expect(
      validateIntro({ phone: undefined, introText: "a long enough message" }),
    ).toEqual({ ok: false, error: "PHONE_INVALID" });
  });
});
