import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Profile } from "@/lib/auth/profile-repo";

const mockLoadProfile = vi.fn();
const mockSetProfileStatus = vi.fn();

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
  setProfileStatus: (id: string, status: string) => mockSetProfileStatus(id, status),
}));

import { approveTrainee, rejectTrainee } from "../approvals";

function profile(over: Partial<Profile> = {}): Profile {
  return {
    userId: "t1",
    email: "t1@example.com",
    phone: "+972501234567",
    name: "Trainee",
    role: "trainee",
    status: "pending",
    hasIntro: true,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("approveTrainee", () => {
  beforeEach(() => {
    mockLoadProfile.mockReset();
    mockSetProfileStatus.mockReset();
  });

  it("makes a reviewed self-signup active", async () => {
    mockLoadProfile.mockResolvedValue(profile());

    expect(await approveTrainee("t1")).toEqual({ ok: true });
    expect(mockSetProfileStatus).toHaveBeenCalledWith("t1", "active");
  });

  it("refuses someone who never wrote an intro — there is nothing to judge", async () => {
    mockLoadProfile.mockResolvedValue(profile({ hasIntro: false }));

    expect(await approveTrainee("t1")).toEqual({ ok: false, error: "INTRO_MISSING" });
    expect(mockSetProfileStatus).not.toHaveBeenCalled();
  });

  it("refuses to re-approve someone already active", async () => {
    mockLoadProfile.mockResolvedValue(profile({ status: "active" }));

    expect(await approveTrainee("t1")).toEqual({ ok: false, error: "NOT_PENDING" });
    expect(mockSetProfileStatus).not.toHaveBeenCalled();
  });

  it("refuses a profile that is not a trainee", async () => {
    mockLoadProfile.mockResolvedValue(profile({ role: "coach" }));

    expect(await approveTrainee("c1")).toEqual({ ok: false, error: "NOT_A_TRAINEE" });
  });

  it("reports an unknown profile rather than inventing one", async () => {
    mockLoadProfile.mockResolvedValue(null);

    expect(await approveTrainee("nobody")).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});

describe("rejectTrainee", () => {
  beforeEach(() => {
    mockLoadProfile.mockReset();
    mockSetProfileStatus.mockReset();
  });

  it("marks a pending self-signup rejected", async () => {
    mockLoadProfile.mockResolvedValue(profile());

    expect(await rejectTrainee("t1")).toEqual({ ok: true });
    expect(mockSetProfileStatus).toHaveBeenCalledWith("t1", "rejected");
  });

  it("rejects without an intro — the coach may refuse on the email alone", async () => {
    mockLoadProfile.mockResolvedValue(profile({ hasIntro: false }));

    expect(await rejectTrainee("t1")).toEqual({ ok: true });
  });

  it("refuses to reject an already-active trainee — that is deactivation", async () => {
    mockLoadProfile.mockResolvedValue(profile({ status: "active" }));

    expect(await rejectTrainee("t1")).toEqual({ ok: false, error: "NOT_PENDING" });
    expect(mockSetProfileStatus).not.toHaveBeenCalled();
  });
});
