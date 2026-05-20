import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockFindProfile = vi.fn();
const mockUpdateContactPhone = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/services/profile-repo", () => ({
  findProfile: (id: string) => mockFindProfile(id),
}));

vi.mock("@/lib/services/coach-info-repo", () => ({
  getCoachInfo: vi.fn(),
  updateCoachContactPhone: (coachId: string, phone: string) =>
    mockUpdateContactPhone(coachId, phone),
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
    mockFindProfile.mockReset();
    mockUpdateContactPhone.mockReset();
  });

  it("returns 401 without JWT", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ contactPhone: "+972501234567" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for trainee", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockFindProfile.mockResolvedValue({
      id: "t1",
      email: "t1@example.com",
      name: "Alice",
      role: "trainee",
    });
    const res = await PATCH(makeRequest({ contactPhone: "+972501234567" }, "Bearer jwt"));
    expect(res.status).toBe(403);
    expect(mockUpdateContactPhone).not.toHaveBeenCalled();
  });

  it("returns 400 for non-E.164 phone", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockFindProfile.mockResolvedValue({
      id: "c1",
      email: "coach@example.com",
      name: "Coach",
      role: "admin",
    });
    const res = await PATCH(makeRequest({ contactPhone: "0501234567" }, "Bearer jwt"));
    expect(res.status).toBe(400);
  });

  it("updates contact_phone for coach", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockFindProfile.mockResolvedValue({
      id: "c1",
      email: "coach@example.com",
      name: "Coach",
      role: "admin",
    });
    mockUpdateContactPhone.mockResolvedValue(undefined);

    const res = await PATCH(makeRequest({ contactPhone: "+972501234567" }, "Bearer jwt"));
    expect(res.status).toBe(200);
    expect(mockUpdateContactPhone).toHaveBeenCalledWith("c1", "+972501234567");
  });
});
