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
import { resetContainer } from "@/lib/services";
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

const req = () =>
  new NextRequest("http://localhost/api/admin/dashboard", {
    headers: { authorization: "Bearer jwt" },
  });

describe("GET /api/admin/dashboard", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns DashboardView shape", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("pendingApprovals");
    expect(body).toHaveProperty("pendingChangeRequests");
    expect(body).toHaveProperty("noShowsThisWeek");
    expect(body).toHaveProperty("todayRoster");
    expect(body).toHaveProperty("urgentRequests");
    expect(Array.isArray(body.todayRoster)).toBe(true);
    expect(Array.isArray(body.urgentRequests)).toBe(true);
  });

  it("returns 403 for non-coach", async () => {
    mockLoadProfile.mockResolvedValue({ ...coach, role: "trainee" });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("returns 401 without JWT", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });
});
