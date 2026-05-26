import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();
const mockGetTraineeProfile = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
}));

vi.mock("@/lib/services/trainee-profile-repo", () => ({
  getTraineeProfile: (id: string) => mockGetTraineeProfile(id),
}));

process.env.MOCK_SERVICES = "true";

import { GET } from "../route";
import { resetContainer, getAuthService } from "@/lib/services";
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
  new NextRequest("http://localhost/api/admin/trainees/t1", {
    headers: { authorization: "Bearer jwt" },
  });

const params = { params: Promise.resolve({ id: "t1" }) };

describe("GET /api/admin/trainees/[id]", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);
    mockGetTraineeProfile.mockResolvedValue({
      phone: "+972501234567",
      introText: "Hi, I want to train",
      photoUrl: null,
      dateOfBirth: "1992-04-08",
      heightCm: 168,
      weightKg: 65,
      goals: "build strength",
      medical: "none",
    });

    const auth = getAuthService() as MockAuthService;
    auth._seedTrainee({
      id: "t1",
      name: "Yael",
      role: "trainee",
      isRecurring: false,
      preferredDay: null,
      preferredTime: null,
      isActive: true,
      createdAt: new Date("2026-01-01"),
    } as DomainProfile);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
    mockGetTraineeProfile.mockReset();
  });

  it("includes the trainee profile bio fields", async () => {
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile).toBeDefined();
    expect(body.profile.dateOfBirth).toBe("1992-04-08");
    expect(body.profile.heightCm).toBe(168);
    expect(body.profile.weightKg).toBe(65);
    expect(body.profile.goals).toBe("build strength");
    expect(body.profile.medical).toBe("none");
    expect(body.profile.phone).toBe("+972501234567");
  });

  it("returns 404 when trainee unknown", async () => {
    const res = await GET(req(), { params: Promise.resolve({ id: "ghost" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is not a coach", async () => {
    mockLoadProfile.mockResolvedValue({ ...coach, role: "trainee" });
    const res = await GET(req(), params);
    expect(res.status).toBe(403);
  });
});
