import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();
vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));
vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
}));

process.env.MOCK_SERVICES = "true";

import { GET } from "../route";
import { getContainer, resetContainer } from "@/lib/services";
import type { Profile } from "@/lib/auth/profile-repo";

const activeTrainee: Profile = {
  userId: "u1",
  email: "u1@example.com",
  phone: null,
  name: "Trainee",
  role: "trainee",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const coach: Profile = {
  userId: "c1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const pendingTrainee: Profile = {
  ...activeTrainee,
  userId: "p1",
  email: "p1@example.com",
  status: "pending",
};

function makeRequest(date?: string, authHeader?: string) {
  const url = `http://localhost/api/slots${date ? `?date=${date}` : ""}`;
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return new NextRequest(url, { headers });
}

describe("GET /api/slots", () => {
  beforeEach(() => {
    resetContainer();
    vi.setSystemTime(new Date("2026-05-20T06:00:00Z"));
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
    vi.useRealTimers();
  });

  it("returns 401 without a JWT", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await GET(makeRequest("2026-05-20"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when JWT is valid but no profile row exists", async () => {
    mockJwtSession.mockResolvedValue({ userId: "ghost", email: "ghost@example.com" });
    mockLoadProfile.mockResolvedValue(null);

    const res = await GET(makeRequest("2026-05-20", "Bearer jwt"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("PROFILE_NOT_FOUND");
  });

  it("returns 400 when date param is missing or malformed", async () => {
    mockJwtSession.mockResolvedValue({ userId: "u1", email: "u1@example.com" });
    mockLoadProfile.mockResolvedValue(activeTrainee);
    expect((await GET(makeRequest(undefined, "Bearer jwt"))).status).toBe(400);
    expect((await GET(makeRequest("bad-date", "Bearer jwt"))).status).toBe(400);
  });

  it("returns slots for the given date when JWT is valid", async () => {
    mockJwtSession.mockResolvedValue({ userId: "u1", email: "u1@example.com" });
    mockLoadProfile.mockResolvedValue(activeTrainee);

    const { store } = getContainer();
    store.upsertSlot({
      id: "slot-a",
      date: "2026-05-24", // Sunday
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    store.upsertSlot({
      id: "slot-b",
      date: "2026-05-24",
      startTime: "11:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 1,
    });

    const res = await GET(makeRequest("2026-05-24", "Bearer jwt"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe("2026-05-24");
    expect(Array.isArray(body.slots)).toBe(true);
    const ten = body.slots.find((s: { startTime: string }) => s.startTime === "10:00");
    const eleven = body.slots.find((s: { startTime: string }) => s.startTime === "11:00");
    expect(ten?.remainingCapacity).toBe(2);
    expect(eleven?.remainingCapacity).toBe(1);
  });

  it("allows a coach to view slots (read-only)", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);

    const res = await GET(makeRequest("2026-05-24", "Bearer jwt"));
    expect(res.status).toBe(200);
  });

  it("allows a coach regardless of profile.status (coach is always coach)", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c2", email: "coach2@example.com" });
    mockLoadProfile.mockResolvedValue({
      ...coach,
      userId: "c2",
      email: "coach2@example.com",
      // Coach with an unusual status — must still pass; coach role wins.
      status: "deactivated",
    });

    const res = await GET(makeRequest("2026-05-24", "Bearer jwt"));
    expect(res.status).toBe(200);
  });

  it("returns 403 for a pending trainee", async () => {
    mockJwtSession.mockResolvedValue({ userId: "p1", email: "p1@example.com" });
    mockLoadProfile.mockResolvedValue(pendingTrainee);

    const res = await GET(makeRequest("2026-05-24", "Bearer jwt"));
    expect(res.status).toBe(403);
  });

  it("returns 403 for a deactivated trainee (coach revoked access)", async () => {
    mockJwtSession.mockResolvedValue({ userId: "d1", email: "d1@example.com" });
    mockLoadProfile.mockResolvedValue({
      ...activeTrainee,
      userId: "d1",
      email: "d1@example.com",
      status: "deactivated",
    });

    const res = await GET(makeRequest("2026-05-24", "Bearer jwt"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN_STATUS");
  });

  it("returns 403 for a rejected trainee", async () => {
    mockJwtSession.mockResolvedValue({ userId: "r1", email: "r1@example.com" });
    mockLoadProfile.mockResolvedValue({
      ...activeTrainee,
      userId: "r1",
      email: "r1@example.com",
      status: "rejected",
    });

    const res = await GET(makeRequest("2026-05-24", "Bearer jwt"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN_STATUS");
  });
});
