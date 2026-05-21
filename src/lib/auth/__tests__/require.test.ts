import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("../profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
}));

import {
  requireCoach,
  requireActiveTrainee,
  requirePendingTrainee,
  requireAuthenticated,
} from "../require";
import type { Profile } from "../require";

const coachProfile: Profile = {
  userId: "c1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

function makeReq() {
  return new NextRequest("http://localhost/api/admin/bookings", {
    headers: { authorization: "Bearer jwt" },
  });
}

const traineeProfile: Profile = {
  userId: "t1",
  email: "t1@example.com",
  phone: null,
  name: "Trainee",
  role: "trainee",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

async function bodyOf(r: { error: import("next/server").NextResponse }): Promise<{ error: string }> {
  return (await r.error.json()) as { error: string };
}

describe("requireCoach", () => {
  beforeEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns coach profile for authenticated coach", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coachProfile);

    const r = await requireCoach(makeReq());

    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.coach).toEqual(coachProfile);
    }
  });

  it("rejects trainee with 403 FORBIDDEN_ROLE", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);

    const r = await requireCoach(makeReq());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect(r.error.status).toBe(403);
      expect((await bodyOf(r)).error).toBe("FORBIDDEN_ROLE");
    }
  });

  it("rejects request without JWT with 401 UNAUTHENTICATED", async () => {
    mockJwtSession.mockResolvedValue(null);

    const r = await requireCoach(makeReq());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect(r.error.status).toBe(401);
      expect((await bodyOf(r)).error).toBe("UNAUTHENTICATED");
    }
  });

  it("rejects JWT without matching profile with 401 PROFILE_NOT_FOUND", async () => {
    mockJwtSession.mockResolvedValue({ userId: "ghost", email: "ghost@example.com" });
    mockLoadProfile.mockResolvedValue(null);

    const r = await requireCoach(makeReq());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect(r.error.status).toBe(401);
      expect((await bodyOf(r)).error).toBe("PROFILE_NOT_FOUND");
    }
  });
});

describe("requireActiveTrainee", () => {
  beforeEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns trainee profile for active trainee", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);

    const r = await requireActiveTrainee(makeReq());

    expect("error" in r).toBe(false);
    if (!("error" in r)) expect(r.trainee).toEqual(traineeProfile);
  });

  it("rejects coach with 403 FORBIDDEN_ROLE", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coachProfile);

    const r = await requireActiveTrainee(makeReq());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect(r.error.status).toBe(403);
      expect((await bodyOf(r)).error).toBe("FORBIDDEN_ROLE");
    }
  });

  it("rejects pending trainee with 403 FORBIDDEN_STATUS", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue({ ...traineeProfile, status: "pending" });

    const r = await requireActiveTrainee(makeReq());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect(r.error.status).toBe(403);
      expect((await bodyOf(r)).error).toBe("FORBIDDEN_STATUS");
    }
  });

  it("rejects rejected trainee with 403 FORBIDDEN_STATUS", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue({ ...traineeProfile, status: "rejected" });

    const r = await requireActiveTrainee(makeReq());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect((await bodyOf(r)).error).toBe("FORBIDDEN_STATUS");
    }
  });

  it("rejects deactivated trainee with 403 FORBIDDEN_STATUS", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue({ ...traineeProfile, status: "deactivated" });

    const r = await requireActiveTrainee(makeReq());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect((await bodyOf(r)).error).toBe("FORBIDDEN_STATUS");
    }
  });
});

describe("requirePendingTrainee", () => {
  beforeEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns trainee profile for pending trainee", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue({ ...traineeProfile, status: "pending" });

    const r = await requirePendingTrainee(makeReq());

    expect("error" in r).toBe(false);
    if (!("error" in r)) expect(r.trainee.status).toBe("pending");
  });

  it("rejects active trainee with 403 FORBIDDEN_STATUS (already approved)", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);

    const r = await requirePendingTrainee(makeReq());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect((await bodyOf(r)).error).toBe("FORBIDDEN_STATUS");
    }
  });

  it("rejects coach with 403 FORBIDDEN_ROLE", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coachProfile);

    const r = await requirePendingTrainee(makeReq());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect((await bodyOf(r)).error).toBe("FORBIDDEN_ROLE");
    }
  });
});

describe("requireAuthenticated", () => {
  beforeEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns profile for any status (pending OK)", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue({ ...traineeProfile, status: "pending" });

    const r = await requireAuthenticated(makeReq());

    expect("error" in r).toBe(false);
    if (!("error" in r)) expect(r.profile.status).toBe("pending");
  });

  it("returns profile for rejected user (terminal screen reads it)", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue({ ...traineeProfile, status: "rejected" });

    const r = await requireAuthenticated(makeReq());

    expect("error" in r).toBe(false);
    if (!("error" in r)) expect(r.profile.status).toBe("rejected");
  });

  it("rejects unauthenticated", async () => {
    mockJwtSession.mockResolvedValue(null);

    const r = await requireAuthenticated(makeReq());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect((await bodyOf(r)).error).toBe("UNAUTHENTICATED");
    }
  });
});
