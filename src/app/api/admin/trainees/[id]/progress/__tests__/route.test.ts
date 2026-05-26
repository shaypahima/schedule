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
import { resetContainer, getContainer } from "@/lib/services";
import type { Profile } from "@/lib/auth/profile-repo";

const coach: Profile = {
  userId: "coach-1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: true,
  createdAt: "2026-01-01T00:00:00Z",
};

const trainee: Profile = {
  ...coach,
  userId: "t1",
  role: "trainee",
  name: "Alice",
};

const get = (id: string) =>
  new NextRequest(`http://localhost/api/admin/trainees/${id}/progress`, {
    headers: { authorization: "Bearer jwt" },
  });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/admin/trainees/[id]/progress", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "coach-1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns trainee's measurements newest first", async () => {
    const { progress } = getContainer();
    const older = new Date(Date.now() - 10 * 86_400_000);
    const newer = new Date(Date.now() - 1 * 86_400_000);
    await progress.createMeasurement("t1", { weightKg: 70, loggedAt: older });
    await progress.createMeasurement("t1", { weightKg: 71, loggedAt: newer });

    const res = await GET(get("t1"), params("t1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.measurements).toHaveLength(2);
    expect(body.measurements[0].weightKg).toBe(71);
    expect(body.lastMeasurement.weightKg).toBe(71);
  });

  it("403 for a trainee impersonating coach role guard", async () => {
    mockLoadProfile.mockResolvedValue(trainee);
    const res = await GET(get("t1"), params("t1"));
    expect(res.status).toBe(403);
  });

  it("returns empty arrays when no logs exist", async () => {
    const res = await GET(get("t1"), params("t1"));
    const body = await res.json();
    expect(body.measurements).toEqual([]);
    expect(body.lastMeasurement).toBeNull();
  });
});
