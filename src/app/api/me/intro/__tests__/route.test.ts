import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      upsert: (row: unknown) => Promise.resolve(mockUpsert(row)),
    }),
  }),
}));

import { POST } from "../route";
import type { Profile } from "@/lib/auth/profile-repo";

const pendingNoIntro: Profile = {
  userId: "t1",
  email: "t1@example.com",
  phone: null,
  name: "Yael",
  role: "trainee",
  status: "pending",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/me/intro", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer jwt" },
  });
}

describe("POST /api/me/intro", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
    mockUpsert.mockReset();
  });

  it("upserts the trainee_profile row and returns ok", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(pendingNoIntro);
    mockUpsert.mockReturnValue({ error: null });

    const res = await POST(
      makeReq({ phone: "+972501234567", introText: "I want to train for a 10K." })
    );

    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "t1",
        phone: "+972501234567",
        intro_text: "I want to train for a 10K.",
      })
    );
  });

  it("rejects non-E.164 phone", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(pendingNoIntro);

    const res = await POST(
      makeReq({ phone: "0501234567", introText: "Plenty of intro text here." })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("PHONE_INVALID");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects intro shorter than 10 chars", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(pendingNoIntro);

    const res = await POST(makeReq({ phone: "+972501234567", introText: "hi" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INTRO_TOO_SHORT");
  });

  it("returns 409 if intro already submitted", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue({ ...pendingNoIntro, hasIntro: true });

    const res = await POST(
      makeReq({ phone: "+972501234567", introText: "Another submission attempt." })
    );

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("INTRO_ALREADY_SUBMITTED");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects active trainee with 403 FORBIDDEN_STATUS", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue({ ...pendingNoIntro, status: "active" });

    const res = await POST(
      makeReq({ phone: "+972501234567", introText: "Active trainee should not access this." })
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("FORBIDDEN_STATUS");
  });

  it("rejects unauthenticated", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await POST(makeReq({ phone: "+972501234567", introText: "no auth here" }));
    expect(res.status).toBe(401);
  });
});
