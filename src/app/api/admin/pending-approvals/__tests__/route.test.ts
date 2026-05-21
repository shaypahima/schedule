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
import { getContainer, resetContainer, getAuthService } from "@/lib/services";
import { MockAuthService } from "@/lib/supabase/auth-service";
import type { Profile } from "@/lib/auth/profile-repo";
import type { Profile as DomainProfile } from "@/lib/types";

const coach: Profile = {
  userId: "c1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const req = () =>
  new NextRequest("http://localhost/api/admin/pending-approvals", {
    headers: { authorization: "Bearer jwt" },
  });

function seedTrainee(overrides: Partial<DomainProfile> & { id: string; name: string; status?: string }) {
  const auth = getAuthService() as MockAuthService;
  auth._seedTrainee({
    role: "trainee",
    isRecurring: false,
    preferredDay: null,
    preferredTime: null,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as DomainProfile & { status?: string });
}

describe("GET /api/admin/pending-approvals", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockImplementation((id: string) => {
      if (id === "c1") return Promise.resolve(coach);
      // Pending trainees report hasIntro=true via loadProfile when their
      // intro_text row exists. Simulate that here.
      return Promise.resolve({
        ...coach,
        userId: id,
        role: "trainee" as const,
        status: "pending" as const,
        hasIntro: true,
      });
    });
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns empty list when no pending trainees", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).pending).toEqual([]);
  });

  it("returns only pending trainees with intro completed", async () => {
    getContainer();
    seedTrainee({ id: "t1", name: "Pending One", status: "pending" });
    seedTrainee({ id: "t2", name: "Active One", status: "active" });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    // Only the pending trainee passes the status filter; active does not.
    expect(body.pending).toHaveLength(1);
    expect(body.pending[0].id).toBe("t1");
  });

  it("excludes pending trainees without intro", async () => {
    getContainer();
    // Override loadProfile to return hasIntro=false for this trainee
    mockLoadProfile.mockImplementation((id: string) => {
      if (id === "c1") return Promise.resolve(coach);
      return Promise.resolve({
        ...coach,
        userId: id,
        role: "trainee" as const,
        status: "pending" as const,
        hasIntro: false, // no intro yet
      });
    });
    seedTrainee({ id: "t1", name: "No Intro Yet", status: "pending" });

    const res = await GET(req());
    const body = await res.json();
    expect(body.pending).toEqual([]);
  });

  it("returns 403 for non-coach", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue({ ...coach, userId: "t1", role: "trainee" });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("returns 401 without JWT", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });
});
