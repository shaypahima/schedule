import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      update: (patch: unknown) => {
        mockUpdate(patch);
        return { eq: (col: string, val: string) => Promise.resolve(mockEq(col, val)) };
      },
    }),
  }),
}));

import { POST as approve } from "../approve/route";
import { POST as reject } from "../reject/route";
import type { Profile } from "@/lib/auth/profile-repo";

const coachProfile: Profile = {
  userId: "c1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const pendingWithIntro: Profile = {
  userId: "t1",
  email: "t1@example.com",
  phone: "+972501234567",
  name: "Yael",
  role: "trainee",
  status: "pending",
  hasIntro: true,
  createdAt: "2026-01-01T00:00:00Z",
};

function makeReq(id: string) {
  return new NextRequest(`http://localhost/api/admin/trainees/${id}/approve`, {
    method: "POST",
    headers: { authorization: "Bearer jwt" },
  });
}

const params = { params: Promise.resolve({ id: "t1" }) };

describe("POST /api/admin/trainees/:id/approve", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    // Default: caller is the coach
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockImplementation((id: string) => {
      if (id === "c1") return Promise.resolve(coachProfile);
      if (id === "t1") return Promise.resolve(pendingWithIntro);
      return Promise.resolve(null);
    });
    mockEq.mockReturnValue({ error: null });
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
    mockUpdate.mockReset();
    mockEq.mockReset();
  });

  it("flips pending+hasIntro trainee to active", async () => {
    const res = await approve(makeReq("t1"), params);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ status: "active" });
  });

  it("rejects non-pending trainee", async () => {
    mockLoadProfile.mockImplementation((id: string) => {
      if (id === "c1") return Promise.resolve(coachProfile);
      return Promise.resolve({ ...pendingWithIntro, status: "active" });
    });
    const res = await approve(makeReq("t1"), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("NOT_PENDING");
  });

  it("rejects pending without intro", async () => {
    mockLoadProfile.mockImplementation((id: string) => {
      if (id === "c1") return Promise.resolve(coachProfile);
      return Promise.resolve({ ...pendingWithIntro, hasIntro: false });
    });
    const res = await approve(makeReq("t1"), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("INTRO_MISSING");
  });

  it("returns 403 for non-coach caller", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t2", email: "t2@example.com" });
    mockLoadProfile.mockImplementation(() =>
      Promise.resolve({ ...pendingWithIntro, userId: "t2" })
    );
    const res = await approve(makeReq("t1"), params);
    expect(res.status).toBe(403);
  });

  it("returns 404 when target not found", async () => {
    mockLoadProfile.mockImplementation((id: string) => {
      if (id === "c1") return Promise.resolve(coachProfile);
      return Promise.resolve(null);
    });
    const res = await approve(makeReq("ghost"), {
      params: Promise.resolve({ id: "ghost" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/trainees/:id/reject", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockImplementation((id: string) => {
      if (id === "c1") return Promise.resolve(coachProfile);
      if (id === "t1") return Promise.resolve(pendingWithIntro);
      return Promise.resolve(null);
    });
    mockEq.mockReturnValue({ error: null });
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
    mockUpdate.mockReset();
    mockEq.mockReset();
  });

  it("flips pending trainee to rejected (with or without intro)", async () => {
    const res = await reject(makeReq("t1"), params);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("rejects non-pending trainee", async () => {
    mockLoadProfile.mockImplementation((id: string) => {
      if (id === "c1") return Promise.resolve(coachProfile);
      return Promise.resolve({ ...pendingWithIntro, status: "active" });
    });
    const res = await reject(makeReq("t1"), params);
    expect(res.status).toBe(409);
  });
});
