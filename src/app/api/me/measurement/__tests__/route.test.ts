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

import { POST } from "../route";
import { resetContainer, getContainer } from "@/lib/services";
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

const post = (body: unknown) =>
  new NextRequest("http://localhost/api/me/measurement", {
    method: "POST",
    headers: {
      authorization: "Bearer jwt",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("POST /api/me/measurement", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("creates a measurement with just a weight", async () => {
    const res = await POST(post({ weightKg: 73.4 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.measurement).toMatchObject({ traineeId: "t1", weightKg: 73.4 });
  });

  it("rejects empty body with EMPTY_PAYLOAD", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("EMPTY_PAYLOAD");
  });

  it("rejects implausible weight with INVALID_WEIGHT", async () => {
    const res = await POST(post({ weightKg: 999 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_WEIGHT");
  });

  it("stamps traineeId from session, ignoring any client-sent id", async () => {
    await POST(post({ weightKg: 70 }));
    const { progress } = getContainer();
    const list = await progress.listMeasurements("t1");
    expect(list).toHaveLength(1);
    expect(list[0].traineeId).toBe("t1");
  });

  it("403 for pending trainee", async () => {
    mockLoadProfile.mockResolvedValue({ ...trainee, status: "pending" });
    const res = await POST(post({ weightKg: 73 }));
    expect(res.status).toBe(403);
  });

  it("accepts photo-only payload (no weight)", async () => {
    const res = await POST(post({ photoUrl: "https://example.com/p.jpg" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.measurement.photoUrl).toBe("https://example.com/p.jpg");
    expect(body.measurement.weightKg).toBeNull();
  });
});
