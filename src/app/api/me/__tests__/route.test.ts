import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockFindProfile = vi.fn();
const mockCreateProfile = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/services/profile-repo", () => ({
  findProfile: (id: string) => mockFindProfile(id),
  createProfile: (row: unknown) => mockCreateProfile(row),
}));

import { GET } from "../route";

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return new NextRequest("http://localhost/api/me", { headers });
}

describe("GET /api/me", () => {
  beforeEach(() => {
    process.env.COACH_EMAIL = "coach@velofit.app";
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockFindProfile.mockReset();
    mockCreateProfile.mockReset();
  });

  it("returns 200 with profile for valid JWT", async () => {
    mockJwtSession.mockResolvedValue({
      userId: "user-1",
      email: "yael.cohen@example.com",
    });
    mockFindProfile.mockResolvedValue({
      id: "user-1",
      email: "yael.cohen@example.com",
      name: "יעל כהן",
      role: "trainee",
    });

    const res = await GET(makeRequest("Bearer valid-jwt"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      id: "user-1",
      email: "yael.cohen@example.com",
      name: "יעל כהן",
      role: "trainee",
    });
  });

  it("returns 401 when no JWT is present", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockFindProfile).not.toHaveBeenCalled();
  });

  it("returns 401 when JWT is invalid", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await GET(makeRequest("Bearer bad-jwt"));
    expect(res.status).toBe(401);
  });

  it("forces role=admin when email matches COACH_EMAIL", async () => {
    process.env.COACH_EMAIL = "coach@velofit.app,other@velofit.app";
    mockJwtSession.mockResolvedValue({
      userId: "user-coach",
      email: "coach@velofit.app",
    });
    mockFindProfile.mockResolvedValue({
      id: "user-coach",
      email: "coach@velofit.app",
      name: "Coach",
      role: "trainee", // DB says trainee but COACH_EMAIL overrides
    });

    const res = await GET(makeRequest("Bearer jwt"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("admin");
  });

  it("auto-provisions trainee profile on first login", async () => {
    mockJwtSession.mockResolvedValue({
      userId: "new-user",
      email: "newbie@velofit.app",
    });
    mockFindProfile.mockResolvedValue(null);
    mockCreateProfile.mockResolvedValue({
      id: "new-user",
      email: "newbie@velofit.app",
      name: "newbie",
      role: "trainee",
    });

    const res = await GET(makeRequest("Bearer jwt"));

    expect(res.status).toBe(200);
    expect(mockCreateProfile).toHaveBeenCalledWith({
      id: "new-user",
      email: "newbie@velofit.app",
      name: "newbie",
      role: "trainee",
    });
    const body = await res.json();
    expect(body.role).toBe("trainee");
  });

  it("auto-provisions coach profile when email matches COACH_EMAIL", async () => {
    process.env.COACH_EMAIL = "coach@velofit.app";
    mockJwtSession.mockResolvedValue({
      userId: "new-coach",
      email: "coach@velofit.app",
    });
    mockFindProfile.mockResolvedValue(null);
    mockCreateProfile.mockResolvedValue({
      id: "new-coach",
      email: "coach@velofit.app",
      name: "coach",
      role: "admin",
    });

    const res = await GET(makeRequest("Bearer jwt"));

    expect(res.status).toBe(200);
    expect(mockCreateProfile).toHaveBeenCalledWith({
      id: "new-coach",
      email: "coach@velofit.app",
      name: "coach",
      role: "admin",
    });
    const body = await res.json();
    expect(body.role).toBe("admin");
  });
});
