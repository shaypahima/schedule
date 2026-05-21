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

import { POST } from "../no-show/route";
import { getContainer, resetContainer } from "@/lib/services";
import type { Profile } from "@/lib/auth/profile-repo";

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

const trainee: Profile = { ...coach, userId: "t1", role: "trainee" };

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () =>
  new NextRequest("http://localhost/api/admin/bookings/x/no-show", {
    method: "POST",
    headers: { authorization: "Bearer jwt" },
  });

async function setupPastBooking(): Promise<string> {
  const { store, bookings } = getContainer();
  store.upsertSlot({
    id: "slot-past",
    date: "2026-04-06",
    startTime: "10:00",
    capacity: 2,
    lockoutOverride: false,
    currentBookings: 0,
  });
  const b = await bookings.book("t1", "slot-past", { bypass: true });
  if (!b.ok) throw new Error("setup failed");
  return b.booking.id;
}

describe("POST /api/admin/bookings/:id/no-show", () => {
  beforeEach(() => {
    // Set 'now' to AFTER the slot date so markNoShow's past-slot check passes
    vi.setSystemTime(new Date("2026-04-08T06:00:00Z"));
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("marks past confirmed booking as no_show", async () => {
    const id = await setupPastBooking();
    const res = await POST(req(), paramsFor(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.status).toBe("no_show");
  });

  it("returns 404 when booking not found", async () => {
    const res = await POST(req(), paramsFor("ghost"));
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-coach caller", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
    const id = await setupPastBooking();
    const res = await POST(req(), paramsFor(id));
    expect(res.status).toBe(403);
  });

  it("returns 409 for future slot", async () => {
    const { store, bookings } = getContainer();
    store.upsertSlot({
      id: "slot-future",
      date: "2026-04-20",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    const b = await bookings.book("t1", "slot-future", { bypass: true });
    if (!b.ok) throw new Error("setup failed");
    const res = await POST(req(), paramsFor(b.booking.id));
    expect(res.status).toBe(409);
  });
});
