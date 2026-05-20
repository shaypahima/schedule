import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockGetCoachInfo = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/services/coach-info-repo", () => ({
  getCoachInfo: () => mockGetCoachInfo(),
}));

import { GET } from "../route";

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return new NextRequest("http://localhost/api/coach-info", { headers });
}

describe("GET /api/coach-info", () => {
  afterEach(() => {
    mockJwtSession.mockReset();
    mockGetCoachInfo.mockReset();
  });

  it("returns 401 without a JWT", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns the coach's name + contactPhone", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockGetCoachInfo.mockResolvedValue({
      name: "דני אמסלם",
      contactPhone: "+972501234567",
    });

    const res = await GET(makeRequest("Bearer jwt"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: "דני אמסלם",
      contactPhone: "+972501234567",
    });
  });

  it("returns 404 when no coach is configured", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockGetCoachInfo.mockResolvedValue(null);

    const res = await GET(makeRequest("Bearer jwt"));
    expect(res.status).toBe(404);
  });
});
