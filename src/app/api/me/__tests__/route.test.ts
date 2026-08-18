import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();
const mockCreateProfile = vi.fn();
const mockSetProfileStatus = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
  createProfile: (row: unknown) => mockCreateProfile(row),
  setProfileStatus: (id: string, status: string) => mockSetProfileStatus(id, status),
}));

import { GET } from "../route";
import type { Profile } from "@/lib/auth/profile-repo";

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return new NextRequest("http://localhost/api/me", { headers });
}

const baseTrainee: Profile = {
  userId: "user-1",
  email: "yael.cohen@example.com",
  phone: null,
  name: "יעל כהן",
  role: "trainee",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("GET /api/me", () => {
  beforeEach(() => {
    process.env.COACH_EMAIL = "coach@velofit.app";
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
    mockCreateProfile.mockReset();
  });

  it("returns 200 with profile for valid JWT", async () => {
    mockJwtSession.mockResolvedValue({ userId: "user-1", email: "yael.cohen@example.com" });
    mockLoadProfile.mockResolvedValue(baseTrainee);

    const res = await GET(makeRequest("Bearer valid-jwt"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-1");
    expect(body.role).toBe("trainee");
  });

  it("returns 401 when no JWT is present", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockLoadProfile).not.toHaveBeenCalled();
  });

  it("returns 401 when JWT is invalid", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await GET(makeRequest("Bearer bad-jwt"));
    expect(res.status).toBe(401);
  });

  it("forces role=coach when email matches COACH_EMAIL", async () => {
    process.env.COACH_EMAIL = "coach@velofit.app,other@velofit.app";
    mockJwtSession.mockResolvedValue({ userId: "user-coach", email: "coach@velofit.app" });
    mockLoadProfile.mockResolvedValue({
      ...baseTrainee,
      userId: "user-coach",
      email: "coach@velofit.app",
      name: "Coach",
      role: "trainee", // DB says trainee but COACH_EMAIL overrides
    });

    const res = await GET(makeRequest("Bearer jwt"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("coach");
  });

  it("auto-provisions trainee profile on first login", async () => {
    mockJwtSession.mockResolvedValue({ userId: "new-user", email: "newbie@velofit.app" });
    mockLoadProfile.mockResolvedValue(null);
    mockCreateProfile.mockResolvedValue({
      ...baseTrainee,
      userId: "new-user",
      email: "newbie@velofit.app",
      name: "newbie",
      role: "trainee",
    });

    const res = await GET(makeRequest("Bearer jwt"));

    expect(res.status).toBe(200);
    expect(mockCreateProfile).toHaveBeenCalledWith({
      userId: "new-user",
      email: "newbie@velofit.app",
      name: "newbie",
      role: "trainee",
    });
    const body = await res.json();
    expect(body.role).toBe("trainee");
  });

  it("auto-provisions coach profile when email matches COACH_EMAIL", async () => {
    process.env.COACH_EMAIL = "coach@velofit.app";
    mockJwtSession.mockResolvedValue({ userId: "new-coach", email: "coach@velofit.app" });
    mockLoadProfile.mockResolvedValue(null);
    mockCreateProfile.mockResolvedValue({
      ...baseTrainee,
      userId: "new-coach",
      email: "coach@velofit.app",
      name: "coach",
      role: "coach",
    });

    const res = await GET(makeRequest("Bearer jwt"));

    expect(res.status).toBe(200);
    expect(mockCreateProfile).toHaveBeenCalledWith({
      userId: "new-coach",
      email: "coach@velofit.app",
      name: "coach",
      role: "coach",
    });
    const body = await res.json();
    expect(body.role).toBe("coach");
  });
});
