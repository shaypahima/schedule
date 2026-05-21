import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();
const mockUpdateCoachInfo = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
}));

vi.mock("@/lib/services/coach-info-repo", () => ({
  getCoachInfo: vi.fn(),
  updateCoachInfo: (coachId: string, patch: unknown) =>
    mockUpdateCoachInfo(coachId, patch),
}));

import { PATCH } from "../route";

function makeRequest(body: Record<string, unknown>, authHeader?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader) headers.authorization = authHeader;
  return new NextRequest("http://localhost/api/coach-settings", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers,
  });
}

describe("PATCH /api/coach-settings", () => {
  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
    mockUpdateCoachInfo.mockReset();
  });

  it("returns 401 without JWT", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ contactPhone: "+972501234567" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for trainee", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue({
      userId: "t1",
      email: "t1@example.com",
      phone: null,
      name: "Alice",
      role: "trainee",
      status: "active",
      hasIntro: false,
      createdAt: "2026-01-01T00:00:00Z",
    });
    const res = await PATCH(makeRequest({ contactPhone: "+972501234567" }, "Bearer jwt"));
    expect(res.status).toBe(403);
    expect(mockUpdateCoachInfo).not.toHaveBeenCalled();
  });

  it("returns 400 for non-E.164 phone", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue({
      userId: "c1",
      email: "coach@example.com",
      phone: null,
      name: "Coach",
      role: "coach",
      status: "active",
      hasIntro: false,
      createdAt: "2026-01-01T00:00:00Z",
    });
    const res = await PATCH(makeRequest({ contactPhone: "0501234567" }, "Bearer jwt"));
    expect(res.status).toBe(400);
  });

  it("updates contact_phone for coach", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue({
      userId: "c1",
      email: "coach@example.com",
      phone: null,
      name: "Coach",
      role: "coach",
      status: "active",
      hasIntro: false,
      createdAt: "2026-01-01T00:00:00Z",
    });
    mockUpdateCoachInfo.mockResolvedValue(undefined);

    const res = await PATCH(makeRequest({ contactPhone: "+972501234567" }, "Bearer jwt"));
    expect(res.status).toBe(200);
    expect(mockUpdateCoachInfo).toHaveBeenCalledWith("c1", { contactPhone: "+972501234567" });
  });

  it("updates bio + specialty + yearsExperience", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue({
      userId: "c1",
      email: "coach@example.com",
      phone: null,
      name: "Coach",
      role: "coach",
      status: "active",
      hasIntro: false,
      createdAt: "2026-01-01T00:00:00Z",
    });
    mockUpdateCoachInfo.mockResolvedValue(undefined);

    const body = { bio: "מאמן כושר", specialty: "כוח", yearsExperience: 8 };
    const res = await PATCH(makeRequest(body, "Bearer jwt"));
    expect(res.status).toBe(200);
    expect(mockUpdateCoachInfo).toHaveBeenCalledWith("c1", body);
  });

  it("rejects out-of-range yearsExperience", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue({
      userId: "c1",
      email: "coach@example.com",
      phone: null,
      name: "Coach",
      role: "coach",
      status: "active",
      hasIntro: false,
      createdAt: "2026-01-01T00:00:00Z",
    });
    const res = await PATCH(makeRequest({ yearsExperience: 999 }, "Bearer jwt"));
    expect(res.status).toBe(400);
  });
});
