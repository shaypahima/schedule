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

import { POST } from "../route";
import {
  MockPhotoStorage,
  setPhotoStorage,
} from "@/lib/services/photo-storage";
import type { Profile } from "@/lib/auth/profile-repo";

const trainee: Profile = {
  userId: "t1",
  email: "t1@example.com",
  phone: null,
  name: "מתאמן",
  role: "trainee",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

function photoRequest(opts: { type?: string; size?: number } = {}) {
  const type = opts.type ?? "image/jpeg";
  const bytes = new Uint8Array(opts.size ?? 1024);
  const form = new FormData();
  form.append("photo", new Blob([bytes], { type }), "progress.jpg");
  return new NextRequest("http://localhost/api/me/photos", {
    method: "POST",
    headers: { authorization: "Bearer jwt" },
    body: form,
  });
}

describe("POST /api/me/photos", () => {
  let storage: MockPhotoStorage;

  beforeEach(() => {
    storage = new MockPhotoStorage();
    setPhotoStorage(storage);
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
  });

  afterEach(() => {
    setPhotoStorage(undefined);
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("uploads a photo into the trainee's folder and returns its url", async () => {
    const res = await POST(photoRequest());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toMatch(/^https:\/\/photos\.test\/t1\//);
    expect(storage.uploads).toHaveLength(1);
    expect(storage.uploads[0]).toMatchObject({
      traineeId: "t1",
      contentType: "image/jpeg",
    });
  });

  it("rejects non-image content types", async () => {
    const res = await POST(photoRequest({ type: "application/pdf" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("UNSUPPORTED_TYPE");
    expect(storage.uploads).toHaveLength(0);
  });

  it("rejects files over 5MB", async () => {
    const res = await POST(photoRequest({ size: 5 * 1024 * 1024 + 1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("TOO_LARGE");
  });

  it("rejects a request without a photo field", async () => {
    const form = new FormData();
    const res = await POST(
      new NextRequest("http://localhost/api/me/photos", {
        method: "POST",
        headers: { authorization: "Bearer jwt" },
        body: form,
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("PHOTO_REQUIRED");
  });

  it("requires an active trainee", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await POST(photoRequest());
    expect(res.status).toBe(401);
  });
});
