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

import { POST as cancelPost } from "../request-cancel/route";
import { POST as reschedulePost } from "../request-reschedule/route";
import { getContainer, resetContainer } from "@/lib/services";
import type { Profile } from "@/lib/auth/profile-repo";

const activeTrainee: Profile = {
  userId: "t1",
  email: "t1@example.com",
  phone: null,
  name: "Alice",
  role: "trainee",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

function makeReq(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer jwt" },
  });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function setupBooking(): Promise<string> {
  const { store, bookings } = getContainer();
  store.upsertSlot({
    id: "slot-mon",
    date: "2026-04-06",
    startTime: "10:00",
    capacity: 2,
    lockoutOverride: false,
    currentBookings: 0,
  });
  store.upsertSlot({
    id: "slot-tue",
    date: "2026-04-07",
    startTime: "10:00",
    capacity: 2,
    lockoutOverride: false,
    currentBookings: 0,
  });
  const b = await bookings.book("t1", "slot-mon");
  if (!b.ok) throw new Error("setup booking failed");
  return b.booking.id;
}

describe("POST /api/bookings/:id/request-cancel", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(activeTrainee);
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("creates a pending request and returns 201", async () => {
    const bookingId = await setupBooking();

    const res = await cancelPost(
      makeReq("/api/bookings/x/request-cancel", { reason: "Sick" }),
      paramsFor(bookingId)
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.request.status).toBe("pending");
    expect(body.request.reason).toBe("Sick");
    expect(body.request.requestedNewSlotId).toBeNull();
  });

  it("rejects 400 when reason is missing", async () => {
    const bookingId = await setupBooking();
    const res = await cancelPost(
      makeReq("/api/bookings/x/request-cancel", { reason: "" }),
      paramsFor(bookingId)
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("REASON_REQUIRED");
  });

  it("rejects 401 without JWT", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await cancelPost(
      makeReq("/api/bookings/x/request-cancel", { reason: "Sick" }),
      paramsFor("bk-1")
    );
    expect(res.status).toBe(401);
  });

  it("rejects pending trainee with 403", async () => {
    mockLoadProfile.mockResolvedValue({ ...activeTrainee, status: "pending" });
    const res = await cancelPost(
      makeReq("/api/bookings/x/request-cancel", { reason: "Sick" }),
      paramsFor("bk-1")
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("FORBIDDEN_STATUS");
  });

  it("rejects 404 when booking does not exist", async () => {
    const res = await cancelPost(
      makeReq("/api/bookings/ghost/request-cancel", { reason: "Sick" }),
      paramsFor("ghost")
    );
    expect(res.status).toBe(404);
  });

  it("rejects 404 when booking belongs to another trainee", async () => {
    const bookingId = await setupBooking();
    mockJwtSession.mockResolvedValue({ userId: "t2", email: "t2@example.com" });
    mockLoadProfile.mockResolvedValue({ ...activeTrainee, userId: "t2" });
    const res = await cancelPost(
      makeReq("/api/bookings/x/request-cancel", { reason: "Sick" }),
      paramsFor(bookingId)
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 ALREADY_REQUESTED on duplicate", async () => {
    const bookingId = await setupBooking();
    await cancelPost(
      makeReq("/api/bookings/x/request-cancel", { reason: "Sick" }),
      paramsFor(bookingId)
    );
    const res = await cancelPost(
      makeReq("/api/bookings/x/request-cancel", { reason: "Still sick" }),
      paramsFor(bookingId)
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("ALREADY_REQUESTED");
  });
});

describe("POST /api/bookings/:id/request-reschedule", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(activeTrainee);
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("creates a pending reschedule request with target slot", async () => {
    const bookingId = await setupBooking();
    const res = await reschedulePost(
      makeReq("/api/bookings/x/request-reschedule", {
        newSlotId: "slot-tue",
        reason: "Conflict",
      }),
      paramsFor(bookingId)
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.request.requestedNewSlotId).toBe("slot-tue");
  });

  it("rejects 400 when newSlotId is missing", async () => {
    const bookingId = await setupBooking();
    const res = await reschedulePost(
      makeReq("/api/bookings/x/request-reschedule", { reason: "Conflict" }),
      paramsFor(bookingId)
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("NEW_SLOT_REQUIRED");
  });

  it("returns 404 when new slot doesn't exist", async () => {
    const bookingId = await setupBooking();
    const res = await reschedulePost(
      makeReq("/api/bookings/x/request-reschedule", {
        newSlotId: "ghost",
        reason: "Conflict",
      }),
      paramsFor(bookingId)
    );
    expect(res.status).toBe(404);
  });
});
