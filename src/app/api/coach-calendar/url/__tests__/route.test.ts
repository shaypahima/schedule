import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockFindProfile = vi.fn();
const mockGetAuthUrl = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/services/profile-repo", () => ({
  findProfile: (id: string) => mockFindProfile(id),
}));

vi.mock("@/lib/services", () => ({
  getRealCalendarService: () => ({ getAuthUrl: () => mockGetAuthUrl() }),
}));

import { GET } from "../route";

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return new NextRequest("http://localhost/api/coach-calendar/url", { headers });
}

describe("GET /api/coach-calendar/url", () => {
  afterEach(() => {
    mockJwtSession.mockReset();
    mockFindProfile.mockReset();
    mockGetAuthUrl.mockReset();
  });

  it("returns 401 without JWT", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
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
    const res = await GET(makeRequest("Bearer jwt"));
    expect(res.status).toBe(403);
  });

  it("returns {authUrl} for coach", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "c1@example.com" });
    mockFindProfile.mockResolvedValue({
      id: "c1",
      email: "c1@example.com",
      name: "Coach",
      role: "admin",
    });
    mockGetAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?xxx");
    const res = await GET(makeRequest("Bearer jwt"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth?xxx",
    });
  });
});
