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

function req(date?: string) {
  return new NextRequest(
    `http://localhost/api/admin/waitlist${date ? `?date=${date}` : ""}`,
    { headers: { authorization: "Bearer jwt" } }
  );
}

describe("GET /api/admin/waitlist", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns per-slot waitlist counts for the date", async () => {
    const { store, waitlist } = getContainer();
    store.upsertSlot({
      id: "slot-a",
      date: "2030-01-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 2,
    });
    store.upsertSlot({
      id: "slot-b",
      date: "2030-01-06",
      startTime: "11:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    await waitlist.join("t1", "slot-a");
    await waitlist.join("t2", "slot-a");

    const res = await GET(req("2030-01-06"));
    expect(res.status).toBe(200);
    expect((await res.json()).counts).toEqual({ "slot-a": 2 });
  });

  it("400 without a valid date", async () => {
    expect((await GET(req())).status).toBe(400);
  });

  it("coach-only", async () => {
    mockLoadProfile.mockResolvedValue({ ...coach, role: "trainee" });
    expect((await GET(req("2030-01-06"))).status).toBe(403);
  });
});
