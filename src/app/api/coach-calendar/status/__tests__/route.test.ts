import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockFindProfile = vi.fn();
const mockIsConnected = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/services/profile-repo", () => ({
  findProfile: (id: string) => mockFindProfile(id),
}));

vi.mock("@/lib/services", () => ({
  getRealCalendarService: () => ({ isConnected: () => mockIsConnected() }),
}));

import { GET } from "../route";

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return new NextRequest("http://localhost/api/coach-calendar/status", { headers });
}

describe("GET /api/coach-calendar/status", () => {
  afterEach(() => {
    mockJwtSession.mockReset();
    mockFindProfile.mockReset();
    mockIsConnected.mockReset();
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

  it("returns {connected:true} for connected coach", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "c1@example.com" });
    mockFindProfile.mockResolvedValue({
      id: "c1",
      email: "c1@example.com",
      name: "Coach",
      role: "coach",
    });
    mockIsConnected.mockResolvedValue(true);
    const res = await GET(makeRequest("Bearer jwt"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: true });
  });

  it("returns {connected:false} when not connected", async () => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "c1@example.com" });
    mockFindProfile.mockResolvedValue({
      id: "c1",
      email: "c1@example.com",
      name: "Coach",
      role: "coach",
    });
    mockIsConnected.mockResolvedValue(false);
    const res = await GET(makeRequest("Bearer jwt"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false });
  });
});
