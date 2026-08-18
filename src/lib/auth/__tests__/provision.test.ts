import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Profile } from "../profile-repo";

const mockLoadProfile = vi.fn();
const mockCreateProfile = vi.fn();
const mockSetProfileStatus = vi.fn();

vi.mock("../profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
  createProfile: (row: unknown) => mockCreateProfile(row),
  setProfileStatus: (id: string, status: string) => mockSetProfileStatus(id, status),
}));

import { loadOrProvisionProfile } from "../provision";

function profile(over: Partial<Profile> = {}): Profile {
  return {
    userId: "u1",
    email: "t1@example.com",
    phone: null,
    name: "Trainee",
    role: "trainee",
    status: "active",
    hasIntro: false,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("loadOrProvisionProfile", () => {
  beforeEach(() => {
    mockLoadProfile.mockReset();
    mockCreateProfile.mockReset();
    mockSetProfileStatus.mockReset();
    process.env.COACH_EMAIL = "coach@velofit.app";
  });

  it("returns the existing profile without provisioning a second one", async () => {
    mockLoadProfile.mockResolvedValue(profile());

    const result = await loadOrProvisionProfile({
      userId: "u1",
      email: "t1@example.com",
    });

    expect(result.userId).toBe("u1");
    expect(mockCreateProfile).not.toHaveBeenCalled();
  });

  it("lands a brand-new self-signup in pending, owing an intro", async () => {
    mockLoadProfile.mockResolvedValueOnce(null);
    mockCreateProfile.mockResolvedValue(profile({ role: "trainee" }));
    mockLoadProfile.mockResolvedValueOnce(profile({ status: "pending" }));

    const result = await loadOrProvisionProfile({
      userId: "u1",
      email: "newbie@example.com",
    });

    expect(mockCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ role: "trainee" }),
    );
    expect(mockSetProfileStatus).toHaveBeenCalledWith("u1", "pending");
    expect(result.status).toBe("pending");
  });

  it("provisions a COACH_EMAIL identity as an active coach, no approval queue", async () => {
    mockLoadProfile.mockResolvedValueOnce(null);
    mockCreateProfile.mockResolvedValue(
      profile({ role: "coach", email: "coach@velofit.app" }),
    );

    const result = await loadOrProvisionProfile({
      userId: "c1",
      email: "coach@velofit.app",
    });

    expect(mockCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ role: "coach" }),
    );
    expect(mockSetProfileStatus).not.toHaveBeenCalled();
    expect(result.role).toBe("coach");
  });

  it("lets COACH_EMAIL win over a stale trainee role in the database", async () => {
    mockLoadProfile.mockResolvedValue(
      profile({ role: "trainee", email: "coach@velofit.app" }),
    );

    const result = await loadOrProvisionProfile({
      userId: "c1",
      email: "coach@velofit.app",
    });

    expect(result.role).toBe("coach");
  });

  it("reads COACH_EMAIL as a comma-separated list", async () => {
    process.env.COACH_EMAIL = "first@velofit.app, second@velofit.app";
    mockLoadProfile.mockResolvedValue(
      profile({ role: "trainee", email: "second@velofit.app" }),
    );

    const result = await loadOrProvisionProfile({
      userId: "c2",
      email: "second@velofit.app",
    });

    expect(result.role).toBe("coach");
  });
});
