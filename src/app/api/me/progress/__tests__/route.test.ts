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

const trainee: Profile = {
  userId: "t1",
  email: "t1@example.com",
  phone: null,
  name: "Alice",
  role: "trainee",
  status: "active",
  hasIntro: true,
  createdAt: "2026-01-01T00:00:00Z",
};

const req = (qs = "") =>
  new NextRequest(`http://localhost/api/me/progress${qs}`, {
    headers: { authorization: "Bearer jwt" },
  });

describe("GET /api/me/progress", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns empty arrays for a fresh trainee", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      measurements: [],
      sessionLogs: [],
      lastMeasurement: null,
    });
  });

  it("returns measurements newest first with lastMeasurement", async () => {
    const { progress } = getContainer();
    const older = new Date(Date.now() - 10 * 86_400_000);
    const newer = new Date(Date.now() - 1 * 86_400_000);
    await progress.createMeasurement("t1", { weightKg: 70, loggedAt: older });
    await progress.createMeasurement("t1", { weightKg: 71, loggedAt: newer });

    const res = await GET(req());
    const body = await res.json();
    expect(body.measurements).toHaveLength(2);
    expect(body.measurements[0].weightKg).toBe(71);
    expect(body.lastMeasurement.weightKg).toBe(71);
  });

  it("respects ?days=N filter", async () => {
    const { progress } = getContainer();
    await progress.createMeasurement("t1", {
      weightKg: 60,
      loggedAt: new Date(Date.now() - 200 * 86_400_000),
    });
    await progress.createMeasurement("t1", { weightKg: 70 });

    const res = await GET(req("?days=30"));
    const body = await res.json();
    expect(body.measurements).toHaveLength(1);
    expect(body.measurements[0].weightKg).toBe(70);
  });

  it("403 for non-active trainee", async () => {
    mockLoadProfile.mockResolvedValue({ ...trainee, status: "pending" });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("does not leak other trainees' rows", async () => {
    const { progress } = getContainer();
    await progress.createMeasurement("t1", { weightKg: 71 });
    await progress.createMeasurement("t2", { weightKg: 95 });

    const res = await GET(req());
    const body = await res.json();
    expect(body.measurements).toHaveLength(1);
    expect(body.measurements[0].weightKg).toBe(71);
  });
});
