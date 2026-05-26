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

import { POST, GET } from "../route";
import { resetContainer, getContainer } from "@/lib/services";
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

const post = (bookingId: string, body: unknown) =>
  new NextRequest(`http://localhost/api/me/session-log/${bookingId}`, {
    method: "POST",
    headers: {
      authorization: "Bearer jwt",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

const get = (bookingId: string) =>
  new NextRequest(`http://localhost/api/me/session-log/${bookingId}`, {
    headers: { authorization: "Bearer jwt" },
  });

const params = (bookingId: string) => ({
  params: Promise.resolve({ bookingId }),
});

describe("POST /api/me/session-log/[bookingId]", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  async function seedBookingForT1() {
    const { store, bookings } = getContainer();
    store.upsertSlot({
      id: "s1",
      date: "2026-04-01",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    const b = await bookings.book("t1", "s1", { bypass: true });
    if (!b.ok) throw new Error("setup failed");
    return b.booking.id;
  }

  it("creates a session log for caller's own booking", async () => {
    const bookingId = await seedBookingForT1();
    const res = await POST(post(bookingId, { feedback: { energy: 4 } }), params(bookingId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionLog.feedback).toEqual({ energy: 4 });
  });

  it("upsert is idempotent: second POST updates feedback", async () => {
    const bookingId = await seedBookingForT1();
    await POST(post(bookingId, { feedback: { energy: 3 } }), params(bookingId));
    const res = await POST(post(bookingId, { feedback: { energy: 5 } }), params(bookingId));
    const body = await res.json();
    expect(body.sessionLog.feedback).toEqual({ energy: 5 });
  });

  it("404 when booking is not the caller's", async () => {
    const { store, bookings } = getContainer();
    store.upsertSlot({
      id: "s1",
      date: "2026-04-01",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    const b = await bookings.book("t2", "s1", { bypass: true });
    if (!b.ok) throw new Error("setup failed");

    const res = await POST(post(b.booking.id, { feedback: { energy: 3 } }), params(b.booking.id));
    expect(res.status).toBe(404);
  });

  it("404 when booking doesn't exist", async () => {
    const res = await POST(post("ghost", { feedback: {} }), params("ghost"));
    expect(res.status).toBe(404);
  });

  it("trainee cannot write coach_notes via this route (silently dropped)", async () => {
    const bookingId = await seedBookingForT1();
    await POST(
      post(bookingId, { feedback: { energy: 4 }, coachNotes: "I am sneaky" }),
      params(bookingId)
    );
    const { progress } = getContainer();
    const row = await progress.getSessionLog(bookingId);
    expect(row?.coachNotes).toBeNull();
  });
});

describe("GET /api/me/session-log/[bookingId]", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns null when no log exists yet", async () => {
    const { store, bookings } = getContainer();
    store.upsertSlot({
      id: "s1",
      date: "2026-04-01",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    const b = await bookings.book("t1", "s1", { bypass: true });
    if (!b.ok) throw new Error("setup failed");

    const res = await GET(get(b.booking.id), params(b.booking.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionLog).toBeNull();
  });
});
