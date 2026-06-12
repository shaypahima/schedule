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

import { PATCH } from "../route";
import { getContainer, resetContainer } from "@/lib/services";
import type { Profile as AuthProfile } from "@/lib/auth/profile-repo";

const coach: AuthProfile = {
  userId: "c1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const req = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/slots", {
    method: "PATCH",
    headers: { authorization: "Bearer jwt", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PATCH /api/admin/slots", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("creates the slot on first touch of a date+time", async () => {
    const res = await PATCH(req({ date: "2026-07-01", startTime: "10:00", capacity: 3 }));
    expect(res.status).toBe(200);

    const { store } = getContainer();
    const slot = await store.getSlot("slot-2026-07-01-10:00");
    expect(slot?.capacity).toBe(3);
    expect(slot?.lockoutOverride).toBe(false);
  });

  it("updates capacity of an existing slot without losing bookings count", async () => {
    const { store, bookings } = getContainer();
    store.upsertSlot({
      id: "s1",
      date: "2026-07-01",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    await bookings.book("t1", "s1", { bypass: true });

    const res = await PATCH(req({ slotId: "s1", capacity: 4 }));
    expect(res.status).toBe(200);

    const slot = await store.getSlot("s1");
    expect(slot?.capacity).toBe(4);
    expect(slot?.currentBookings).toBe(1);
  });

  it("sets lockoutOverride so the cancel-window gate is bypassed", async () => {
    const { store } = getContainer();
    store.upsertSlot({
      id: "s1",
      date: "2026-07-01",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });

    const res = await PATCH(req({ slotId: "s1", lockoutOverride: true }));
    expect(res.status).toBe(200);
    expect((await store.getSlot("s1"))?.lockoutOverride).toBe(true);
  });

  it("404 for unknown slotId without date+time fallback", async () => {
    const res = await PATCH(req({ slotId: "ghost", capacity: 4 }));
    expect(res.status).toBe(404);
  });

  it("403 for non-coach caller", async () => {
    mockLoadProfile.mockResolvedValue({ ...coach, userId: "t1", role: "trainee" });
    const res = await PATCH(req({ date: "2026-07-01", startTime: "10:00" }));
    expect(res.status).toBe(403);
  });
});
