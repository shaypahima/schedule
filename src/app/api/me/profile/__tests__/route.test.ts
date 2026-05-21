import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();
const mockGet = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
}));

vi.mock("@/lib/services/trainee-profile-repo", () => ({
  getTraineeProfile: (id: string) => mockGet(id),
  upsertTraineeProfile: (id: string, patch: unknown) => mockUpsert(id, patch),
}));

import { GET, PATCH } from "../route";
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

const blankProfile = {
  phone: null,
  introText: null,
  photoUrl: null,
  dateOfBirth: null,
  heightCm: null,
  weightKg: null,
  goals: null,
  medical: null,
};

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/me/profile", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json", authorization: "Bearer jwt" },
  });
}

describe("/api/me/profile", () => {
  beforeEach(() => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
    mockGet.mockReset();
    mockUpsert.mockReset();
  });

  describe("GET", () => {
    it("returns the trainee_profile fields", async () => {
      mockGet.mockResolvedValue({ ...blankProfile, phone: "+972501234567", goals: "5K" });
      const res = await GET(req("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.profile.phone).toBe("+972501234567");
      expect(body.profile.goals).toBe("5K");
    });

    it("allows pending trainee to read their own profile", async () => {
      mockLoadProfile.mockResolvedValue({ ...trainee, status: "pending" });
      mockGet.mockResolvedValue(blankProfile);
      const res = await GET(req("GET"));
      expect(res.status).toBe(200);
    });

    it("returns 403 for coach (this endpoint is trainee-only)", async () => {
      mockLoadProfile.mockResolvedValue({ ...trainee, role: "coach" });
      const res = await GET(req("GET"));
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH", () => {
    it("accepts a valid update", async () => {
      mockUpsert.mockResolvedValue({ ...blankProfile, heightCm: 175 });
      const res = await PATCH(req("PATCH", { heightCm: 175 }));
      expect(res.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith("t1", { heightCm: 175 });
    });

    it("rejects non-E.164 phone", async () => {
      const res = await PATCH(req("PATCH", { phone: "0501234567" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("PHONE_INVALID");
    });

    it("rejects out-of-range heightCm", async () => {
      const res = await PATCH(req("PATCH", { heightCm: 10 }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("HEIGHT_OUT_OF_RANGE");
    });

    it("rejects out-of-range weightKg", async () => {
      const res = await PATCH(req("PATCH", { weightKg: 5 }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("WEIGHT_OUT_OF_RANGE");
    });

    it("returns 403 when pending trainee tries to PATCH", async () => {
      mockLoadProfile.mockResolvedValue({ ...trainee, status: "pending" });
      const res = await PATCH(req("PATCH", { heightCm: 175 }));
      expect(res.status).toBe(403);
    });
  });
});
