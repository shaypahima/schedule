import { describe, it, expect } from "vitest";
import { profileCompletion } from "../completion";
import { EMPTY_TRAINEE_PROFILE } from "@/lib/services/trainee-profile-repo";
import type { TraineeProfileFields } from "@/lib/services/trainee-profile-repo";

function profile(over: Partial<TraineeProfileFields> = {}): TraineeProfileFields {
  return { ...EMPTY_TRAINEE_PROFILE, ...over };
}

describe("profileCompletion", () => {
  it("counts a bare intro-only profile as incomplete", () => {
    const result = profileCompletion(
      profile({ phone: "+972501234567", introText: "משהו" }),
    );

    expect(result.complete).toBe(false);
    expect(result.filled).toBe(0);
    expect(result.missing.length).toBe(result.total);
  });

  it("ignores the intro fields — those were mandatory at signup", () => {
    // Only the optional half is what a nudge can ask for.
    const withIntro = profileCompletion(
      profile({ phone: "+972501234567", introText: "משהו" }),
    );
    const withoutIntro = profileCompletion(profile());

    expect(withIntro).toEqual(withoutIntro);
  });

  it("counts each optional field the trainee filled in", () => {
    const result = profileCompletion(profile({ goals: "כוח", weightKg: 72 }));

    expect(result.filled).toBe(2);
    expect(result.missing).not.toContain("goals");
    expect(result.missing).toContain("medical");
  });

  it("is complete once every optional field is filled", () => {
    const result = profileCompletion(
      profile({
        photoUrl: "https://example.com/p.jpg",
        dateOfBirth: "1990-05-01",
        heightCm: 175,
        weightKg: 72,
        goals: "כוח",
        medical: "אין",
      }),
    );

    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.percent).toBe(100);
  });

  it("treats whitespace as unfilled — a space is not an answer", () => {
    const result = profileCompletion(profile({ goals: "   " }));

    expect(result.filled).toBe(0);
  });

  it("reports progress as a rounded percentage", () => {
    const result = profileCompletion(profile({ goals: "כוח", weightKg: 72 }));

    expect(result.percent).toBe(Math.round((2 / result.total) * 100));
  });
});
